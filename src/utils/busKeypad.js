/**
 * busKeypad - 公車路線鍵盤邏輯（純函式，不依賴 React）
 *
 * 路線名稱來自 API（例如 905、綠5、紅30、市民小巴1、F211、307莒光），
 * 鍵盤上有哪些鍵、哪些可以按，全部由「目前輸入」與路線清單推出來：
 *   - 數字鍵：只有接在目前輸入後面真的存在的才亮
 *   - 文字鍵（綠、紅、小、幹線…）：取路線名稱中「連續非數字」的片段
 *     所以 綠 + 5 = 綠5；905 後面如果有「905區」，會冒出「區」這個鍵
 */

const DIGIT = /[0-9]/;

/** 路線名稱的自然排序：先比文字前綴，再比數字大小，最後比後綴 */
export function compareRouteNames(a, b) {
  const pa = a.match(/^(\D*)(\d*)(.*)$/);
  const pb = b.match(/^(\D*)(\d*)(.*)$/);
  if (pa[1] !== pb[1]) return pa[1].localeCompare(pb[1], 'zh-Hant');
  const na = pa[2] === '' ? -1 : parseInt(pa[2], 10);
  const nb = pb[2] === '' ? -1 : parseInt(pb[2], 10);
  if (na !== nb) return na - nb;
  return pa[3].localeCompare(pb[3], 'zh-Hant');
}

/**
 * @param routes  [{ n, c, f, t }]
 * @param input   目前輸入，例如 '' / '綠' / '905'
 * @returns { digits:Set<string>, chunks:[{text,count}], matches:[route] }
 */
export function analyze(routes, input) {
  const digits = new Set();
  const chunkCount = new Map();
  const matches = [];

  for (const r of routes) {
    const name = r.n;
    if (!name.startsWith(input)) continue;
    matches.push(r);

    const rest = name.slice(input.length);
    if (!rest) continue;
    if (DIGIT.test(rest[0])) {
      digits.add(rest[0]);
    } else {
      const chunk = rest.match(/^[^0-9]+/)[0];
      chunkCount.set(chunk, (chunkCount.get(chunk) || 0) + 1);
    }
  }

  const chunks = [...chunkCount.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'zh-Hant'));

  matches.sort((a, b) => {
    // 完全符合的排最前面
    if ((a.n === input) !== (b.n === input)) return a.n === input ? -1 : 1;
    const d = compareRouteNames(a.n, b.n);
    return d !== 0 ? d : (a.c === 'Taipei' ? 0 : 1) - (b.c === 'Taipei' ? 0 : 1);
  });

  return { digits, chunks, matches };
}

/** 退格：數字一次刪一位；文字片段（綠、市民小巴…）整段刪掉 */
export function backspace(input) {
  if (!input) return '';
  if (DIGIT.test(input[input.length - 1])) return input.slice(0, -1);
  return input.replace(/[^0-9]+$/, '');
}

export const CITY_LABEL = { Taipei: '台北', NewTaipei: '新北' };
