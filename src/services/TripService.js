/**
 * TripService - 行程
 *
 * 行程存在手機本機（離線也能編輯）；按「Share」才把快照上傳到後端，換到短代碼。
 * 重新分享會更新同一組代碼，所以連結不會變。
 *
 * 資料結構：
 *   Trip = { id, title, createdAt, updatedAt, shareCode?, days: [{ id, stops: [Stop] }] }
 *   Stop = { id, name, lat, lng, note, time }      // time: 'HH:MM' 或 ''
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';
import { getDeviceId } from './DeviceService';

const KEY = '@taipei/trips';
export const CODE_RE = /[2-9A-HJKMNP-Z]{8}/;

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const emptyDay = () => ({ id: newId(), stops: [] });

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) { return []; }
}
const writeAll = (list) => AsyncStorage.setItem(KEY, JSON.stringify(list));

/** 從貼上的文字（整條連結或代碼）取出分享代碼 */
export function parseShareCode(text) {
  const m = String(text || '').toUpperCase().match(CODE_RE);
  return m ? m[0] : null;
}

async function api(path, { method = 'GET', body } = {}) {
  const deviceId = await getDeviceId();
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (_) {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  let json = null;
  try { json = await res.json(); } catch (_) { /* 非 JSON */ }
  if (!res.ok || !json?.success) throw new Error(json?.message || `Request failed (${res.status})`);
  return json.data;
}

const TripService = {
  list: async () => (await readAll()).sort((a, b) => b.updatedAt - a.updatedAt),

  get: async (id) => (await readAll()).find(t => t.id === id) || null,

  async create(title) {
    const now = Date.now();
    const trip = { id: newId(), title: title.trim() || 'My trip', createdAt: now, updatedAt: now, days: [emptyDay()] };
    await writeAll([...(await readAll()), trip]);
    return trip;
  },

  async save(trip) {
    const all = await readAll();
    const next = { ...trip, updatedAt: Date.now() };
    const i = all.findIndex(t => t.id === trip.id);
    if (i >= 0) all[i] = next; else all.push(next);
    await writeAll(all);
    return next;
  },

  async remove(id) {
    await writeAll((await readAll()).filter(t => t.id !== id));
  },

  /** 上傳快照；回傳 { code, url }，並把代碼記回本機行程 */
  async share(trip) {
    const payload = {
      title: trip.title,
      code: trip.shareCode || undefined,
      days: trip.days.map((d, i) => ({
        label: `Day ${i + 1}`,
        stops: d.stops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng, note: s.note || '', time: s.time || '' })),
      })),
    };
    const out = await api('/api/trips/share', { method: 'POST', body: payload });
    await TripService.save({ ...trip, shareCode: out.code });
    return out;
  },

  async unshare(trip) {
    if (!trip.shareCode) return;
    try { await api(`/api/trips/${trip.shareCode}`, { method: 'DELETE' }); }
    catch (e) { if (!/not found/i.test(e.message)) throw e; }     // 已經不存在就當作成功
    await TripService.save({ ...trip, shareCode: undefined });
  },

  fetchShared: (code) => api(`/api/trips/${code}`),

  /** 把別人分享的行程存成自己的一份 */
  async importShared(shared) {
    const now = Date.now();
    const trip = {
      id: newId(),
      title: shared.title,
      createdAt: now,
      updatedAt: now,
      days: shared.days.map(d => ({
        id: newId(),
        stops: d.stops.map(s => ({ id: newId(), name: s.name, lat: s.lat, lng: s.lng, note: s.note || '', time: s.time || '' })),
      })),
    };
    await writeAll([...(await readAll()), trip]);
    return trip;
  },
};

export default TripService;
