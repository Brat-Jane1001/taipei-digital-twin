import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

// ==========================================
// 1. 純數學引擎：計算兩點經緯度的直線距離 (公尺)
// ==========================================
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // 地球半徑 (公尺)
  const toRadians = (degree) => degree * (Math.PI / 180);
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // 乘上 1.3 的「市區彎曲係數」，讓直線距離更貼近真實行車距離
  return Math.round(R * c * 1.3); 
};

// ==========================================
// 2. 計費引擎：台北市計程車費率計算
// ==========================================
const estimateTaxiFare = (distanceInMeters) => {
  const BASE_FARE = 85;
  const BASE_DISTANCE = 1250;
  const EXTRA_FARE = 5;
  const EXTRA_DISTANCE = 200;
  const TRAFFIC_MULTIPLIER = 1.1; // 塞車延滯係數

  if (distanceInMeters <= BASE_DISTANCE) {
    return Math.round(BASE_FARE * TRAFFIC_MULTIPLIER);
  }

  const extraDistance = distanceInMeters - BASE_DISTANCE;
  const jumps = Math.ceil(extraDistance / EXTRA_DISTANCE);
  const totalBaseFare = BASE_FARE + (jumps * EXTRA_FARE);

  return Math.round(totalBaseFare * TRAFFIC_MULTIPLIER);
};

// ==========================================
// 3. UI 元件：毛玻璃底部卡片
// ==========================================
export default function PlaceInfoCard({ 
  isVisible, 
  placeName = "台北 101", 
  userLocation = { lat: 25.0408, lon: 121.5575 }, // 假定使用者在國父紀念館
  targetLocation = { lat: 25.0339, lon: 121.5644 }, // 假定目標在台北 101
  onClose 
}) {
  
  if (!isVisible) return null;

  // 動態計算距離與車資
  const distance = calculateDistance(
    userLocation.lat, userLocation.lon, 
    targetLocation.lat, targetLocation.lon
  );
  const fare = estimateTaxiFare(distance);

  return (
    <View style={styles.cardContainer}>
      <View style={styles.glassPanel}>
        {/* 頂部拉桿裝飾 */}
        <View style={styles.dragIndicator} />
        
        <View style={styles.headerRow}>
          <Text style={styles.title}>{placeName}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          直線距離約 {(distance / 1000).toFixed(1)} 公里
        </Text>

        <View style={styles.fareBox}>
          <Text style={styles.fareLabel}>🚕 預估計程車資</Text>
          <View style={styles.priceRow}>
            <Text style={styles.currency}>NT$</Text>
            <Text style={styles.priceAmount}>{fare}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>開始模擬導航</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    width: width,
    alignItems: 'center',
    zIndex: 100, // 確保卡片浮在最上層
  },
  glassPanel: {
    width: '90%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // 模擬毛玻璃透視
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#CCC',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  closeBtn: {
    width: 30,
    height: 30,
    backgroundColor: '#F0F0F0',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    marginBottom: 16,
  },
  fareBox: {
    backgroundColor: 'rgba(240, 244, 255, 0.8)', // 淡淡的藍色底襯托
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  fareLabel: {
    fontSize: 14,
    color: '#4A6572',
    fontWeight: '600',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currency: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginRight: 4,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  actionButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

