/**
 * DeviceService - 匿名使用者識別
 *
 * App 沒有登入系統，所以第一次開啟時產生一組隨機 device id，
 * 存在手機裡，後端用它辨識「這是誰發起 / 加入的」。
 * 另外記住使用者填過的暱稱，下次不用再輸入。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const ID_KEY   = "@taipei/device_id";
const NAME_KEY = "@taipei/display_name";

let cachedId = null;

function randomUUID() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getDeviceId() {
  if (cachedId) return cachedId;
  let id = await AsyncStorage.getItem(ID_KEY);
  if (!id) {
    id = randomUUID();
    await AsyncStorage.setItem(ID_KEY, id);
  }
  cachedId = id;
  return id;
}

export async function getDisplayName() {
  return (await AsyncStorage.getItem(NAME_KEY)) || "";
}

export async function setDisplayName(name) {
  await AsyncStorage.setItem(NAME_KEY, name.trim());
}
