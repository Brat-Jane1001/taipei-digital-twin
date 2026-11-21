/**
 * EventService - TDX 真實觀光景點與活動串接 (含 Fallback 備援機制)
 */

// 📍 請務必確認這裡有填入你的真實 TDX 金鑰！
const TDX_CLIENT_ID = 'S11255032-8872eaaa-4683-4455';
const TDX_CLIENT_SECRET = 'd326d04e-c017-494d-bb7b-cea593b68eba';
const TDX_BASE_URL = 'https://tdx.transportdata.tw/api/basic';

// 💡 終極備用資料：使用高穩定 CDN 圖庫，確保 Demo 絕不破圖
const FALLBACK_EVENTS = [
  { 
    id: 'F1', title: '西門紅樓', 
    description: '百年紅樓與文創的結合，週末限定市集，充滿在地青年的創意設計與特色手作。', 
    lat: 25.0422, lng: 121.5063, 
    // 利用 seed 產生固定且不同的高畫質示意圖，並提供兩張以展示滑動功能
    images: [
      'https://picsum.photos/seed/redhouse1/800/400',
      'https://picsum.photos/seed/redhouse2/800/400'
    ], 
    websiteUrl: 'https://www.redhouse.taipei/',
    tags: ['歷史', '文創', '市集'], type: 'spot' 
  },
  { 
    id: 'F2', title: '中正紀念堂', 
    description: '台北市最具代表性的歷史地標之一，佔地廣大，是民眾散步與觀賞藝文展演的絕佳去處。', 
    lat: 25.0347, lng: 121.5218, 
    images: ['https://picsum.photos/seed/memorial1/800/400'], 
    websiteUrl: 'https://www.cksmh.gov.tw/',
    tags: ['歷史', '風景', '藝文'], type: 'spot' 
  },
  { 
    id: 'F3', title: '剝皮寮歷史街區', 
    description: '保留了清代完整的街型與傳統店屋，漫步其中彷彿穿越時空，體驗艋舺的昔日風華。', 
    lat: 25.0368, lng: 121.5022, 
    images: ['https://picsum.photos/seed/oldstreet1/800/400'], 
    websiteUrl: 'https://www.bopiliao.taipei/',
    tags: ['歷史', '古蹟', '攝影'], type: 'spot' 
  }
];

class EventService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // 取得 TDX 授權 Token
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
      
      if (!data.access_token) throw new Error('無法取得 Token，請檢查金鑰是否正確');
      
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
      return this.accessToken;
    } catch (error) {
      console.log('❌ TDX Token 取得失敗:', error.message);
      return null;
    }
  }

  // 取得周邊真實景點與活動
  async getAllEvents(lat = 25.0424, lng = 121.5065, radius = 2500) {
    try {
      const token = await this.getAccessToken();
      
      // 如果沒有 Token (可能是金鑰沒填或過期)，直接回傳備用資料
      if (!token) {
        console.log('⚠️ 使用預設備用景點資料 (無 Token)');
        return FALLBACK_EVENTS;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // 同時發送「景點」與「活動」的 API 請求
      const [spotsRes, activitiesRes] = await Promise.all([
        fetch(`${TDX_BASE_URL}/v2/Tourism/ScenicSpot/Taipei?$spatialFilter=nearby(${lat},${lng},${radius})&$top=20&$format=JSON`, { headers }),
        fetch(`${TDX_BASE_URL}/v2/Tourism/Activity/Taipei?$spatialFilter=nearby(${lat},${lng},${radius})&$top=10&$format=JSON`, { headers })
      ]);

      const rawSpots = await spotsRes.json();
      const rawActivities = await activitiesRes.json();

      const safeSpots = Array.isArray(rawSpots) ? rawSpots : [];
      const safeActivities = Array.isArray(rawActivities) ? rawActivities : [];

      // 如果 API 成功但附近剛好完全沒有資料，也啟用備用資料
      if (safeSpots.length === 0 && safeActivities.length === 0) {
        console.log('⚠️ TDX 回傳空陣列，啟動預設備用景點資料');
        return FALLBACK_EVENTS;
      }

      // 💡 修改：將單張圖片改成 images 陣列 (最多抓3張)，並新增 websiteUrl
      const formattedSpots = safeSpots.map(spot => ({
        id: spot.ScenicSpotID,
        title: spot.ScenicSpotName,
        description: spot.DescriptionDetail || spot.Description || '這是一個值得探索的有趣地方。',
        lat: spot.Position?.PositionLat,
        lng: spot.Position?.PositionLon,
        images: [spot.Picture?.PictureUrl1, spot.Picture?.PictureUrl2, spot.Picture?.PictureUrl3].filter(Boolean),
        websiteUrl: spot.WebsiteUrl || null,
        tags: [spot.Class1, spot.Class2, spot.Class3].filter(Boolean),
        type: 'spot'
      }));

      const formattedActivities = safeActivities.map(act => ({
        id: act.ActivityID,
        title: act.ActivityName,
        description: act.Description || '暫無活動描述。',
        lat: act.Position?.PositionLat,
        lng: act.Position?.PositionLon,
        images: [act.Picture?.PictureUrl1, act.Picture?.PictureUrl2, act.Picture?.PictureUrl3].filter(Boolean),
        websiteUrl: act.WebsiteUrl || null,
        tags: ['近期活動', act.Class1, act.Class2].filter(Boolean),
        type: 'activity'
      }));

      const allEvents = [...formattedSpots, ...formattedActivities].filter(event => event.lat && event.lng);
      
      console.log(`✅ 成功載入 ${allEvents.length} 筆真實 TDX 景點資料！`);
      return allEvents.length > 0 ? allEvents : FALLBACK_EVENTS;

    } catch (error) {
      console.log('❌ 取得真實景點資料發生錯誤，啟動備用資料:', error.message);
      return FALLBACK_EVENTS; // 發生任何預期外的錯誤，都確保有假資料可以 Demo
    }
  }
}

export default new EventService();