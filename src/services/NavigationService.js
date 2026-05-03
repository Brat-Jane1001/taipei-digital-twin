/**
 * NavigationService - 路線規劃服務
 * Route planning service using Mapbox Directions API
 * 
 * 功能：
 * - 規劃步行路線
 * - 產生逐步導航指示（英文）
 * - 計算ETA和距離
 */

const MAPBOX_TOKEN = '';

class NavigationService {
  
  /**
   * 取得步行路線
   * @param {number} startLng - 起點經度
   * @param {number} startLat - 起點緯度
   * @param {number} endLng - 終點經度
   * @param {number} endLat - 終點緯度
   * @returns {Object} 路線資料
   */
  async getWalkingRoute(startLng, startLat, endLng, endLat) {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${startLng},${startLat};${endLng},${endLat}?steps=true&voice_instructions=true&banner_instructions=true&geometries=geojson&language=en&access_token=${MAPBOX_TOKEN}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }
      
      const route = data.routes[0];

      return {
        // GeoJSON格式的路線座標（用於地圖畫線）
        geometry: route.geometry,
        
        // 總距離（公尺）
        distance: route.distance,
        
        // 預計時間（秒）
        duration: route.duration,
        
        // 逐步導航指示
        steps: route.legs[0].steps.map(step => ({
          instruction: step.maneuver.instruction,  // 英文導航指示
          distance: step.distance,                  // 這段距離（公尺）
          duration: step.duration,                  // 這段時間（秒）
          type: step.maneuver.type,                 // 動作類型（turn/depart/arrive）
          modifier: step.maneuver.modifier,         // 方向（left/right/straight）
          location: step.maneuver.location,         // [lng, lat]
        })),
      };

    } catch (error) {
      console.error('Navigation error:', error);
      throw error;
    }
  }

  /**
   * 將距離格式化為人類可讀的字串
   * @param {number} meters - 距離（公尺）
   * @returns {string} 格式化距離
   */
  formatDistance(meters) {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }

  /**
   * 將時間格式化為人類可讀的字串
   * @param {number} seconds - 時間（秒）
   * @returns {string} 格式化時間
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
   * 根據maneuver type取得對應的方向圖示
   * @param {string} type - maneuver type
   * @param {string} modifier - 方向modifier
   * @returns {string} 方向描述
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
   * 找出距離目前位置最近的步驟
   * @param {Array} steps - 路線步驟陣列
   * @param {Object} currentLocation - 目前位置 {latitude, longitude}
   * @returns {number} 目前步驟的index
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
   * Haversine公式計算兩點距離（公尺）
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // 地球半徑（公尺）
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