/**
 * MapScreen - 3D地圖主畫面
 * Main 3D map screen with CesiumJS integration
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Speech from 'expo-speech';

// 導入組件
import SwipeCards from '../components/SwipeCards.js';
import HistoricalEventCard from '../components/HistoricalEventCard.js';
import VoiceGuide from '../components/VoiceGuide.js';
import ControlPanel from '../components/ControlPanel';

// 導入服務
import LocationService from '../services/LocationService.js';
import EventService from '../services/EventService';
import { useAppStore } from '../store/appStore.js';

const { width, height } = Dimensions.get('window');

export default function MapScreen({ navigation }) {
  const webViewRef = useRef(null);
  const [showCards, setShowCards] = useState(false);
  const [showHistoricalEvent, setShowHistoricalEvent] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [voiceMessage, setVoiceMessage] = useState('');
  
  // Zustand store
  const { events, setEvents } = useAppStore();

  useEffect(() => {
    initializeMap();
  }, []);

  const initializeMap = async () => {
    // 取得使用者位置
    const location = await LocationService.getCurrentPosition();
    
    // 載入附近活動
    const nearbyEvents = await EventService.getNearbyEvents(
      location.latitude,
      location.longitude
    );
    setEvents(nearbyEvents);
    
    speakText('Welcome to Taipei Digital Twin! Tap anywhere to explore.');
  };

  // ===== 與CesiumJS通訊 =====
  
  const sendToCesium = (action, data) => {
    const message = JSON.stringify({ action, data });
    webViewRef.current?.injectJavaScript(`
      if (window.handleReactNativeMessage) {
        window.handleReactNativeMessage(${message});
      }
      true;
    `);
  };

  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'mapReady':
          console.log('✅ CesiumJS map loaded successfully!');
          break;
        case 'mapError':
          console.log('❌ 地圖錯誤:', message.data.message);
          break;  
        case 'buildingClicked':
          speakText(`This is ${message.data.name}`);
          break;
          
        case 'avatarArrived':
          speakText(`You have arrived at ${message.data.destination}`);
          break;
          
        case 'historicalEventTriggered':
          setCurrentEvent(message.data.event);
          setShowHistoricalEvent(true);
          speakText(message.data.event.description);
          break;
          
        case 'npcTriggered':
          setShowCards(true);
          speakText('There are exciting events happening nearby!');
          break;
          
        default:
          console.log('📩 Received:', message);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  // ===== 功能函數 =====
  
  const speakText = (text) => {
    setVoiceMessage(text);
    Speech.speak(text, {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const flyToLandmark = (landmark) => {
    sendToCesium('flyTo', landmark);
  };

  const showHistoricalEra = (era) => {
    sendToCesium('showHistoricalEvents', { era });
  };

  const navigateToEvent = (event) => {
    sendToCesium('navigateTo', {
      lat: event.lat,
      lng: event.lng,
      name: event.name,
    });
    speakText(`Navigating to ${event.name}`);
  };

  // ===== CesiumJS HTML內容 =====
  
  const cesiumHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <script src="https://cesium.com/downloads/cesiumjs/releases/1.120/Build/Cesium/Cesium.js"></script>
  <link href="https://cesium.com/downloads/cesiumjs/releases/1.120/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
  <style>
    body, html {
      margin: 0;
      padding: 0;
      overflow: hidden;
      width: 100%;
      height: 100%;
    }
    #cesiumContainer {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="cesiumContainer"></div>
  <script>
    // Cesium Token（請替換成你自己的）
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3ZWQ5Nzk1ZC1lZDQ5LTQ1OTktYTA4Yi1hZGEyM2JlZGRkOGIiLCJpZCI6NDA0OTI5LCJpYXQiOjE3NzM3MzExMTN9.kSu4V0ePS7yU6sIFEqOfHFt3pNI5FSFg-hcUMuUTfoc';
    
    // 建立Viewer
    const viewer = new Cesium.Viewer('cesiumContainer', {
      terrainProvider: Cesium.createWorldTerrain(),
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
    });
    
    // 飛到台北
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(121.5654, 25.0330, 3000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0
      },
      duration: 3
    });
    
    // 載入Google 3D Tiles（真實建築）
        (async function() {
    try {
      const tileset = await Cesium.createGooglePhotorealistic3DTileset();
      viewer.scene.primitives.add(tileset);
      sendToReactNative('mapReady', {});
    } catch (error) {
      sendToReactNative('mapError', { message: error.toString() });
    }
  })();
    
    // Avatar
    let avatar = null;
    
    function createAvatar(lat, lng) {
      const position = Cesium.Cartesian3.fromDegrees(lng, lat, 2);
      
      avatar = viewer.entities.add({
        name: 'Avatar',
        position: position,
        point: {
          pixelSize: 20,
          color: Cesium.Color.LIME,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2
        },
        label: {
          text: '👤',
          font: '32px sans-serif',
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -20)
        }
      });
      
      viewer.trackedEntity = avatar;
    }
    
    createAvatar(25.0330, 121.5654);
    
    // 歷史事件標記
    const historicalEvents = {
      japanese_era: [
        { name: 'Presidential Office', lat: 25.0408, lng: 121.5120, year: 1919 },
        { name: '228 Peace Park', lat: 25.0425, lng: 121.5153, year: 1947 },
        { name: 'Red House', lat: 25.0421, lng: 121.5067, year: 1908 }
      ]
    };
    
    function showHistoricalEvents(era) {
      const events = historicalEvents[era] || [];
      
      events.forEach(event => {
        viewer.entities.add({
          name: event.name,
          position: Cesium.Cartesian3.fromDegrees(event.lng, event.lat, 50),
          billboard: {
            image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyNCIgY3k9IjI0IiByPSIyMCIgZmlsbD0iI2ZiYmYyNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+PmzwvdGV4dD48L3N2Zz4=',
            width: 48,
            height: 48,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM
          },
          label: {
            text: event.name + ' (' + event.year + ')',
            font: '14px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            pixelOffset: new Cesium.Cartesian2(0, 10)
          },
          properties: event
        });
      });
    }
    
    // 點擊處理
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    handler.setInputAction(function(click) {
      const pickedObject = viewer.scene.pick(click.position);
      
      if (Cesium.defined(pickedObject) && pickedObject.id) {
        const entity = pickedObject.id;
        
        if (entity.properties) {
          sendToReactNative('historicalEventTriggered', {
            event: {
              name: entity.name,
              year: entity.properties.year,
              description: 'Historical site from ' + entity.properties.year
            }
          });
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    // 與React Native通訊
    function sendToReactNative(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
      }
    }
    
    window.handleReactNativeMessage = function(message) {
      const { action, data } = message;
      
      switch (action) {
        case 'flyTo':
          const landmarks = {
            taipei101: { lat: 25.0330, lng: 121.5654, height: 500 },
            presidential: { lat: 25.0408, lng: 121.5120, height: 300 }
          };
          const target = landmarks[data];
          if (target) {
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(target.lng, target.lat, target.height),
              duration: 2
            });
          }
          break;
          
        case 'showHistoricalEvents':
          showHistoricalEvents(data.era);
          break;
          
        case 'navigateTo':
          if (avatar) {
            const newPosition = Cesium.Cartesian3.fromDegrees(data.lng, data.lat, 2);
            avatar.position = newPosition;
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(data.lng, data.lat, 500),
              duration: 3
            });
          }
          break;
      }
    };
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.container}>
      {/* CesiumJS 3D地圖 */}
  <WebView
      ref={webViewRef}
      source={{ html: cesiumHTML }}
      style={styles.webView}
      onMessage={handleWebViewMessage}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      originWhitelist={['*']}
      mixedContentMode="always"
      allowUniversalAccessFromFileURLs={true}
      allowFileAccessFromFileURLs={true}
   />
      
      {/* 語音輸出 */}
      <VoiceGuide message={voiceMessage} />
      
      {/* 控制面板 */}
      <ControlPanel
        onFlyToTaipei101={() => flyToLandmark('taipei101')}
        onShowHistorical={() => showHistoricalEra('japanese_era')}
        onShowEvents={() => setShowCards(true)}
        onBack={() => navigation.goBack()}
      />
      
      {/* Tinder式活動卡片 */}
      {showCards && (
        <SwipeCards
          events={events}
          onSwipe={(event, direction) => {
            if (direction === 'right') {
              navigateToEvent(event);
            }
          }}
          onClose={() => setShowCards(false)}
        />
      )}
      
      {/* 歷史事件卡片 */}
      <Modal
        visible={showHistoricalEvent}
        transparent={true}
        animationType="slide"
      >
        <HistoricalEventCard
          event={currentEvent}
          onClose={() => setShowHistoricalEvent(false)}
          onNavigate={(lat, lng) => {
            sendToCesium('navigateTo', { lat, lng, name: currentEvent.name });
            setShowHistoricalEvent(false);
          }}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
    width: width,
    height: height,
  },
});