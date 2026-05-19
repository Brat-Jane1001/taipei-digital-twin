import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { BlurView } from 'expo-blur'; // 確保專案有安裝 expo-blur 實現毛玻璃
import { Ionicons } from '@expo/vector-icons';
import AuthService from '../services/AuthService';

const LoginScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedTags, setSelectedTags] = useState(['culture']); // 預設勾選 culture

  // 支援的偏好標籤列表 (對應組長的 EventService tags)
  const availableTags = [
    { id: 'culture', label: '🎬 文藝電影' },
    { id: 'art', label: '🎨 藝術展覽' },
    { id: 'food', label: '🍜 在地美食' },
  ];

  // 處理 Google 登入按鈕串接
  const handleGoogleLogin = async () => {
    setLoading(true);
    // 呼叫剛剛建立的服務
    const result = await AuthService.loginWithGoogle();
    
    setTimeout(() => {
      setLoading(false);
      if (result.success) {
        setIsLoggedIn(true);
        Alert.alert("連結成功", `歡迎，${result.user.name}！請選擇您的個人偏好景點。`);
      } else {
        Alert.alert("登入失敗", "請檢查網路連線");
      }
    }, 1500); // 模擬網路延遲 1.5 秒，展現成熟 APP 的 Loading 動態
  };

  // 切換勾選標籤
  const toggleTag = (tagId) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter(id => id !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  // 點擊「進入 3D 地圖」按鈕串接
  const handleEnterApp = () => {
    // 1. 把使用者的偏好儲存到服務裡
    AuthService.updatePreferences(selectedTags);
    
    // 2. 順暢地跳轉到主地圖頁面（對齊 App.js 的 name="Map"）
    navigation.navigate('Map'); 
  };

  return (
    <View style={styles.container}>
      {/* 背景圖片或 3D 渲染層可以放在這裡，這裡先用深色科技感背景 */}
      <View style={styles.darkBackground} />

      {/* 選項 D 定稿文案風格的標題 */}
      <View style={styles.headerContainer}>
        <Text style={styles.logoText}>Taipei Digital Twin</Text>
        <Text style={styles.subtitleText}>Your ultimate 3D guide to Taipei</Text>
      </View>

      {/* 毛玻璃裝飾卡片 */}
      <BlurView intensity={80} tint="dark" style={styles.blurCard}>
        {!isLoggedIn ? (
          // 階段一：要求 Google 登入
          <View style={styles.innerContent}>
            <Text style={styles.cardTitle}>歡迎探索台北</Text>
            <Text style={styles.cardDesc}>連結您的帳號以解鎖個人化 3D 導覽體驗</Text>
            
            <TouchableOpacity 
              style={styles.googleButton} 
              onPress={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#fff" style={{ marginRight: 10 }} />
                  <Text style={styles.buttonText}>使用 Google 帳號連結</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          // 階段二：連結成功，選擇個人偏好景點
          <View style={styles.innerContent}>
            <Text style={styles.cardTitle}>客製化您的 3D 地圖</Text>
            <Text style={styles.cardDesc}>請選擇您感興趣的景點類型：</Text>

            {/* 標籤選擇區 */}
            <View style={styles.tagContainer}>
              {availableTags.map(tag => {
                const isSelected = selectedTags.includes(tag.id);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    style={[styles.tagButton, isSelected && styles.tagButtonSelected]}
                    onPress={() => toggleTag(tag.id)}
                  >
                    <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 進入 App 的串接按鈕 */}
            <TouchableOpacity style={styles.enterButton} onPress={handleEnterApp}>
              <Text style={styles.buttonText}>生成我的專屬 3D 地圖</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 5 }} />
            </TouchableOpacity>
          </View>
        )}
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  darkBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1a1e29' },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  logoText: { fontSize: 32, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  subtitleText: { fontSize: 14, color: '#8a9aa6', marginTop: 5 },
  blurCard: { width: '85%', borderRadius: 20, padding: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  innerContent: { alignItems: 'center' },
  cardTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 10 },
  cardDesc: { fontSize: 13, color: '#a0aec0', textAlign: 'center', marginBottom: 25 },
  googleButton: { backgroundColor: '#4285F4', flexDirection: 'row', width: '100%', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  enterButton: { backgroundColor: '#10b981', flexDirection: 'row', width: '100%', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  tagContainer: { width: '100%', marginBottom: 10 },
  tagButton: { width: '100%', padding: 14, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tagButtonSelected: { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981' },
  tagText: { color: '#a0aec0', fontSize: 15 },
  tagTextSelected: { color: '#10b981', fontWeight: 'bold' }
});

export default LoginScreen;