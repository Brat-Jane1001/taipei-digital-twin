/**
 * weather.js - 天氣資料的純函式（單位換算、代碼對照、月相、提醒）
 * 不依賴 React，方便單獨測試。
 */

// ───────── WMO 天氣代碼 ─────────
const WMO = {
  0:  ['Clear',                 '☀️', '🌙', 'clear'],
  1:  ['Mostly clear',          '🌤️', '🌙', 'clear'],
  2:  ['Partly cloudy',         '⛅', '☁️', 'cloud'],
  3:  ['Overcast',              '☁️', '☁️', 'cloud'],
  45: ['Fog',                   '🌫️', '🌫️', 'fog'],
  48: ['Freezing fog',          '🌫️', '🌫️', 'fog'],
  51: ['Light drizzle',         '🌦️', '🌧️', 'rain'],
  53: ['Drizzle',               '🌦️', '🌧️', 'rain'],
  55: ['Heavy drizzle',         '🌧️', '🌧️', 'rain'],
  56: ['Freezing drizzle',      '🌧️', '🌧️', 'rain'],
  57: ['Freezing drizzle',      '🌧️', '🌧️', 'rain'],
  61: ['Light rain',            '🌦️', '🌧️', 'rain'],
  63: ['Rain',                  '🌧️', '🌧️', 'rain'],
  65: ['Heavy rain',            '🌧️', '🌧️', 'rain'],
  66: ['Freezing rain',         '🌧️', '🌧️', 'rain'],
  67: ['Freezing rain',         '🌧️', '🌧️', 'rain'],
  71: ['Light snow',            '🌨️', '🌨️', 'snow'],
  73: ['Snow',                  '❄️', '❄️', 'snow'],
  75: ['Heavy snow',            '❄️', '❄️', 'snow'],
  77: ['Snow grains',           '❄️', '❄️', 'snow'],
  80: ['Light showers',         '🌦️', '🌧️', 'rain'],
  81: ['Showers',               '🌧️', '🌧️', 'rain'],
  82: ['Violent showers',       '⛈️', '⛈️', 'storm'],
  85: ['Snow showers',          '🌨️', '🌨️', 'snow'],
  86: ['Heavy snow showers',    '🌨️', '🌨️', 'snow'],
  95: ['Thunderstorm',          '⛈️', '⛈️', 'storm'],
  96: ['Thunderstorm, hail',    '⛈️', '⛈️', 'storm'],
  99: ['Thunderstorm, hail',    '⛈️', '⛈️', 'storm'],
};

export function describeCode(code, isDay = true) {
  const e = WMO[code] || ['Unknown', '❔', '❔', 'cloud'];
  return { label: e[0], icon: isDay ? e[1] : e[2], kind: e[3] };
}

// 依天氣種類與日夜決定背景漸層（自己的配色，不沿用任何現有天氣 App）
const SKY = {
  clear: { day: ['#0e5a8a', '#2f9ad0'], night: ['#0a1130', '#1b2a5c'] },
  cloud: { day: ['#2f4a63', '#5d7f9c'], night: ['#111a2c', '#283a55'] },
  rain:  { day: ['#1b3040', '#3c5b70'], night: ['#0d1822', '#233646'] },
  storm: { day: ['#241d3d', '#4a3d70'], night: ['#120e22', '#2e2550'] },
  snow:  { day: ['#4a5d70', '#8da2b5'], night: ['#1c2636', '#3a4a60'] },
  fog:   { day: ['#4b5560', '#85909b'], night: ['#1a1f27', '#383f49'] },
};
export function skyColors(kind, isDay) {
  return (SKY[kind] || SKY.cloud)[isDay ? 'day' : 'night'];
}

// ───────── 單位 ─────────
export const DEFAULT_UNITS = { temp: 'C', wind: 'kmh' };

export const toTemp  = (c, u) => (c == null ? null : u === 'F' ? c * 9 / 5 + 32 : c);
export const fmtTemp = (c, u, withUnit = false) =>
  c == null ? '–' : `${Math.round(toTemp(c, u))}°${withUnit ? u : ''}`;

export function windValue(kmh, unit) {
  if (kmh == null) return null;
  if (unit === 'ms')  return kmh / 3.6;
  if (unit === 'mph') return kmh / 1.609344;
  return kmh;
}
export const WIND_UNIT_LABEL = { kmh: 'km/h', ms: 'm/s', mph: 'mph' };
export const fmtWind = (kmh, unit) => {
  const v = windValue(kmh, unit);
  return v == null ? '–' : `${unit === 'ms' ? v.toFixed(1) : Math.round(v)} ${WIND_UNIT_LABEL[unit]}`;
};

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (deg) => (deg == null ? '' : COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]);

