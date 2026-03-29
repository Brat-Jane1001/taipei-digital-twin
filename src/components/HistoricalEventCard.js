/**
 * HistoricalEventCard - 歷史事件詳情卡片
 * Historical event detail card
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

export default function HistoricalEventCard({ event, onClose, onNavigate }) {
  if (!event) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ScrollView>
          <Image
            source={{ uri: event.image || 'https://via.placeholder.com/400x200' }}
            style={styles.image}
            resizeMode="cover"
          />
          
          <View style={styles.content}>
            <Text style={styles.year}>{event.year}</Text>
            <Text style={styles.title}>{event.name}</Text>
            
            <Text style={styles.description}>{event.description}</Text>
            
            {event.significance && (
              <View style={styles.significanceBox}>
                <Text style={styles.significanceTitle}>Historical Significance:</Text>
                <Text style={styles.significanceText}>{event.significance}</Text>
              </View>
            )}
            
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  if (onNavigate) {
                    onNavigate(event.lat, event.lng);
                  }
                }}
              >
                <Text style={styles.buttonText}>📍 Navigate Here</Text>
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
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    maxHeight: '80%',
    width: '100%',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 200,
  },
  content: {
    padding: 20,
  },
  year: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  title: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  description: {
    color: '#cbd5e0',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  significanceBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    marginBottom: 20,
  },
  significanceTitle: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  significanceText: {
    color: '#cbd5e0',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    marginTop: 10,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: 'white',
    fontSize: 24,
  },
});