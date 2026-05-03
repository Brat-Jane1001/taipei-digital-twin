/**
 * TransportService - TDX 公車即時位置服務
 * 串接交通部 TDX API 取得台北市公車即時GPS位置
 */

const TDX_CLIENT_ID = 'S11255032-8872eaaa-4683-4455';
const TDX_CLIENT_SECRET = 'd326d04e-c017-494d-bb7b-cea593b68eba';
const TDX_BASE_URL = 'https://tdx.transportdata.tw/api/basic';

class TransportService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * 取得 TDX Access Token
   * Token 有效期約 1 小時，過期自動重新取得
   */
  async getAccessToken() {
    // 如果 token 還有效就直接回傳
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
      // 提早 5 分鐘過期（避免邊界問題）
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
      return this.accessToken;
    } catch (error) {
      console.error('TDX Token error:', error);
      throw error;
    }
  }

  /**
   * 取得台北市公車即時GPS位置（A1資料）
   * 只抓西門町附近的路線：0西、15、49、萬大線等
   */
  async getBusLocations() {
    try {
      const token = await this.getAccessToken();

      // 抓台北市所有公車即時位置
      // $top=200 限制筆數避免資料量太大
      const response = await fetch(
        `${TDX_BASE_URL}/v2/Bus/RealTimeByFrequency/City/Taipei?$top=200&$format=JSON`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();

      // 過濾有 GPS 座標的車輛
      return data
        .filter(bus =>
          bus.BusPosition &&
          bus.BusPosition.PositionLon &&
          bus.BusPosition.PositionLat &&
          bus.DutyStatus === 1 // 只要行駛中的車
        )
        .map(bus => ({
          id: bus.PlateNumb,                          // 車牌
          routeName: bus.RouteName?.Zh_tw || '',      // 路線名稱
          lng: bus.BusPosition.PositionLon,           // 經度
          lat: bus.BusPosition.PositionLat,           // 緯度
          heading: bus.Bearing || 0,                  // 行進方向
          speed: bus.Speed || 0,                      // 速度
        }));

    } catch (error) {
      console.error('Bus location error:', error);
      return [];
    }
  }

  /**
   * 取得台北捷運列車即時位置
   */
  async getMetroLocations() {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(
        `${TDX_BASE_URL}/v2/Rail/Metro/LiveBoard/TRTC?$format=JSON`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      return data.map(train => ({
        id: train.TrainNo,
        lineId: train.LineID,
        stationId: train.StationID,
        direction: train.TripHeadSign,
      }));
    } catch (error) {
      console.error('Metro location error:', error);
      return [];
    }
  }
}

export default new TransportService();