import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, Platform, ScrollView, Linking } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function HistoricalEventCard({ event, onClose, onNavigate }) {
  if (!event) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backgroundTap} onPress={onClose} activeOpacity={1} />
      
      <BlurView intensity={95} tint="dark" style={styles.bottomSheet}>
        <View style={styles.dragIndicatorWrapper}>
          <View style={styles.dragIndicator} />
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close-circle" size={30} color="#8E8E93" />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* 💡 升級 1：橫向滑動的圖片畫廊 */}
          {event.images && event.images.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll} contentContainerStyle={{ gap: 12 }}>
              {event.images.map((img, idx) => (
                <Image key={idx} source={{ uri: img }} style={styles.imageItem} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={56} color="#48484A" />
              <Text style={styles.imagePlaceholderText}>尚無景點照片</Text>
            </View>
          )}

          <View style={styles.titleRow}>
            <Text style={styles.title}>{event.title || event.name}</Text>
            
            {/* 💡 升級 2：跳轉官方網站按鈕 */}
            {event.websiteUrl && (
              <TouchableOpacity style={styles.websiteBtn} onPress={() => Linking.openURL(event.websiteUrl)}>
                <Ionicons name="globe-outline" size={16} color="#0A84FF" />
                <Text style={styles.websiteText}>官網</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {event.tags && event.tags.length > 0 && (
            <View style={styles.tagContainer}>
              {event.tags.map((tag, idx) => (
                <View key={idx} style={styles.tagBadge}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.description}>
            {event.description || '這個景點目前沒有詳細描述，但絕對值得一探究竟！'}
          </Text>
        </ScrollView>

        <TouchableOpacity style={styles.navBtn} onPress={() => onNavigate(event.lat, event.lng)} activeOpacity={0.8}>
          <Ionicons name="navigate" size={20} color="white" />
          <Text style={styles.navBtnText}>導航至此景點</Text>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  backgroundTap: { ...StyleSheet.absoluteFillObject },
  bottomSheet: { width: width, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', maxHeight: height * 0.85 },
  dragIndicatorWrapper: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  dragIndicator: { width: 40, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.3)' },
  closeBtn: { position: 'absolute', top: 16, right: 20, zIndex: 10 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },
  
  // 畫廊樣式
  imageScroll: { marginBottom: 20 },
  imageItem: { width: width * 0.75, height: 220, borderRadius: 20, resizeMode: 'cover' },
  imagePlaceholder: { width: '100%', height: 220, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  imagePlaceholderText: { color: '#8E8E93', marginTop: 12, fontSize: 15, fontWeight: '500' },
  
  // 標題與官網按鈕
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingRight: 30 },
  title: { color: 'white', fontSize: 26, fontWeight: '800', flex: 1 },
  websiteBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10,132,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)', marginLeft: 12, marginTop: 4 },
  websiteText: { color: '#0A84FF', fontSize: 14, fontWeight: 'bold', marginLeft: 4 },
  
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tagBadge: { backgroundColor: 'rgba(10,132,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)' },
  tagText: { color: '#0A84FF', fontSize: 13, fontWeight: '600' },
  description: { color: '#EBEBF5', fontSize: 16, lineHeight: 26 },
  navBtn: { backgroundColor: '#0A84FF', marginHorizontal: 24, marginBottom: Platform.OS === 'ios' ? 34 : 24, paddingVertical: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  navBtnText: { color: 'white', fontSize: 17, fontWeight: 'bold' }
});