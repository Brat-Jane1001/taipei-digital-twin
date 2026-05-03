/**
 * EventService - 活動資料服務
 * Event data service
 */

import LocationService from './LocationService.js';

const MOCK_EVENTS = [
  {
    id: 'evt_001',
    title: '🎬 Ximending Film District',
    description: 'The heart of Taipei youth culture. Explore retro cinemas, street performers, and unique shops.',
    location: 'Red House, Ximending',
    lat: 25.0421,
    lng: 121.5067,
    time: 'Daily, Open all day',
    tags: ['culture', 'art'],
    image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800',
  },
  {
    id: 'evt_002',
    title: '🍢 Ximending Street Food',
    description: 'Famous stinky tofu, bubble tea, and grilled skewers along Wuchang Street.',
    location: 'Wuchang St, Ximending',
    lat: 25.0435,
    lng: 121.5078,
    time: 'Daily, 11:00 AM - 11:00 PM',
    tags: ['food', 'nightlife'],
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
  },
  {
    id: 'evt_003',
    title: '🎨 Red House Theater',
    description: 'Historic Japanese-era building now housing indie designers, artists, and weekend markets.',
    location: 'Red House, Ximending',
    lat: 25.0418,
    lng: 121.5063,
    time: 'Tue-Sun, 11:00 AM - 9:30 PM',
    tags: ['art', 'culture', 'history'],
    image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800',
  },
  {
    id: 'evt_004',
    title: '🧋 Chun Shui Tang',
    description: 'The original bubble tea shop. Try the classic tapioca milk tea that started it all.',
    location: 'Zhonghua Rd, Ximending',
    lat: 25.0441,
    lng: 121.5055,
    time: 'Daily, 10:00 AM - 10:00 PM',
    tags: ['food'],
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
  },
  {
    id: 'evt_005',
    title: '🎵 Street Performance Area',
    description: 'Live music, breakdancers, and street artists perform every weekend evening.',
    location: 'Pedestrian Zone, Ximending',
    lat: 25.0428,
    lng: 121.5072,
    time: 'Weekends, 6:00 PM - 10:00 PM',
    tags: ['music', 'culture'],
    image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800',
  },
  {
    id: 'evt_006',
    title: '👟 Sneaker Street',
    description: 'Dozens of shops selling limited edition sneakers, streetwear, and vintage clothing.',
    location: 'Xining S. Rd, Ximending',
    lat: 25.0415,
    lng: 121.5058,
    time: 'Daily, 12:00 PM - 9:00 PM',
    tags: ['culture'],
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
  },
];

class EventService {
  /**
   * 取得所有活動
   */
  async getAllEvents() {
    // 模擬API延遲
    await this.delay(500);
    return MOCK_EVENTS;
  }

  /**
   * 取得附近活動
   */
  async getNearbyEvents(latitude, longitude, radiusKm = 10) {
    const allEvents = await this.getAllEvents();
    
    // 計算距離並過濾
    const nearbyEvents = allEvents
      .map(event => ({
        ...event,
        distance: LocationService.calculateDistance(
          latitude,
          longitude,
          event.lat,
          event.lng
        ),
      }))
      .filter(event => event.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance); // 按距離排序

    return nearbyEvents;
  }

  /**
   * 根據標籤過濾活動
   */
  async getEventsByTags(tags) {
    const allEvents = await this.getAllEvents();
    
    return allEvents.filter(event =>
      event.tags.some(tag => tags.includes(tag))
    );
  }

  /**
   * 取得單一活動詳情
   */
  async getEventById(id) {
    const allEvents = await this.getAllEvents();
    return allEvents.find(event => event.id === id);
  }

  /**
   * AI推薦活動（基於使用者偏好）
   */
  async getRecommendedEvents(userPreferences, userLocation) {
    const allEvents = await this.getAllEvents();
    
    // 計算每個活動的推薦分數
    const scoredEvents = allEvents.map(event => {
      let score = 0;
      
      // 1. 標籤匹配度（50%權重）
      const matchingTags = event.tags.filter(tag => 
        userPreferences.interests?.includes(tag)
      );
      const tagScore = matchingTags.length / Math.max(event.tags.length, 1);
      score += tagScore * 0.5;
      
      // 2. 地理距離（30%權重）
      if (userLocation) {
        const distance = LocationService.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          event.lat,
          event.lng
        );
        const geoScore = Math.max(0, 1 - distance / 10); // 10公里內
        score += geoScore * 0.3;
      }
      
      // 3. 時間緊急度（20%權重）
      // 這裡簡化，實際應該解析event.time
      const timeScore = 0.8;
      score += timeScore * 0.2;
      
      return {
        ...event,
        recommendationScore: score,
      };
    });
    
    // 排序並返回
    return scoredEvents
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 10);
  }

  /**
   * 工具函數：延遲
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new EventService();