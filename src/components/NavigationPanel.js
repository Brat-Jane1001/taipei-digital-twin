/**
 * NavigationPanel - Apple地圖風格導航面板
 * Apple Maps-style navigation bottom panel
 * 
 * 顯示：
 * - 下一步轉彎指示
 * - ETA / 距離 / 步行模式
 * - 目標活動資訊
 * - End Route / Overview 按鈕
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import * as Speech from 'expo-speech';
import NavigationService from '../services/NavigationService';

export default function NavigationPanel({
  route,           // 路線資料（來自NavigationService）
  currentLocation, // 目前位置
  targetEvent,     // 目標活動
  onEndRoute,      // 結束導航
  onOverview,      // 顯示路線總覽
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const currentStepIndex = route
    ? NavigationService.getCurrentStepIndex(route.steps, currentLocation)
    : 0;
  const currentStep = route?.steps[currentStepIndex];
  const nextStep = route?.steps[currentStepIndex + 1];

  useEffect(() => {
    // 面板滑入動畫
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    // 每次步驟更新時播放語音指示
    if (currentStep?.instruction) {
      Speech.speak(currentStep.instruction, {
        language: 'en-US',
        rate: 0.9,
        pitch: 1.0,
      });
    }
  }, [currentStepIndex]);

  if (!route) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* 拖曳指示條 */}
      <View style={styles.dragBar} />

      {/* 下一步轉彎指示 */}
      <View style={styles.instructionRow}>
        <DirectionIcon type={currentStep?.type} modifier={currentStep?.modifier} />
        <View style={styles.instructionText}>
          <Text style={styles.instructionLabel}>
            {currentStepIndex === 0 ? 'Head towards' : 'Turn'}
          </Text>
          <Text style={styles.instructionMain} numberOfLines={1}>
            {currentStep?.instruction || 'Follow the route'}
          </Text>
          {nextStep && (
            <Text style={styles.instructionNext} numberOfLines={1}>
              Then: {nextStep.instruction}
            </Text>
          )}
        </View>
        <View style={styles.stepDistance}>
          <Text style={styles.stepDistanceText}>
            {NavigationService.formatDistance(currentStep?.distance || 0)}
          </Text>
        </View>
      </View>

      {/* ETA / 距離 / 步行 資訊欄 */}
      <View style={styles.infoBar}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>ETA</Text>
          <Text style={styles.infoValue}>
            {NavigationService.formatDuration(route.duration)}
          </Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Distance</Text>
          <Text style={styles.infoValue}>
            {NavigationService.formatDistance(route.distance)}
          </Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Mode</Text>
          <Text style={styles.infoValue}>🚶</Text>
        </View>
      </View>

      {/* 目標活動資訊卡 */}
      {targetEvent && (
        <View style={styles.eventCard}>
          <View style={styles.eventIconBox}>
            <Text style={styles.eventIcon}>
              {targetEvent.tags?.includes('food') ? '🍜' :
               targetEvent.tags?.includes('music') ? '🎵' :
               targetEvent.tags?.includes('art') ? '🎨' : '📍'}
            </Text>
          </View>
          <View style={styles.eventCardInfo}>
            <Text style={styles.eventCardTitle} numberOfLines={1}>
              {targetEvent.title}
            </Text>
            <Text style={styles.eventCardTime} numberOfLines={1}>
              {targetEvent.time}
            </Text>
          </View>
          <View style={styles.openBadge}>
            <Text style={styles.openText}>Open</Text>
          </View>
        </View>
      )}

      {/* 操作按鈕 */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.endButton} onPress={onEndRoute}>
          <Text style={styles.endButtonText}>End Route</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.overviewButton} onPress={onOverview}>
          <Text style={styles.overviewButtonText}>Overview</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/**
 * 方向圖示元件
 * 根據 maneuver type 顯示對應的箭頭
 */
function DirectionIcon({ type, modifier }) {
  const getArrow = () => {
    if (type === 'arrive') return '🏁';
    if (type === 'depart') return '🚶';
    if (modifier === 'left') return '↰';
    if (modifier === 'right') return '↱';
    if (modifier === 'slight left') return '↖';
    if (modifier === 'slight right') return '↗';
    if (modifier === 'uturn') return '↩';
    return '↑';
  };

  return (
    <View style={styles.directionIconBox}>
      <Text style={styles.directionIconText}>{getArrow()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 15,
  },
  dragBar: {
    width: 36,
    height: 4,
    backgroundColor: '#48484A',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  directionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  directionIconText: {
    fontSize: 24,
    color: 'white',
  },
  instructionText: {
    flex: 1,
  },
  instructionLabel: {
    color: '#8E8E93',
    fontSize: 12,
    marginBottom: 2,
  },
  instructionMain: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  instructionNext: {
    color: '#636366',
    fontSize: 12,
    marginTop: 2,
  },
  stepDistance: {
    alignItems: 'flex-end',
  },
  stepDistanceText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  infoBar: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    color: '#8E8E93',
    fontSize: 11,
    marginBottom: 4,
  },
  infoValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#48484A',
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    gap: 10,
  },
  eventIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FF9F0A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  eventIcon: {
    fontSize: 18,
  },
  eventCardInfo: {
    flex: 1,
  },
  eventCardTitle: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
  },
  eventCardTime: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  openBadge: {
    backgroundColor: '#30D158',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  openText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  endButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  endButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  overviewButton: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  overviewButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
  },
});