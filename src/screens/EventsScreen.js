/**
 * EventsScreen - 升級版活動瀏覽畫面 (精品 UI 版本)
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // 👈 導入高質感圖示
import EventService from '../services/EventService';

export default function EventsScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    const allEvents = await EventService.getAllEvents();
    setEvents(allEvents);
  };

  const categories = ['all', 'food', 'music', 'culture', 'sports'];

  const filteredEvents = selectedCategory === 'all'
    ? events
    : events.filter(event => event.tags.includes(selectedCategory));

  const renderEventItem = ({ item }) => (
    <TouchableOpacity style={styles.eventCard} activeOpacity={0.8}>
      <Image
        source={{ uri: item.image }}
        style={styles.eventImage}
        resizeMode="cover"
      />
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        
        {/* 高質感圖示取代原本的 Emoji */}
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color="#94A3B8" />
          <Text style={styles.infoText}>{item.location}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color="#94A3B8" />
          <Text style={styles.infoText}>{item.time}</Text>
        </View>
        
        <View style={styles.tags}>
          {item.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* 乾淨俐落的頂部導航列 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.6}
        >
          <Ionicons name="chevron-back" size={28} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upcoming Events</Text>
      </View>

      {/* 橫向滑動的分類標籤 (加入 ScrollView 防擠壓) */}
      <View style={styles.categoriesWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.categoryButtonActive
              ]}
              onPress={() => setSelectedCategory(category)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextActive
              ]}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 活動列表 */}
      <FlatList
        data={filteredEvents}
        renderItem={renderEventItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // 統一使用首頁的深石板藍背景
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  backButton: {
    marginBottom: 10,
    marginLeft: -8, // 稍微往左靠，抵銷圖示本身的空白
  },
  headerTitle: {
    color: 'white',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  categoriesWrapper: {
    marginBottom: 20,
  },
  categories: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)', // 未選取時的外框設計
  },
  categoryButtonActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
    // 增加發光立體感
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  categoryText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  eventCard: {
    backgroundColor: 'rgba(30, 30, 36, 0.7)', // 微透明深色背景
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)', // ✨ 靈魂微邊框，浮出背景的關鍵
  },
  eventImage: {
    width: '100%',
    height: 200, // 稍微調高，讓圖片更有張力
  },
  eventInfo: {
    padding: 20,
  },
  eventTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    backgroundColor: 'rgba(74, 144, 226, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.2)',
  },
  tagText: {
    color: '#4A90E2',
    fontSize: 12,
    fontWeight: '700',
  },
});