// ───────── UV / 空品 ─────────
export function uvLevel(uv) {
  if (uv == null) return { label: '–', color: '#94a3b8' };
  if (uv < 3)  return { label: 'Low',       color: '#4ade80' };
  if (uv < 6)  return { label: 'Moderate',  color: '#facc15' };
  if (uv < 8)  return { label: 'High',      color: '#fb923c' };
  if (uv < 11) return { label: 'Very high', color: '#f87171' };
  return { label: 'Extreme', color: '#c084fc' };
}

// 美國 AQI 分級（Open-Meteo 的 us_aqi）
export const AQI_BANDS = [
  { max: 50,       label: 'Good',                color: '#4ade80' },
  { max: 100,      label: 'Moderate',            color: '#facc15' },
  { max: 150,      label: 'Unhealthy for some',  color: '#fb923c' },
  { max: 200,      label: 'Unhealthy',           color: '#f87171' },
  { max: 300,      label: 'Very unhealthy',      color: '#c084fc' },
  { max: Infinity, label: 'Hazardous',           color: '#b91c1c' },
];
export function aqiLevel(aqi) {
  if (aqi == null) return { label: '–', color: '#94a3b8' };
  return AQI_BANDS.find(b => aqi <= b.max);
}

// ───────── 日月 ─────────
const SYNODIC = 29.530588853;
const NEW_MOON_JD = 2451550.1;      // 2000-01-06 18:14 UTC

export function moonPhase(date = new Date()) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const p = (((jd - NEW_MOON_JD) / SYNODIC) % 1 + 1) % 1;       // 0..1
  const illumination = (1 - Math.cos(2 * Math.PI * p)) / 2;
  const names = [
    ['New moon', '🌑'], ['Waxing crescent', '🌒'], ['First quarter', '🌓'], ['Waxing gibbous', '🌔'],
    ['Full moon', '🌕'], ['Waning gibbous', '🌖'], ['Last quarter', '🌗'], ['Waning crescent', '🌘'],
  ];
  const [label, icon] = names[Math.floor(p * 8 + 0.5) % 8];
  return { phase: p, illumination, label, icon };
}

/** 日出日落的弧線進度 0..1（< 0 還沒日出，> 1 已日落）*/
export function sunProgress(now, sunrise, sunset) {
  const a = new Date(sunrise).getTime(), b = new Date(sunset).getTime();
  if (!(b > a)) return 0;
  return (now.getTime() - a) / (b - a);
}

