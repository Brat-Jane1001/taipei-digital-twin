/**
 * usePlayerLocation - 持續追蹤玩家GPS位置的Custom Hook
 * Continuously tracks player GPS position
 * 
 * 使用方式：
 * const { location, heading, error } = usePlayerLocation();
 */

import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';

export default function usePlayerLocation() {
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [error, setError] = useState(null);
  const watcherRef = useRef(null);
  const headingWatcherRef = useRef(null);

  useEffect(() => {
    startTracking();
    return () => stopTracking(); // 元件卸載時停止追蹤
  }, []);

  const startTracking = async () => {
    try {
      // 請求前景定位權限
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        // 預設位置：台北101
        setLocation({ latitude: 25.0330, longitude: 121.5654 });
        return;
      }

      // 取得初始位置（快速顯示）
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
      });

      // 持續監聽位置變化
      // distanceInterval: 每移動5公尺更新一次
      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5,       // 每5公尺更新
          timeInterval: 3000,        // 最少3秒更新一次
        },
        (newLocation) => {
          setLocation({
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          });
        }
      );

      // 監聽手機朝向（指南針）
      headingWatcherRef.current = await Location.watchHeadingAsync((h) => {
        setHeading(h.trueHeading ?? h.magHeading ?? 0);
      });

    } catch (err) {
      setError(err.message);
      // 出錯時用台北101作為預設
      setLocation({ latitude: 25.0330, longitude: 121.5654 });
    }
  };

  const stopTracking = () => {
    if (watcherRef.current) {
      watcherRef.current.remove();
    }
    if (headingWatcherRef.current) {
      headingWatcherRef.current.remove();
    }
  };

  return { location, heading, error };
}