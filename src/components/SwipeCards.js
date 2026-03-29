/**
 * SwipeCards - Tinder式活動推薦卡片
 * Tinder-style swipeable event cards
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import Swiper from 'react-native-deck-swiper';

const { width } = Dimensions.get('window');

export default function SwipeCards({ events, onSwipe, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSwipe = (cardIndex, direction) => {
    const event = events[cardIndex];
    const swipeDirection = direction === 1 ? 'right' : 'left';
    
    if (onSwipe) {
      onSwipe(event, swipeDirection);
    }
    
    console.log(`Swiped ${swipeDirection} on:`, event.title);
  };

  const renderCard = (event) => {
    if (!event) return null;

    return (
      <View style={styles.card}>
        <Image
          source={{ uri: event.image }}
          style={styles.cardImage}
          resizeMode="cover"
        />
        
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{event.title}</Text>
          
          <View style={styles.cardInfo}>
            <Text style={styles.cardLocation}>📍 {event.location}</Text>
            <Text style={styles.cardTime}>⏰ {event.time}</Text>
          </View>
          
          <Text style={styles.cardDescription} numberOfLines={3}>
            {event.description}
          </Text>
          
          <View style={styles.cardTags}>
            {event.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
        
        {/* 滑動提示 */}
        <View style={styles.swipeHints}>
          <View style={styles.swipeLeft}>
            <Text style={styles.swipeText}>❌</Text>
          </View>
          <View style={styles.swipeRight}>
            <Text style={styles.swipeText}>❤️</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nearby Events</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
      
      {events.length > 0 ? (
        <Swiper
          cards={events}
          renderCard={renderCard}
          onSwipedLeft={(cardIndex) => handleSwipe(cardIndex, -1)}
          onSwipedRight={(cardIndex) => handleSwipe(cardIndex, 1)}
          onSwipedAll={() => console.log('All cards swiped!')}
          cardIndex={currentIndex}
          backgroundColor="transparent"
          stackSize={3}
          stackSeparation={15}
          verticalSwipe={false}
          animateCardOpacity
          cardVerticalMargin={50}
          cardHorizontalMargin={20}
          overlayLabels={{
            left: {
              title: 'NOPE',
              style: {
                label: {
                  backgroundColor: '#ef4444',
                  borderColor: '#ef4444',
                  color: 'white',
                  borderWidth: 1
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  marginTop: 30,
                  marginLeft: -30
                }
              }
            },
            right: {
              title: 'LIKE',
              style: {
                label: {
                  backgroundColor: '#10b981',
                  borderColor: '#10b981',
                  color: 'white',
                  borderWidth: 1
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  marginTop: 30,
                  marginLeft: 30
                }
              }
            }
          }}
        />
      ) : (
        <View style={styles.noEvents}>
          <Text style={styles.noEventsText}>
            No events available right now
          </Text>
        </View>
      )}
      
      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>
          👈 Swipe left to skip | Swipe right to save 👉
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: 'white',
    fontSize: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '45%',
  },
  cardContent: {
    padding: 20,
    flex: 1,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 10,
  },
  cardInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  cardLocation: {
    fontSize: 14,
    color: '#64748b',
  },
  cardTime: {
    fontSize: 14,
    color: '#64748b',
  },
  cardDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 15,
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  tagText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '600',
  },
  swipeHints: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  swipeLeft: {
    position: 'absolute',
    left: 30,
    top: '40%',
    opacity: 0.7,
  },
  swipeRight: {
    position: 'absolute',
    right: 30,
    top: '40%',
    opacity: 0.7,
  },
  swipeText: {
    fontSize: 60,
  },
  instructions: {
    marginTop: 10,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  noEvents: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noEventsText: {
    color: '#94a3b8',
    fontSize: 16,
  },
});