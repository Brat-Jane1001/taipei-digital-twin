/**
 * LocateButton - 定位按鈕
 * Google Maps-style locate button
 *
 * 兩種模式：
 * 1. 探索模式：按下去飛回真實GPS位置，準備導航
 * 2. 已定位：顯示藍色，表示目前跟隨真實位置
 */

import React, { useRef } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  View,
  Text,
} from 'react-native';

export default function LocateButton({ onPress, isLocating }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 按下動畫
  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    if (onPress) onPress();
  };

  return (
    <View style={styles.wrapper}>
      {/* 定位中的脈衝動畫圈 */}
      {isLocating && (
        <Animated.View
          style={[
            styles.pulse,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
      )}

      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[
            styles.button,
            isLocating && styles.buttonActive,
          ]}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          {/* 小人圖示 */}
          <Text style={styles.icon}>🧍</Text>

          {/* 定位中的藍點 */}
          {isLocating && <View style={styles.activeDot} />}
        </TouchableOpacity>
      </Animated.View>

      {/* 說明文字（第一次使用時顯示） */}
      <View style={styles.tooltip}>
        <Text style={styles.tooltipText}>
          {isLocating ? 'Your location' : 'Go to my location'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  pulse: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    top: -4,
    left: -4,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  buttonActive: {
    backgroundColor: '#EBF4FF',
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  icon: {
    fontSize: 22,
  },
  activeDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4A90E2',
    borderWidth: 2,
    borderColor: 'white',
  },
  tooltip: {
    marginTop: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tooltipText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
  },
});