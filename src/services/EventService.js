/**
 * EventService - 活動資料服務
 * 從後端 API 取得真實資料
 */

import LocationService from './LocationService';

// ===== 部署後換成你的 Render URL =====
// 本機測試用：'http://你電腦的IP:3000'
// 部署後用：'https://你的專案名稱.onrender.com'
const API_BASE = 'https://taipei-backend-ib04.onrender.com';

class EventService {

  async getAllEvents() {
    try {
      const res  = await fetch(`${API_BASE}/api/events?active=true`);
      const json = await res.json();
      // 如果後端有資料就用後端的，若後端是空的 []，就無縫採用你精美的本地卡片資料！
      if (json.data && json.data.length > 0) {
        return json.data;
      }
      return FALLBACK_EVENTS;
    } catch (e) {
      console.error('EventService.getAllEvents error:', e);
      return FALLBACK_EVENTS; 
    }
  }

  async getNearbyEvents(latitude, longitude, radiusKm = 10) {
    const all = await this.getAllEvents();
    return all
      .map(ev => ({
        ...ev,
        distance: LocationService.calculateDistance(latitude, longitude, ev.lat, ev.lng),
      }))
      .filter(ev => ev.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }

  async getEventsByTags(tags) {
    const all = await this.getAllEvents();
    return all.filter(ev => ev.tags?.some(t => tags.includes(t)));
  }

  async getEventById(id) {
    try {
      const res  = await fetch(`${API_BASE}/api/events/${id}`);
      const json = await res.json();
      return json.data || null;
    } catch (e) {
      const all = await this.getAllEvents();
      return all.find(ev => ev.id === id);
    }
  }

  async createEvent(eventData) {
    const res  = await fetch(`${API_BASE}/api/events`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(eventData),
    });
    return res.json();
  }

  async updateEvent(id, eventData) {
    const res = await fetch(`${API_BASE}/api/events/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(eventData),
    });
    return res.json();
  }

  async deleteEvent(id) {
    const res = await fetch(`${API_BASE}/api/events/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  }

  async toggleEvent(id) {
    const res = await fetch(`${API_BASE}/api/events/${id}/toggle`, {
      method: 'PATCH',
    });
    return res.json();
  }

  async getRecommendedEvents(userPreferences, userLocation) {
    const all = await this.getAllEvents();
    return all
      .map(ev => {
        let score = 0;
        const matching = ev.tags?.filter(t => userPreferences.interests?.includes(t)) || [];
        score += (matching.length / Math.max(ev.tags?.length || 1, 1)) * 0.5;
        if (userLocation) {
          const dist = LocationService.calculateDistance(
            userLocation.latitude, userLocation.longitude, ev.lat, ev.lng
          );
          score += Math.max(0, 1 - dist / 10) * 0.3;
        }
        score += 0.8 * 0.2;
        return { ...ev, recommendationScore: score };
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 10);
  }
}

// 網路失敗備用資料
const FALLBACK_EVENTS = [
  {
    id: 'evt_001',
    title: '🎬 Ximending Film District',
    description: 'The heart of Taipei youth culture. Explore retro cinemas, street performers, and unique shops.',
    location: 'Red House, Ximending',
    lat: 25.0421, lng: 121.5067,
    time: 'Daily, Open all day',
    tags: ['culture', 'art'],
    image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800',
    active: true,
  },
  {
    id: 'evt_002',
    title: '🍜 Ximending Street Food',
    description: 'Famous stinky tofu, bubble tea, and grilled skewers along Wuchang Street.',
    location: 'Wuchang St, Ximending',
    lat: 25.0440, lng: 121.5050,
    time: 'Daily, 11:00 AM - 11:00 PM',
    tags: ['food', 'nightlife'],
    image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800',
    active: true,
  },
  {
    id: 'evt_003',
    title: '🎨 Red House Theater',
    description: 'Historic Japanese-era building now housing indie designers, artists, and weekend markets.',
    location: 'Red House, Ximending',
    lat: 25.0411, lng: 121.5065,
    time: 'Tue-Sun, 11:00 AM - 9:30 PM',
    tags: ['art', 'culture'],
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800',
    active: true,
  },
  {
    id: 'evt_004',
    title: '👟 Sneaker Street',
    description: 'The ultimate destination for sneakerheads in Taipei with limited editions.',
    location: 'Xining S. Rd, Ximending',
    lat: 25.0432, lng: 121.5055,
    time: 'Daily, 12:00 PM - 9:00 PM',
    tags: ['culture'],
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
    active: true,
  },
  {
    id: 'evt_005',
    title: '🧋 Chun Shui Tang',
    description: 'Originator of bubble milk tea, serving premium tea and traditional Taiwanese dishes.',
    location: 'Zhonghua Rd, Ximending',
    lat: 25.0418, lng: 121.5088,
    time: 'Daily, 10:00 AM - 10:00 PM',
    tags: ['food'],
    image: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=800',
    active: true,
  },
  {
    id: 'evt_006',
    title: '🎵 Street Performance Area',
    description: 'Watch talented local musicians, dancers, and magicians showcase their skills.',
    location: 'Pedestrian Zone, Ximending',
    lat: 25.0425, lng: 121.5060,
    time: 'Weekends, 6:00 PM - 10:00 PM',
    tags: ['music', 'culture'],
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
    active: true,
  }
];
export default new EventService();