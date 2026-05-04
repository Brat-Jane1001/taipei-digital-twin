import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, TouchableOpacity } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { Ionicons } from '@expo/vector-icons'; // 👈 導入專業圖示

const { width } = Dimensions.get('window');

export default function SwipeCards({ events, onSwipe, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSwipe = (cardIndex, direction) => {
    const event = events[cardIndex];
    const swipeDirection = direction === 1 ? 'right' : 'left';
    if (onSwipe) onSwipe(event, swipeDirection);
  };

  const renderCard = (event) => {
    if (!event) return null;
    return (
      <View style={styles.card}>
        <Image source={{ uri: event.image || 'https://images.unsplash.com/photo-1494522358652-330999478432?w=800' }} style={styles.cardImage} resizeMode="cover" />
        
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{event.title}</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="location" size={16} color="#4A90E2" />
              <Text style={styles.infoText} numberOfLines={1}>{event.location}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="time" size={16} color="#FF9F0A" />
              <Text style={styles.infoText}>{event.time}</Text>
            </View>
          </View>
          
          <Text style={styles.cardDescription} numberOfLines={3}>
            {event.description}
          </Text>
          
          <View style={styles.cardTags}>
            {event.tags && event.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>探索附近活動</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      {events && events.length > 0 ? (
        <Swiper
          cards={events}
          renderCard={renderCard}
          onSwipedLeft={(cardIndex) => handleSwipe(cardIndex, -1)}
          onSwipedRight={(cardIndex) => handleSwipe(cardIndex, 1)}
          cardIndex={currentIndex}
          backgroundColor="transparent"
          stackSize={3}
          stackSeparation={14}
          animateCardOpacity
          cardVerticalMargin={40}
          cardHorizontalMargin={20}
          overlayLabels={{
            left: {
              title: 'PASS',
              style: {
                label: { backgroundColor: 'transparent', borderColor: '#FF3B30', color: '#FF3B30', borderWidth: 4, borderRadius: 10, fontSize: 32, fontWeight: '800' },
                wrapper: { flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start', marginTop: 40, marginLeft: -40 }
              }
            },
            right: {
              title: 'GO!',
              style: {
                label: { backgroundColor: 'transparent', borderColor: '#34C759', color: '#34C759', borderWidth: 4, borderRadius: 10, fontSize: 32, fontWeight: '800' },
                wrapper: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', marginTop: 40, marginLeft: 40 }
              }
            }
          }}
        />
      ) : (
        <View style={styles.noEvents}><Text style={styles.noEventsText}>附近暫時沒有活動囉</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '75%', backgroundColor: 'rgba(20, 20, 22, 0.98)', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 10 },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.15)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: 'white', borderRadius: 24, height: '82%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10, overflow: 'hidden' },
  cardImage: { width: '100%', height: '48%' },
  cardContent: { padding: 24, flex: 1, backgroundColor: '#FAFAFA' },
  cardTitle: { fontSize: 26, fontWeight: '900', color: '#1C1C1E', marginBottom: 16, letterSpacing: 0.5 },
  infoRow: { flexDirection: 'column', gap: 10, marginBottom: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 15, color: '#636366', fontWeight: '500', flex: 1 },
  cardDescription: { fontSize: 15, color: '#48484A', lineHeight: 22, marginBottom: 20 },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#EBF4FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D1E8FF' },
  tagText: { color: '#007AFF', fontSize: 13, fontWeight: '700' },
  noEvents: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noEventsText: { color: '#8E8E93', fontSize: 18, fontWeight: '600' },
});