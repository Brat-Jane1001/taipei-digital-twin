import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

export default function WeatherWidget() {
  // 存放天氣資料與載入狀態的 State
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 呼叫 Open-Meteo API (已設定為台北市信義區的經緯度)
    const fetchWeather = async () => {
      try {
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=25.0330&longitude=121.5654&current_weather=true');
        const data = await response.json();
        setWeather(data.current_weather);
      } catch (error) {
        console.error("天氣獲取失敗:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, []);

  // 將 API 回傳的國際天氣代碼 (WMO Code) 轉換成 Emoji 圖示
  const getWeatherIcon = (code) => {
    if (code === 0) return '☀️'; // 晴朗
    if (code >= 1 && code <= 3) return '⛅'; // 多雲
    if (code >= 45 && code <= 48) return '🌫️'; // 霧
    if (code >= 51 && code <= 67) return '🌧️'; // 陣雨
    if (code >= 71 && code <= 77) return '❄️'; // 雪
    return '🌤️'; // 預設
  };

  // 如果還在載入中，顯示轉圈圈動畫
  if (loading) {
    return (
      <View style={styles.widgetContainer}>
        <ActivityIndicator color="#4A90E2" />
      </View>
    );
  }

  // 如果載入失敗或沒資料，就不顯示
  if (!weather) return null;

  return (
    <View style={styles.widgetContainer}>
      <Text style={styles.weatherIcon}>{getWeatherIcon(weather.weathercode)}</Text>
      <View style={styles.textGroup}>
        <Text style={styles.tempText}>{Math.round(weather.temperature)}°C</Text>
        <Text style={styles.cityText}>台北市</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  widgetContainer: {
    position: 'absolute',
    top: 60, // 避開手機螢幕上方的瀏海/動態島
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.85)', // 與你的右側按鈕風格保持一致
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    gap: 12,
    zIndex: 90, // 確保浮在地圖上方
  },
  weatherIcon: {
    fontSize: 26,
  },
  textGroup: {
    justifyContent: 'center',
  },
  tempText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cityText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
