/**
 * TransportService - TDX 公車即時位置與站牌服務
 * 串接交通部 TDX API 取得台北市公車即時 GPS 位置與周邊站牌
 */

const TDX_CLIENT_ID = '請貼上金鑰';
const TDX_CLIENT_SECRET = '請貼上金鑰';
const TDX_BASE_URL = 'https://tdx.transportdata.tw/api/basic';

class TransportService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * 取得 TDX Access Token
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    try {
      const response = await fetch(
        'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=client_credentials&client_id=${TDX_CLIENT_ID}&client_secret=${TDX_CLIENT_SECRET}`,
        }
      );
      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
      return this.accessToken;
    } catch (error) {
      console.error('TDX Token 錯誤:', error);
      throw error;
    }
  }

  /**
   * 取得台北市公車即時 GPS 位置 (A1 資料)
   */
  async getBusLocations() {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(
        `${TDX_BASE_URL}/v2/Bus/RealTimeByFrequency/City/Taipei?$top=300&$format=JSON`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const raw = await response.json();
      const data = Array.isArray(raw) ? raw : (raw?.value ?? []);

      return data
        .filter(b => b?.BusPosition?.PositionLon && b?.BusPosition?.PositionLat && b?.DutyStatus === 1)
        .map(b => ({
          id: b.PlateNumb,
          routeName: b.RouteName?.Zh_tw || '',
          lng: b.BusPosition.PositionLon,
          lat: b.BusPosition.PositionLat,
          heading: b.Bearing || 0,
          speed: b.Speed || 0,
        }));
    } catch (error) {
      console.error('取得公車位置失敗:', error);
      return [];
    }
  }

  /**
   * 取得多個經緯度周邊的公車站牌 (自動去重複)
   * @param {Array} points - [{lat, lng}, ...]
   * @param {number} radius - 搜尋半徑(公尺)
   */
  async getMultipleNearbyBusStops(points, radius = 1000) {
    try {
      const token = await this.getAccessToken();
      const allStops = [];
      const seenIds = new Set();

      await Promise.allSettled(points.map(async (p) => {
        try {
          const response = await fetch(
            `${TDX_BASE_URL}/V3/Map/Bus/Network/Stop/City/Taipei/Nearby/${p.lng}/${p.lat}/${radius}?$format=JSON`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const geoJson = await response.json();
          
          (geoJson?.features ?? []).forEach(f => {
            const props = f.properties || {};
            const coords = f.geometry?.coordinates;
            if (!coords || seenIds.has(props.StopUID)) return;
            
            seenIds.add(props.StopUID);
            allStops.push({
              id: props.StopUID || `${coords[0]}_${coords[1]}`,
              name: props.StopName?.Zh_tw || '',
              nameEn: props.StopName?.En || '',
              routeName: props.RouteName?.Zh_tw || '',
              lng: coords[0],
              lat: coords[1],
            });
          });
        } catch (_) {}
      }));
      return allStops;
    } catch (error) {
      console.error('取得周邊公車站牌失敗:', error);
      return [];
    }
  }
}

export default new TransportService();