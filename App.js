/**
 * App.js - 路由設定
 * 畫面：首頁、地圖、活動、組隊、行程、天氣、公車鍵盤
 * 深層連結：taipeidt://trip/CODE 會直接打開分享的行程
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import EventsScreen from './src/screens/EventsScreen';
<<<<<<< Updated upstream
=======
import MeetupsScreen from './src/screens/MeetupsScreen';
import CreateMeetupScreen from './src/screens/CreateMeetupScreen';
import TripsScreen from './src/screens/TripsScreen';
import TripEditorScreen from './src/screens/TripEditorScreen';
import TripViewerScreen from './src/screens/TripViewerScreen';
import WeatherScreen from './src/screens/WeatherScreen';
import BusKeypadScreen from './src/screens/BusKeypadScreen';
>>>>>>> Stashed changes

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: ['taipeidt://'],
  config: {
    screens: {
      TripViewer: 'trip/:code',
    },
  },
};

export default function App() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerShown: false }} // 隱藏頂部導覽列，用自訂UI
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen name="Events" component={EventsScreen} />
<<<<<<< Updated upstream
=======
        <Stack.Screen name="Meetups" component={MeetupsScreen} />
        <Stack.Screen name="CreateMeetup" component={CreateMeetupScreen} />
        <Stack.Screen name="Trips" component={TripsScreen} />
        <Stack.Screen name="TripEditor" component={TripEditorScreen} />
        <Stack.Screen name="TripViewer" component={TripViewerScreen} />
        <Stack.Screen name="Weather" component={WeatherScreen} />
        <Stack.Screen name="BusKeypad" component={BusKeypadScreen} />
>>>>>>> Stashed changes
      </Stack.Navigator>
    </NavigationContainer>
  );
}
