/**
 * HomeScreen - 首頁歡迎畫面
 * Welcome screen with app introduction
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ImageBackground,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800' }}
      style={styles.background}
      blurRadius={3}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Logo */}
          <Text style={styles.logo}>🗺️</Text>
          
          {/* Title */}
          <Text style={styles.title}>Taipei Digital Twin</Text>
          <Text style={styles.subtitle}>台北數位孿生</Text>
          
          {/* Description */}
          <Text style={styles.description}>
            Explore Taipei like never before with immersive 3D maps,
            AI-powered recommendations, and historical insights
          </Text>
          
          {/* Features */}
          <View style={styles.features}>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🏙️</Text>
              <Text style={styles.featureText}>3D Real Map</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🎯</Text>
              <Text style={styles.featureText}>Tinder-style Events</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🏛️</Text>
              <Text style={styles.featureText}>Historical Sites</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🎤</Text>
              <Text style={styles.featureText}>Voice Guide</Text>
            </View>
          </View>
          
          {/* Start Button */}
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => navigation.navigate('Map')}
          >
            <Text style={styles.startButtonText}>Start Exploring</Text>
          </TouchableOpacity>
          
          {/* Secondary Button */}
          <TouchableOpacity
            style={styles.eventsButton}
            onPress={() => navigation.navigate('Events')}
          >
            <Text style={styles.eventsButtonText}>Browse Events</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: width,
    height: height,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  logo: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    color: '#94a3b8',
    marginBottom: 30,
  },
  description: {
    fontSize: 16,
    color: '#cbd5e0',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
    marginBottom: 40,
  },
  feature: {
    alignItems: 'center',
    width: 100,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 15,
    width: '100%',
    maxWidth: 300,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  eventsButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3b82f6',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    width: '100%',
    maxWidth: 300,
  },
  eventsButtonText: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});