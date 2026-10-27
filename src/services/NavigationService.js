/**
 * NavigationService - 路線規劃服務
 * Route planning service using Mapbox Directions API
 */

// 之後我們可以把這個統一移到 .env，這裡先保留方便你測試
const MAPBOX_TOKEN = '請貼上金鑰';

class NavigationService {
  
  /**
   * 📍 新增：取得多停靠點路線 (行程規劃專用)
   * @param {Array} waypoints - 經緯度陣列 [{lng, lat}, {lng, lat}, ...] (至少兩個點)
   * @param {string} profile - 交通方式：'driving', 'walking', 'cycling' (預設 driving)
   * @returns {Object} 路線資料
   */
  async getWaypointRoute(waypoints, profile = 'driving') {
    try {
      if (!waypoints || waypoints.length < 2) {
        throw new Error('需要至少兩個座標點才能規劃路線');
      }

      // 將座標陣列組裝成 Mapbox API 需要的格式：lng,lat;lng,lat...
      const coordinatesString = waypoints
        .map(wp => `${wp.lng},${wp.lat}`)
        .join(';');

      // 將 language 調整為 zh-TW，讓導航語音與文字支援繁體中文
      const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinatesString}?steps=true&voice_instructions=true&banner_instructions=true&geometries=geojson&language=zh-TW&access_token=${MAPBOX_TOKEN}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        throw new Error('找不到可行的路線');
      }
      
      const route = data.routes[0];

      // 整合多個區段 (leg) 的步驟，支援多停靠點導航
      let allSteps = [];
      if (route.legs) {
        route.legs.forEach(leg => {
          const legSteps = leg.steps.map(step => ({
            instruction: step.maneuver.instruction,
            distance: step.distance,
            duration: step.duration,
            type: step.maneuver.type,
            modifier: step.maneuver.modifier || 'straight',
            location: step.maneuver.location,
          }));
          allSteps = [...allSteps, ...legSteps];
        });
      }

      return {
        geometry: route.geometry,
        distance: route.distance, // 總距離 (公尺)
        duration: route.duration, // 總時間 (秒)
        steps: allSteps,          // 合併後的所有逐步導航
      };

    } catch (error) {
      console.error('Waypoint Route error:', error);
      throw error;
    }
  }

  /**
   * 為了相容原本的呼叫，將原本的 getWalkingRoute 導向新的多點邏輯
   */
  async getWalkingRoute(startLng, startLat, endLng, endLat) {
    return this.getWaypointRoute(
      [{ lng: startLng, lat: startLat }, { lng: endLng, lat: endLat }],
      'walking'
    );
  }

  /**
   * 將距離格式化為人類可讀的字串
   */
  formatDistance(meters) {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }

  /**
   * 將時間格式化為人類可讀的字串
   */
  formatDuration(seconds) {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  /**
   * 根據 maneuver type 取得對應的方向圖示
   */
  getDirectionIcon(type, modifier) {
    if (type === 'arrive') return 'arrive';
    if (type === 'depart') return 'depart';
    if (modifier === 'left') return 'turn-left';
    if (modifier === 'right') return 'turn-right';
    if (modifier === 'slight left') return 'slight-left';
    if (modifier === 'slight right') return 'slight-right';
    if (modifier === 'uturn') return 'uturn';
    return 'straight';
  }

  /**
   * 計算目前在路線上的進度
   */
  getCurrentStepIndex(steps, currentLocation) {
    let closestIndex = 0;
    let closestDistance = Infinity;

    steps.forEach((step, index) => {
      const [stepLng, stepLat] = step.location;
      const distance = this.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        stepLat,
        stepLng
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  /**
   * Haversine 公式計算兩點距離（公尺）
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
      Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
}

export default new NavigationService();