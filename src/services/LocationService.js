/**
 * LocationService - GPS定位服務
 * GPS location service
 */

import * as Location from 'expo-location';

class LocationService {
  constructor() {
    this.currentLocation = null;
  }

  async initialize() {
    try {
      // 請求定位權限
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.warn('❌ Location permission denied');
        // 使用台北101作為預設位置
        this.currentLocation = {
          latitude: 25.0330,
          longitude: 121.5654,
        };
        return this.currentLocation;
      }

      // 取得當前位置
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      this.currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      console.log('📍 Location initialized:', this.currentLocation);
      return this.currentLocation;

    } catch (error) {
      console.error('❌ Location initialization error:', error);
      // 失敗時使用台北101作為預設
      this.currentLocation = {
        latitude: 25.0330,
        longitude: 121.5654,
      };
      return this.currentLocation;
    }
  }

  async getCurrentPosition() {
    if (!this.currentLocation) {
      return await this.initialize();
    }
    return this.currentLocation;
  }

  /**
   * 計算兩點間的距離（公里）
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半徑（公里）
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
      Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * 將經緯度轉換為What3Words格式（模擬）
   */
  async toWhat3Words(lat, lng) {
    // 實際應用中應該呼叫What3Words API
    // 這裡用簡化的模擬版本
    const words = ['index', 'home', 'raft', 'filled', 'count', 'soap', 'planet', 'jumps', 'laptop'];
    const w1 = words[Math.floor(lat * 10) % words.length];
    const w2 = words[Math.floor(lng * 10) % words.length];
    const w3 = words[Math.floor((lat + lng) * 10) % words.length];
    
    return `${w1}.${w2}.${w3}`;
  }
}

export default new LocationService();