export function daylight(sunrise, sunset) {
  const mins = Math.round((new Date(sunset) - new Date(sunrise)) / 60000);
  if (!Number.isFinite(mins) || mins <= 0) return '–';
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

// ───────── 資料整理 ─────────
/** Open-Meteo 的時間字串是「該地點當地時間」，不能直接丟給 Date 當成本機時間 */
export const hourOf = (iso) => parseInt(iso.slice(11, 13), 10);
export const hhmm = (iso) => iso.slice(11, 16);

/** 找出「目前這一小時」在 hourly.time 裡的位置（用當地時間字串比對）*/
export function currentHourIndex(hourlyTimes, currentTime) {
  const key = currentTime.slice(0, 13);
  const i = hourlyTimes.findIndex(t => t.slice(0, 13) === key);
  return i < 0 ? 0 : i;
}

/**
 * 把 Open-Meteo 的原始回應整理成畫面要用的結構。
 * @param wx  forecast API 回應
 * @param aq  air-quality API 回應（可為 null）
 */
export function normalize(wx, aq) {
  const h = wx.hourly, d = wx.daily, c = wx.current;
  const start = currentHourIndex(h.time, c.time);
  const hours = [];
  for (let i = start; i < Math.min(start + 24, h.time.length); i++) {
    hours.push({
      time: h.time[i],
      temp: h.temperature_2m[i],
      feels: h.apparent_temperature[i],
      pop: h.precipitation_probability?.[i] ?? null,
      precip: h.precipitation[i] ?? 0,
      code: h.weather_code[i],
      isDay: h.is_day?.[i] === 1,
      wind: h.wind_speed_10m[i],
      gust: h.wind_gusts_10m?.[i] ?? null,
      uv: h.uv_index?.[i] ?? null,
    });
  }

  const days = d.time.map((t, i) => ({
    date: t,
    code: d.weather_code[i],
    max: d.temperature_2m_max[i],
    min: d.temperature_2m_min[i],
    pop: d.precipitation_probability_max?.[i] ?? null,
    precip: d.precipitation_sum?.[i] ?? 0,
    uv: d.uv_index_max?.[i] ?? null,
    wind: d.wind_speed_10m_max?.[i] ?? null,
    sunrise: d.sunrise[i],
    sunset: d.sunset[i],
  }));

  let air = null;
  if (aq?.current) {
    const ac = aq.current;
    const ah = aq.hourly;
    const ai = ah ? currentHourIndex(ah.time, ac.time) : 0;
    air = {
      aqi: ac.us_aqi ?? null,
      pm25: ac.pm2_5 ?? null,
      pm10: ac.pm10 ?? null,
      o3: ac.ozone ?? null,
      no2: ac.nitrogen_dioxide ?? null,
      so2: ac.sulphur_dioxide ?? null,
      co: ac.carbon_monoxide ?? null,
      hourly: ah ? ah.time.slice(ai, ai + 24).map((t, k) => ({ time: t, aqi: ah.us_aqi?.[ai + k] ?? null })) : [],
    };
  }

  return {
    fetchedAt: Date.now(),
    timezone: wx.timezone,
    utcOffsetSeconds: wx.utc_offset_seconds,
    current: {
      time: c.time,
      temp: c.temperature_2m,
      feels: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      code: c.weather_code,
      isDay: c.is_day === 1,
      cloud: c.cloud_cover,
      pressure: c.pressure_msl,
      wind: c.wind_speed_10m,
      windDir: c.wind_direction_10m,
      gust: c.wind_gusts_10m,
      precip: c.precipitation,
      uv: h.uv_index?.[start] ?? null,
      dew: h.dew_point_2m?.[start] ?? null,
      visibility: h.visibility?.[start] ?? null,
    },
    nextHours: (wx.minutely_15?.precipitation || []).slice(0, 8),
    hours,
    days,
    air,
  };
}

/**
 * 依預報數值產生提醒。這不是官方警報，畫面上要標明。
 */
export function deriveNotices(w) {
  const out = [];
  const next12 = w.hours.slice(0, 12);

  const maxRain = Math.max(0, ...next12.map(x => x.precip));
  const maxPop  = Math.max(0, ...next12.map(x => x.pop ?? 0));
  if (maxRain >= 10)      out.push({ id: 'rain-heavy', icon: '🌧️', text: 'Very heavy rain possible in the next 12 hours', level: 'high' });
  else if (maxRain >= 4)  out.push({ id: 'rain',       icon: '🌧️', text: 'Heavy rain possible in the next 12 hours', level: 'mid' });
  else if (maxPop >= 70)  out.push({ id: 'rain-likely', icon: '☔', text: 'Rain is likely in the next 12 hours', level: 'low' });

  if (next12.some(x => x.code >= 95)) out.push({ id: 'storm', icon: '⛈️', text: 'Thunderstorms possible', level: 'high' });

  const gust = Math.max(w.current.gust ?? 0, ...next12.map(x => x.gust ?? 0));
  if (gust >= 75)      out.push({ id: 'wind-high', icon: '💨', text: `Very strong gusts up to ${Math.round(gust)} km/h`, level: 'high' });
  else if (gust >= 55) out.push({ id: 'wind',      icon: '💨', text: `Strong gusts up to ${Math.round(gust)} km/h`, level: 'mid' });

  const uv = Math.max(0, w.days[0]?.uv ?? 0);
  if (uv >= 8) out.push({ id: 'uv', icon: '🕶️', text: `${uvLevel(uv).label} UV today (${Math.round(uv)}). Use sun protection`, level: uv >= 11 ? 'high' : 'mid' });

  const maxT = Math.max(w.current.temp ?? -99, w.days[0]?.max ?? -99);
  if (maxT >= 35) out.push({ id: 'heat', icon: '🥵', text: `Hot today, up to ${Math.round(maxT)}°C. Drink water and rest in the shade`, level: 'mid' });
  if ((w.current.temp ?? 99) <= 8) out.push({ id: 'cold', icon: '🥶', text: 'Cold right now. Dress warmly', level: 'mid' });

  if (w.air?.aqi != null && w.air.aqi > 100) {
    out.push({ id: 'aqi', icon: '😷', text: `Air quality: ${aqiLevel(w.air.aqi).label} (AQI ${Math.round(w.air.aqi)})`, level: w.air.aqi > 150 ? 'high' : 'mid' });
  }
  return out;
}

/** 未來幾小時的降雨一句話摘要 */
export function rainSummary(w) {
  const mins = w.nextHours;
  if (mins.length) {
    const wet = mins.findIndex(v => v >= 0.1);
    if (wet === 0) return 'Raining now';
    if (wet > 0)   return `Rain starting in about ${wet * 15} min`;
  }
  const i = w.hours.slice(0, 12).findIndex(h => h.precip >= 0.2 || (h.pop ?? 0) >= 60);
  if (i === 0) return w.current.precip > 0 ? 'Raining now' : 'Rain is likely this hour';
  if (i > 0)   return `Rain likely around ${hhmm(w.hours[i].time)}`;
  return 'No rain expected in the next 12 hours';
}
