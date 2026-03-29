/**
 * ControlPanel - 地圖控制面板
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export default function ControlPanel({
  onFlyToTaipei101,
  onShowHistorical,
  onShowEvents,
  onBack,
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      {/* 返回按鈕 */}
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      {/* 展開/收合按鈕 */}
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.toggleText}>{expanded ? '✕' : '☰'}</Text>
      </TouchableOpacity>

      {/* 控制選單 */}
      {expanded && (
        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem} onPress={onFlyToTaipei101}>
            <Text style={styles.menuIcon}>🏢</Text>
            <Text style={styles.menuText}>台北101</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onShowHistorical}>
            <Text style={styles.menuIcon}>📜</Text>
            <Text style={styles.menuText}>日治時期</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onShowEvents}>
            <Text style={styles.menuIcon}>🎯</Text>
            <Text style={styles.menuText}>附近活動</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    alignItems: 'flex-end',
  },
  backButton: {
    position: 'absolute',
    top: -500,
    left: -300,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  toggleButton: {
    backgroundColor: '#3b82f6',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  toggleText: {
    color: 'white',
    fontSize: 24,
  },
  menu: {
    marginBottom: 10,
    alignItems: 'flex-end',
    gap: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
    elevation: 4,
  },
  menuIcon: {
    fontSize: 20,
  },
  menuText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});