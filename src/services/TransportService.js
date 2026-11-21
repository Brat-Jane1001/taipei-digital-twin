/**
 * TransportService - TDX 公車即時位置與站牌服務
 */

const TDX_CLIENT_ID = 'S11255032-8872eaaa-4683-4455';
const TDX_CLIENT_SECRET = 'd326d04e-c017-494d-bb7b-cea593b68eba';
const TDX_BASE_URL = 'https://tdx.transportdata.tw/api/basic';

class TransportService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

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

  async getMultipleNearbyBusStops(points, radius = 1000) {
    try {
      const token = await this.getAccessToken();
      const allStops = [];
      const seenIds = new Set();

      await Promise.allSettled(points.map(async (p) => {
        try {
          const response = await fetch(
            `${TDX_BASE_URL}/v2/Bus/Stop/City/Taipei?$spatialFilter=nearby(${p.lat},${p.lng},${radius})&$format=JSON`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const data = await response.json();
          
          (data || []).forEach(stop => {
            const stopId = stop.StopUID;
            if (!stopId || seenIds.has(stopId)) return;
            seenIds.add(stopId);
            
            allStops.push({
              id: stopId,
              name: stop.StopName?.Zh_tw || '',
              nameEn: stop.StopName?.En || '',
              lat: stop.StopPosition?.PositionLat,
              lng: stop.StopPosition?.PositionLon,
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

  // 💡 【修正點】同時抓取台北與新北的資料，並且加入陣列防錯檢查
  async getBusStopETA(stopId) {
    try {
      const token = await this.getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      // 同時發送雙北請求，因為邊界站牌常有新北市公車
      const [tpeRes, ntpcRes] = await Promise.all([
        fetch(`${TDX_BASE_URL}/v2/Bus/EstimatedTimeOfArrival/City/Taipei?$filter=StopUID eq '${stopId}'&$format=JSON`, { headers }),
        fetch(`${TDX_BASE_URL}/v2/Bus/EstimatedTimeOfArrival/City/NewTaipei?$filter=StopUID eq '${stopId}'&$format=JSON`, { headers })
      ]);

      const tpeData = await tpeRes.json();
      const ntpcData = await ntpcRes.json();

      // 安全檢查：確定回傳的是陣列，才不會觸發 undefined filter 錯誤
      const safeTpe = Array.isArray(tpeData) ? tpeData : [];
      const safeNtpc = Array.isArray(ntpcData) ? ntpcData : [];
      const allData = [...safeTpe, ...safeNtpc];

      // 去重複：同一個公車路線可能會有多台車進站，我們只抓最近的那台
      const routeMap = new Map();
      allData.forEach(item => {
        const routeName = item.RouteName?.Zh_tw;
        if (!routeName) return;

        const current = routeMap.get(routeName);
        if (!current) {
          routeMap.set(routeName, item);
        } else if (item.EstimateTime != null && current.EstimateTime != null) {
          if (item.EstimateTime < current.EstimateTime) routeMap.set(routeName, item);
        } else if (item.EstimateTime != null) {
          routeMap.set(routeName, item);
        }
      });

      return Array.from(routeMap.values())
        .map(item => ({
          routeName: item.RouteName.Zh_tw,
          estimateTime: item.EstimateTime,
          status: item.StopStatus 
        }))
        .sort((a, b) => {
          if (a.status !== 0 && b.status === 0) return 1;
          if (a.status === 0 && b.status !== 0) return -1;
          return (a.estimateTime || 9999) - (b.estimateTime || 9999);
        });
    } catch (error) {
      console.error('取得公車ETA失敗:', error);
      return [];
    }
  }
}

export default new TransportService();