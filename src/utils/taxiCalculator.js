// src/utils/taxiCalculator.js

/**
 * 計算台北市計程車預估車資
 * @param {number} distanceInMeters - 總距離（公尺）
 * @returns {number} 預估總車資（新台幣）
 */
export const estimateTaxiFare = (distanceInMeters) => {
  // 台北市計程車現行費率基準
  const BASE_FARE = 85;             // 起跳價 85 元
  const BASE_DISTANCE = 1250;       // 起跳里程 1.25 公里 (1250 公尺)
  const EXTRA_FARE = 5;             // 續程加收 5 元
  const EXTRA_DISTANCE = 200;       // 續程里程 200 公尺
  const TRAFFIC_MULTIPLIER = 1.1;   // 市區塞車延滯金預估係數 (增加 10% 容錯率)

  // 如果距離在起跳里程內，直接回傳起跳價（含塞車係數）
  if (distanceInMeters <= BASE_DISTANCE) {
    return Math.round(BASE_FARE * TRAFFIC_MULTIPLIER);
  }

  // 計算超過起跳里程的部分
  const extraDistance = distanceInMeters - BASE_DISTANCE;
  
  // 計算跳了幾次表 (無條件進位，因為一超過 200m 就跳表)
  const jumps = Math.ceil(extraDistance / EXTRA_DISTANCE);
  
  // 基本總金額
  const totalBaseFare = BASE_FARE + (jumps * EXTRA_FARE);

  // 乘上塞車係數並四捨五入到整數
  return Math.round(totalBaseFare * TRAFFIC_MULTIPLIER);
};