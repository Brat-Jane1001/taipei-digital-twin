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
      return json.data || [];
    } catch (e) {
      console.error('EventService.getAllEvents error:', e);
      return FALLBACK_EVENTS; // 網路失敗時用備用資料
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
    description: 'The heart of Taipei youth culture.',
    location: 'Red House, Ximending',
    lat: 25.0421, lng: 121.5067,
    time: 'Daily, Open all day',
    tags: ['culture', 'art'],
    image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800',
    active: true,
  },
];

export default new EventService();