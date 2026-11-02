/**
 * BusService - 公車路線與即時位置（資料來自你的後端，不直接打 TDX）
 *
 * - 路線清單：存在手機 12 小時，開啟鍵盤時先用快取，過期才重抓
 * - 即時位置：後端有 15 秒快取，所以這裡每 15 秒問一次就好
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';

const ROUTES_KEY = '@taipei/bus_routes_v1';
const ROUTES_TTL = 12 * 3600 * 1000;

async function getJson(path, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal });
    let json = null;
    try { json = await res.json(); } catch (_) { /* 非 JSON */ }
    if (!res.ok || !json?.success) throw new Error(json?.message || `Request failed (${res.status})`);
    return json;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The server took too long to answer. Try again.');
    if (e instanceof TypeError) throw new Error('Cannot reach the server. Check your connection.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const BusService = {
  /** @returns {Promise<{routes: Array, fromCache: boolean}>} */
  async getRoutes() {
    let cached = null;
    try {
      const raw = await AsyncStorage.getItem(ROUTES_KEY);
      if (raw) cached = JSON.parse(raw);
    } catch (_) { /* 快取壞掉就忽略 */ }

    if (cached?.data?.length && Date.now() - cached.at < ROUTES_TTL) {
      return { routes: cached.data, fromCache: true };
    }
    try {
      const json = await getJson('/api/bus/routes', 30000);
      AsyncStorage.setItem(ROUTES_KEY, JSON.stringify({ at: Date.now(), data: json.data })).catch(() => {});
      return { routes: json.data, fromCache: false };
    } catch (e) {
      if (cached?.data?.length) return { routes: cached.data, fromCache: true };   // 離線也能用舊清單
      throw e;
    }
  },

  /** @returns {Promise<{buses: Array, fetchedAt: string, ttl: number, stale: boolean}>} */
  async live(city, route) {
    const json = await getJson(
      `/api/bus/live?city=${encodeURIComponent(city)}&route=${encodeURIComponent(route)}`
    );
    return { buses: json.data.buses, fetchedAt: json.data.fetched_at, ttl: json.data.ttl, stale: json.data.stale };
  },
};

export default BusService;
