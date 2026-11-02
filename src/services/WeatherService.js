/**
 * WeatherService - Open-Meteo（不需要金鑰）
 *
 * - 預報與空氣品質各一個請求，並行取得
 * - 每個地點的結果存在手機 15 分鐘：切換地點時先秒開舊資料，再背景更新
 * - 地點搜尋用 Open-Meteo Geocoding
 * 資料來源要標示：Weather data by Open-Meteo.com（CC BY 4.0）
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalize, DEFAULT_UNITS } from '../utils/weather';

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const AIR      = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEO      = 'https://geocoding-api.open-meteo.com/v1/search';

const TTL        = 15 * 60 * 1000;
const LOC_KEY    = '@taipei/weather_locations';
const UNIT_KEY   = '@taipei/weather_units';
const cacheKey   = (lat, lng) => `@taipei/wx/${lat.toFixed(2)},${lng.toFixed(2)}`;

export const DEFAULT_LOCATIONS = [
  { id: 'taipei', name: 'Taipei', sub: 'Taiwan', lat: 25.0478, lng: 121.5319 },
];

async function getJson(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Weather service error (${res.status})`);
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The weather service took too long to answer.');
    if (e instanceof TypeError) throw new Error('Cannot reach the weather service. Check your connection.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFresh(lat, lng) {
  const base = `latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&timezone=auto`;
  const forecastUrl = `${FORECAST}?${base}&forecast_days=10&wind_speed_unit=kmh`
    + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
    + '&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,weather_code,visibility,wind_speed_10m,wind_gusts_10m,uv_index,is_day'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max'
    + '&minutely_15=precipitation&forecast_minutely_15=8';
  const airUrl = `${AIR}?${base}&forecast_days=2`
    + '&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide'
    + '&hourly=us_aqi';

  // 「未來 2 小時每 15 分鐘降雨」是加分項：如果這個參數被拒絕，就不帶它再試一次
  const forecast = getJson(forecastUrl).catch(async (e) => {
    if (!/\(400\)/.test(e.message)) throw e;
    return getJson(forecastUrl.replace('&minutely_15=precipitation&forecast_minutely_15=8', ''));
  });

  // 空品失敗不應該讓整個天氣畫面失敗
  const [wx, aq] = await Promise.all([forecast, getJson(airUrl).catch(() => null)]);
  return normalize(wx, aq);
}

const WeatherService = {
  /**
   * 先回傳快取（若有），再回傳最新資料。
   * @param onUpdate  (weather, { fromCache }) => void
   * @returns 最終資料；網路失敗但有舊資料時回傳舊資料並標記 stale
   */
  async load(lat, lng, onUpdate, { force = false } = {}) {
    let cached = null;
    try {
      const raw = await AsyncStorage.getItem(cacheKey(lat, lng));
      if (raw) cached = JSON.parse(raw);
    } catch (_) { /* 忽略壞掉的快取 */ }

    if (cached && !force && Date.now() - cached.fetchedAt < TTL) {
      onUpdate?.(cached, { fromCache: true, stale: false });
      return cached;
    }
    if (cached) onUpdate?.(cached, { fromCache: true, stale: true });

    try {
      const fresh = await fetchFresh(lat, lng);
      AsyncStorage.setItem(cacheKey(lat, lng), JSON.stringify(fresh)).catch(() => {});
      onUpdate?.(fresh, { fromCache: false, stale: false });
      return fresh;
    } catch (e) {
      if (cached) return cached;      // 離線時維持顯示舊資料
      throw e;
    }
  },

  async search(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const j = await getJson(`${GEO}?name=${encodeURIComponent(q)}&count=8&language=en&format=json`);
    return (j.results || []).map(r => ({
      id: `g${r.id}`,
      name: r.name,
      sub: [r.admin1, r.country].filter(Boolean).join(', '),
      lat: r.latitude,
      lng: r.longitude,
    }));
  },

  async getLocations() {
    try {
      const raw = await AsyncStorage.getItem(LOC_KEY);
      const list = raw ? JSON.parse(raw) : null;
      return Array.isArray(list) && list.length ? list : DEFAULT_LOCATIONS;
    } catch (_) { return DEFAULT_LOCATIONS; }
  },
  saveLocations: (list) => AsyncStorage.setItem(LOC_KEY, JSON.stringify(list)).catch(() => {}),

  async getUnits() {
    try {
      const raw = await AsyncStorage.getItem(UNIT_KEY);
      return { ...DEFAULT_UNITS, ...(raw ? JSON.parse(raw) : {}) };
    } catch (_) { return DEFAULT_UNITS; }
  },
  saveUnits: (u) => AsyncStorage.setItem(UNIT_KEY, JSON.stringify(u)).catch(() => {}),
};

export default WeatherService;
