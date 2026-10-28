/**
 * MeetupService - 組隊 API
 * 每個請求都會帶 x-device-id，後端靠它判斷發起者 / 參加者
 */
import { API_BASE } from "../config";
import { getDeviceId } from "./DeviceService";

async function request(path, { method = "GET", body } = {}) {
  const deviceId = await getDeviceId();
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }

  let json = null;
  try { json = await res.json(); } catch (_) { /* 不是 JSON */ }

  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `Request failed (${res.status})`);
  }
  return json.data;
}

const MeetupService = {
  // 已核准、還沒開始的組隊
  list: () => request("/api/meetups"),

  // 我發起的（含審核中 / 被拒絕）與我加入的
  mine: () => request("/api/meetups/mine"),

  // 詳情，含參加者名單
  get: (id) => request(`/api/meetups/${id}`),

  // 發起組隊，送出後等管理員核准
  create: (payload) => request("/api/meetups", { method: "POST", body: payload }),

  // +1
  join: (id, displayName) =>
    request(`/api/meetups/${id}/join`, { method: "POST", body: { display_name: displayName } }),

  leave:  (id) => request(`/api/meetups/${id}/leave`,  { method: "POST" }),
  cancel: (id) => request(`/api/meetups/${id}/cancel`, { method: "POST" }),
};

export default MeetupService;
