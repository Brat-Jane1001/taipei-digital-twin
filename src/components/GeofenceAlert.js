/**
 * GeofenceAlert - 地理圍欄觸發提示
 * Shows alert when player enters an event's geofence area
 * 
 * 當玩家走到活動100公尺內時，從底部滑出提示卡片
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
} from 'react-native';

export default function GeofenceAlert({ event, onNavigate, onDismiss }) {
  // 動畫值：從底部滑入
  const slideAnim = useRef(new Animated.Value(200)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (event) {
      // 滑入動畫
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // 8秒後自動消失
      const timer = setTimeout(() => {
        dismissAlert();
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [event]);

  const dismissAlert = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 200,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) onDismiss();
    });
  };

  if (!event) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {/* 脈衝指示器 */}
      <View style={styles.pulseIndicator}>
        <Text style={styles.pulseText}>📍 Nearby</Text>
      </View>

      <View style={styles.card}>
        {/* 活動圖片 */}
        <Image
          source={{ uri: event.image }}
          style={styles.eventImage}
          resizeMode="cover"
        />

        {/* 活動資訊 */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.eventLocation} numberOfLines={1}>
            📍 {event.location}
          </Text>
          <Text style={styles.eventTime} numberOfLines={1}>
            ⏰ {event.time}
          </Text>

          {/* 距離標籤 */}
          {event.distance && (
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceText}>
                {event.distance < 0.1
                  ? `${Math.round(event.distance * 1000)}m away`
                  : `${event.distance.toFixed(1)}km away`}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 操作按鈕 */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.navigateButton}
          onPress={() => {
            onNavigate(event);
            dismissAlert();
          }}
        >
          <Text style={styles.navigateText}>Navigate There</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={dismissAlert}
        >
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  pulseIndicator: {
    position: 'absolute',
    top: -14,
    left: 20,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pulseText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    marginTop: 8,
  },
  eventImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  eventInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  eventTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  eventLocation: {
    color: '#8E8E93',
    fontSize: 12,
  },
  eventTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
  distanceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  distanceText: {
    color: '#30D158',
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  navigateButton: {
    flex: 2,
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  navigateText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  dismissText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
});