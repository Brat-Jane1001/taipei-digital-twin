/**
 * App.js - 核心路由設定
 * 修正：加入 Login 畫面作為初始頁面，並完美串接 Map 與 Events
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './src/screens/LoginScreen'; // 👈 導入我們剛做好的高質感登入頁
import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import EventsScreen from './src/screens/EventsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login" // 👈 這裡改成 Login，讓成熟的 APP 一開機就先進行驗證
        screenOptions={{ headerShown: false }} // 隱藏頂部導覽列，使用高質感自訂 UI
      >
        {/* 驗證與個人偏好設定流 */}
        <Stack.Screen name="Login" component={LoginScreen} />
        
        {/* 主程式核心功能流 */}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen name="Events" component={EventsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}