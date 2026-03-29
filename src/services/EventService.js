/**
 * EventService - 活動資料服務
 * Event data service
 */

import LocationService from './LocationService.js';

// 模擬活動資料（實際應用中應該從後端API取得）
const MOCK_EVENTS = [
  {
    id: 'evt_001',
    title: '🍜 Shilin Night Market',
    description: 'Traditional Taiwanese street food festival featuring local delicacies, handmade crafts, and live performances.',
    location: 'Shilin District',
    lat: 25.0878,
    lng: 121.5241,
    time: 'Tonight, 6:00 PM - 12:00 AM',
    tags: ['food', 'culture', 'nightlife'],
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
  },
  {
    id: 'evt_002',
    title: '🎵 Huashan Jazz Night',
    description: 'Live jazz performances by local and international artists. Great atmosphere and craft beer available!',
    location: 'Huashan Creative Park',
    lat: 25.0440,
    lng: 121.5297,
    time: 'Tonight, 8:00 PM',
    tags: ['music', 'nightlife', 'culture'],
    image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800',
  },
  {
    id: 'evt_003',
    title: '🏛️ National Palace Museum',
    description: 'Explore 5,000 years of Chinese art and culture. Special exhibition on ancient ceramics.',
    location: 'Shilin District',
    lat: 25.1023,
    lng: 121.5485,
    time: 'Daily, 9:00 AM - 5:00 PM',
    tags: ['culture', 'art', 'history'],
    image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800',
  },
  {
    id: 'evt_004',
    title: '🍲 Ramen Festival',
    description: 'Sample ramen from 20+ vendors. From traditional tonkotsu to creative fusion styles!',
    location: 'Xinyi District',
    lat: 25.0330,
    lng: 121.5654,
    time: 'Tomorrow, 12:00 PM - 8:00 PM',
    tags: ['food', 'festival'],
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
  },
  {
    id: 'evt_005',
    title: '🏃 Taipei City Marathon',
    description: 'Join thousands of runners in this annual marathon. Routes through scenic city landmarks.',
    location: 'Starting at Taipei City Hall',
    lat: 25.0408,
    lng: 121.5655,
    time: 'Sunday, 6:00 AM',
    tags: ['sports', 'outdoor'],
    image: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=800',
  },
  {
    id: 'evt_006',
    title: '🎨 Contemporary Art Exhibition',
    description: 'Featured works from emerging Taiwanese artists exploring urban identity.',
    location: 'Taipei Fine Arts Museum',
    lat: 25.0725,
    lng: 121.5243,
    time: 'This Week, Tue-Sun 9:30 AM - 5:30 PM',
    tags: ['art', 'culture'],
    image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800',
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