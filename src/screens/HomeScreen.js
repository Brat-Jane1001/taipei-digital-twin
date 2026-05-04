/**
 * HomeScreen - 升級版首頁 (App Store 質感)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ImageBackground,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // 👈 同樣導入專業向量圖示

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  return (
    <ImageBackground
      // 換上一張絕美的台北 101 夜景照
      source={{ uri: 'https://images.unsplash.com/photo-1583339522861-26c792194b5e?q=80&w=1080&auto=format&fit=crop' }}
      style={styles.background}
    >
      <StatusBar barStyle="light-content" />
      
      {/* 科技感深色遮罩 */}
      <View style={styles.overlay}>

        {/* 頂部：Logo 與標題區塊 */}
        <View style={styles.topSection}>
          <View style={styles.logoContainer}>
            <Ionicons name="cube-outline" size={56} color="#4A90E2" />
          </View>
          
          <Text style={styles.title}>Taipei Digital Twin</Text>
          <Text style={styles.subtitle}>台北數位孿生</Text>
          
          <Text style={styles.description}>
            Your ultimate 3D guide to Taipei. Discover upcoming events, track real-time transit, and navigate the city with ease.
          </Text>
        </View>

        {/* 底部：操作按鈕區塊 */}
        <View style={styles.bottomSection}>
          {/* 發光的主按鈕 (CTA) */}
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Map')}
          >
            <Ionicons name="map" size={20} color="white" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>Start Exploring</Text>
          </TouchableOpacity>
          
          {/* 極簡文字連結 */}
          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.6}
            onPress={() => navigation.navigate('Events')}
          >
            <Text style={styles.secondaryButtonText}>
              Or browse upcoming events <Ionicons name="arrow-forward" size={14} />
            </Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.85)', // 深石板藍遮罩，比純黑更有層次
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingTop: 120,
    paddingBottom: 60,
  },
  topSection: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: 'rgba(74, 144, 226, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4A90E2',
    letterSpacing: 4, // 加大字距，增加精品感
    marginBottom: 40,
  },
  description: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '500',
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#4A90E2',
    width: '100%',
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    // 霓虹發光陰影效果
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  buttonIcon: {
    marginRight: 10,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});