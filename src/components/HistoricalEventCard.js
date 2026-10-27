/**
 * HistoricalEventCard - 景點/活動詳情卡片 (升級版)
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useAppStore } from '../store/appStore'; // 引入狀態管理

export default function HistoricalEventCard({ event, onClose, onNavigate }) {
  // 取得行程清單與加入方法
  const { itinerary, addToItinerary } = useAppStore();

  if (!event) return null;

  // 檢查這個景點是否已經在行程中
  const isAdded = itinerary.some(item => item.id === event.id);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ScrollView bounces={false}>
          <Image
            source={{ uri: event.image || 'https://via.placeholder.com/400x200' }}
            style={styles.image}
            resizeMode="cover"
          />
          
          <View style={styles.content}>
            {/* 年份或分類標籤 */}
            <Text style={styles.tag}>{event.year || '推薦景點'}</Text>
            <Text style={styles.title}>{event.name || event.title}</Text>
            
            <Text style={styles.description}>
              {event.description || '這是一個位於台北市的精選景點，適合安排在您的行程中。'}
            </Text>
            
            {/* 景點特色或歷史意義 (如果有) */}
            {event.significance && (
              <View style={styles.highlightBox}>
                <Text style={styles.highlightTitle}>✨ 景點特色</Text>
                <Text style={styles.highlightText}>{event.significance}</Text>
              </View>
            )}
            
            {/* 動作按鈕區 */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, isAdded ? styles.addedBtn : styles.addBtn]}
                onPress={() => addToItinerary(event)}
                disabled={isAdded}
              >
                <Text style={[styles.btnText, isAdded && styles.addedBtnText]}>
                  {isAdded ? '✓ 已加入行程' : '🎒 加入行程'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.navBtn]}
                onPress={() => onNavigate && onNavigate(event.lat, event.lng)}
              >
                <Text style={styles.btnText}>📍 直接導航</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1E1E24',
    borderRadius: 24,
    maxHeight: '85%',
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  image: {
    width: '100%',
    height: 220,
  },
  content: {
    padding: 24,
  },
  tag: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  title: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  description: {
    color: '#A0A0A5',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  highlightBox: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
    marginBottom: 24,
  },
  highlightTitle: {
    color: '#4A90E2',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  highlightText: {
    color: '#D1D1D6',
    fontSize: 15,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  addedBtn: {
    backgroundColor: '#4A90E2',
  },
  navBtn: {
    backgroundColor: '#1A73E8',
  },
  btnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addedBtnText: {
    color: '#FFF',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
});