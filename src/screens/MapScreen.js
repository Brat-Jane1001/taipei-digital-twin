/**
 * MapScreen - 完整版
 * 功能：
 * 1. Mapbox 3D台北地圖，可自由拖曳
 * 2. DOGE小人顯示真實GPS位置
 * 3. 定位按鈕（右下角小人圖示）→ 飛回自己位置
 * 4. 公車即時位置（半透明藍色線條風格，每30秒更新）
 * 5. 公車站牌標記
 * 6. 捷運站標記
 * 7. 活動標記（點擊可導航）
 * 8. Apple Maps風格導航面板
 * 9. Tinder滑卡活動推薦
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Modal,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';

import SwipeCards from '../components/SwipeCards';
import HistoricalEventCard from '../components/HistoricalEventCard';
import VoiceGuide from '../components/VoiceGuide';
import GeofenceAlert from '../components/GeofenceAlert';
import NavigationPanel from '../components/NavigationPanel';

import NavigationService from '../services/NavigationService';
import EventService from '../services/EventService';
import LocationService from '../services/LocationService';
import { useAppStore } from '../store/appStore';

const { width, height } = Dimensions.get('window');

// ===== 填入你的 Token =====
const MAPBOX_TOKEN = '';
const TDX_CLIENT_ID = '';
const TDX_CLIENT_SECRET = '';

const GEOFENCE_RADIUS_KM = 0.1;

// 台北捷運站座標（靜態資料，不需要額外API）
const MRT_STATIONS = [
  // 板南線（藍線）
  { id: 'BL01', name: '南港展覽館', lat: 25.0554, lng: 121.6178, line: 'BL', color: '#0070BD' },
  { id: 'BL02', name: '南港', lat: 25.0552, lng: 121.6068, line: 'BL', color: '#0070BD' },
  { id: 'BL06', name: '忠孝復興', lat: 25.0418, lng: 121.5449, line: 'BL', color: '#0070BD' },
  { id: 'BL07', name: '忠孝新生', lat: 25.0424, lng: 121.5330, line: 'BL', color: '#0070BD' },
  { id: 'BL08', name: '忠孝敦化', lat: 25.0418, lng: 121.5510, line: 'BL', color: '#0070BD' },
  { id: 'BL11', name: '西門', lat: 25.0423, lng: 121.5076, line: 'BL', color: '#0070BD' },
  { id: 'BL12', name: '龍山寺', lat: 25.0366, lng: 121.4997, line: 'BL', color: '#0070BD' },
  // 淡水信義線（紅線）
  { id: 'R10', name: '台北車站', lat: 25.0478, lng: 121.5170, line: 'R', color: '#E3121A' },
  { id: 'R11', name: '中山', lat: 25.0631, lng: 121.5203, line: 'R', color: '#E3121A' },
  { id: 'R16', name: '大安', lat: 25.0261, lng: 121.5435, line: 'R', color: '#E3121A' },
  { id: 'R22A', name: '象山', lat: 25.0270, lng: 121.5614, line: 'R', color: '#E3121A' },
  // 松山新店線（綠線）
  { id: 'G14', name: '台電大樓', lat: 25.0215, lng: 121.5293, line: 'G', color: '#008659' },
  { id: 'G15', name: '公館', lat: 25.0143, lng: 121.5344, line: 'G', color: '#008659' },
  // 中和新蘆線（橘線）
  { id: 'O11', name: '忠義', lat: 25.0483, lng: 121.5047, line: 'O', color: '#F8A81E' },
  { id: 'O12', name: '龍山寺', lat: 25.0366, lng: 121.4997, line: 'O', color: '#F8A81E' },
  { id: 'O13', name: '江子翠', lat: 25.0267, lng: 121.4784, line: 'O', color: '#F8A81E' },
];

export default function MapScreen({ navigation }) {
  const webViewRef = useRef(null);

  // 真實GPS位置
  const [realLocation, setRealLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // 導航狀態
  const [navigationRoute, setNavigationRoute] = useState(null);
  const [navigationTarget, setNavigationTarget] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // UI狀態
  const [showCards, setShowCards] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [geofenceEvent, setGeofenceEvent] = useState(null);
  const [triggeredEventIds, setTriggeredEventIds] = useState(new Set());
  const [busLoading, setBusLoading] = useState(false);

  // TDX Token快取
  const tdxTokenRef = useRef(null);
  const tdxTokenExpiryRef = useRef(null);

  const { events, setEvents } = useAppStore();

  // ===== 初始化 =====
  useEffect(() => {
    loadEvents();
    getRealLocation();
  }, []);

  // ===== 地圖就緒後初始化所有圖層 =====
  useEffect(() => {
    if (!mapReady) return;
    // 延遲確保地圖完全載入
    setTimeout(() => {
      sendToMap('addMrtStations', { stations: MRT_STATIONS });
      sendToMap('addEventMarkers', { events });
      fetchAndUpdateBuses();
      fetchBusStops();
    }, 800);

    // 公車每30秒更新
    const busInterval = setInterval(fetchAndUpdateBuses, 30000);
    return () => clearInterval(busInterval);
  }, [mapReady, events]);

  // ===== GPS位置更新 → 更新DOGE小人 + 地理圍欄 =====
  useEffect(() => {
    if (!realLocation || !mapReady) return;
    sendToMap('updateDoge', {
      lat: realLocation.latitude,
      lng: realLocation.longitude,
    });
    if (!isNavigating) checkGeofences(realLocation);
  }, [realLocation, mapReady]);

  // ===== 持續追蹤GPS =====
  useEffect(() => {
    let watcher = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        (loc) => setRealLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        })
      );
    })();
    return () => { if (watcher) watcher.remove(); };
  }, []);

  const loadEvents = async () => {
    try {
      const allEvents = await EventService.getAllEvents();
      setEvents(allEvents);
    } catch (e) { console.error('Load events error:', e); }
  };

  const getRealLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setRealLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (e) { console.error('Location error:', e); }
  };

  // ===== TDX Token 管理 =====
  const getTdxToken = async () => {
    if (tdxTokenRef.current && tdxTokenExpiryRef.current && Date.now() < tdxTokenExpiryRef.current) {
      return tdxTokenRef.current;
    }
    const response = await fetch(
      'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&client_id=${TDX_CLIENT_ID}&client_secret=${TDX_CLIENT_SECRET}`,
      }
    );
    const data = await response.json();
    tdxTokenRef.current = data.access_token;
    tdxTokenExpiryRef.current = Date.now() + (data.expires_in - 300) * 1000;
    return data.access_token;
  };

  const fetchAndUpdateBuses = async () => {
  try {
    setBusLoading(true);
    const token = await getTdxToken();
    const response = await fetch(
      'https://tdx.transportdata.tw/api/basic/v2/Bus/RealTimeByFrequency/City/Taipei?$top=300&$format=JSON',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const raw = await response.json();

    // TDX 有時回傳 { value: [...] } 有時直接回傳 [...]
    const data = Array.isArray(raw) ? raw : (raw?.value ?? []);

    const buses = data
      .filter(b =>
        b?.BusPosition?.PositionLon &&
        b?.BusPosition?.PositionLat &&
        b?.DutyStatus === 1
      )
      .map(b => ({
        id: b.PlateNumb,
        routeName: b.RouteName?.Zh_tw || '',
        lng: b.BusPosition.PositionLon,
        lat: b.BusPosition.PositionLat,
        heading: b.Bearing || 0,
        speed: b.Speed || 0,
      }));

    console.log('✅ 公車數量:', buses.length);
    sendToMap('updateBuses', { buses });

  } catch (e) {
    console.error('Bus fetch error:', e.message);
  } finally {
    setBusLoading(false);
  }
};

  // ===== 抓公車站牌（只抓台北市，限量避免過多） =====
  const fetchBusStops = async () => {
    try {
      const token = await getTdxToken();
      // 只抓西門町附近幾條路線的站牌
      const routes = ['0西', '15', '49', '265', '1'];
      const allStops = [];
      for (const route of routes) {
        const response = await fetch(
          `https://tdx.transportdata.tw/api/basic/v2/Bus/StopOfRoute/City/Taipei/${encodeURIComponent(route)}?$format=JSON`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const raw = await response.json();
        const data = Array.isArray(raw) ? raw : (raw?.value ?? []);
        if (Array.isArray(data) && data.length > 0) {
          const stops = data[0]?.Stops || [];
          stops.forEach(stop => {
            if (stop.StopPosition?.PositionLon && stop.StopPosition?.PositionLat) {
              allStops.push({
                id: stop.StopUID,
                name: stop.StopName?.Zh_tw || '',
                lng: stop.StopPosition.PositionLon,
                lat: stop.StopPosition.PositionLat,
                route: route,
              });
            }
          });
        }
      }
      sendToMap('addBusStops', { stops: allStops });
    } catch (e) {
      console.error('Bus stops error:', e);
    }
  };

  // ===== 地理圍欄 =====
  const checkGeofences = useCallback((location) => {
    if (!events?.length || geofenceEvent) return;
    events.forEach(event => {
      if (triggeredEventIds.has(event.id)) return;
      const distance = LocationService.calculateDistance(
        location.latitude, location.longitude,
        event.lat, event.lng
      );
      if (distance <= GEOFENCE_RADIUS_KM) {
        setGeofenceEvent({ ...event, distance });
        setTriggeredEventIds(prev => new Set([...prev, event.id]));
        speakText(`You are near ${event.title}! Check it out!`);
      }
    });
  }, [events, geofenceEvent, triggeredEventIds]);

  // ===== 定位按鈕 =====
  const handleLocatePress = async () => {
    setIsLocating(true);
    await getRealLocation();
    if (realLocation) {
      sendToMap('flyTo', {
        lat: realLocation.latitude,
        lng: realLocation.longitude,
        zoom: 17,
      });
    }
    setTimeout(() => setIsLocating(false), 2000);
  };

  // ===== 開始導航 =====
  const startNavigation = async (event) => {
    if (!realLocation) {
      speakText('Please wait for your location to be detected.');
      return;
    }
    try {
      speakText(`Starting navigation to ${event.title}`);
      setIsNavigating(true);
      const route = await NavigationService.getWalkingRoute(
        realLocation.longitude, realLocation.latitude,
        event.lng, event.lat
      );
      setNavigationRoute(route);
      setNavigationTarget(event);
      sendToMap('drawRoute', { geometry: route.geometry });
      sendToMap('flyTo', {
        lat: realLocation.latitude,
        lng: realLocation.longitude,
        zoom: 16,
      });
    } catch (e) {
      speakText('Sorry, could not find a route.');
      setIsNavigating(false);
      console.error('Nav error:', e);
    }
  };

  // ===== 結束導航 =====
  const endNavigation = () => {
    setNavigationRoute(null);
    setNavigationTarget(null);
    setIsNavigating(false);
    sendToMap('clearRoute', {});
    speakText('Navigation ended. Explore freely!');
  };

  // ===== WebView 通訊 =====
  const sendToMap = (action, data) => {
    webViewRef.current?.injectJavaScript(`
      if (window.handleMessage) {
        window.handleMessage(${JSON.stringify({ action, data })});
      }
      true;
    `);
  };

  const handleWebViewMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case 'mapReady':
          setMapReady(true);
          break;
        case 'eventMarkerClicked':
          const ev = events.find(e => e.id === msg.data.id);
          if (ev) { setCurrentEvent(ev); setShowEventDetail(true); }
          break;
        case 'busStopClicked':
          speakText(`Bus stop: ${msg.data.name}, Route ${msg.data.route}`);
          break;
        case 'mrtStationClicked':
          speakText(`MRT Station: ${msg.data.name}`);
          break;
      }
    } catch (e) { console.error('WebView msg error:', e); }
  };

  const speakText = (text) => {
    setVoiceMessage(text);
    Speech.speak(text, { language: 'en-US', rate: 0.9 });
  };

  // ===== Mapbox HTML =====
  const mapHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.js"></script>
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.css" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body, html { width:100%; height:100%; overflow:hidden; background:#000; }
    #map { width:100%; height:100%; }

    /* DOGE小人 */
    .doge-marker {
      font-size: 32px;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.7));
      animation: doge-bounce 1s ease-in-out infinite alternate;
    }
    @keyframes doge-bounce {
      from { transform: translateY(0px); }
      to   { transform: translateY(-4px); }
    }

    /* 公車（半透明） */
    .bus-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .bus-label {
      background: rgba(30,80,180,0.75);
      color: white;
      font-size: 8px;
      font-weight: bold;
      padding: 1px 4px;
      border-radius: 3px;
      margin-bottom: 2px;
      white-space: nowrap;
      backdrop-filter: blur(2px);
    }
    .bus-svg {
      opacity: 0.65;
      transition: transform 0.3s ease, opacity 0.3s;
    }
    .bus-svg:hover { opacity: 0.9; }

    /* 公車站牌 */
    .bus-stop-marker {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(255, 140, 0, 0.7);
      border: 1.5px solid rgba(255,200,100,0.9);
      cursor: pointer;
    }
    .bus-stop-marker:hover { transform: scale(1.4); }

    /* 捷運站 */
    .mrt-marker {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2.5px solid white;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(0,0,0,0.5);
    }
    .mrt-label {
      position: absolute;
      top: -18px;
      left: 50%;
      transform: translateX(-50%);
      color: white;
      font-size: 9px;
      font-weight: bold;
      white-space: nowrap;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      pointer-events: none;
    }

    /* 活動標記 */
    .event-marker {
      font-size: 26px;
      cursor: pointer;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
      transition: transform 0.15s;
    }
    .event-marker:active { transform: scale(1.2); }

    /* 真實位置藍點 */
    .real-dot {
      width: 18px; height: 18px;
      border-radius: 50%;
      background: #4A90E2;
      border: 3px solid white;
      box-shadow: 0 0 0 5px rgba(74,144,226,0.25);
    }
  </style>
</head>
<body>
<div id="map"></div>
<script>
mapboxgl.accessToken = '${MAPBOX_TOKEN}';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/standard',
  center: [121.5065, 25.0424],
  zoom: 14,
  pitch: 45,
  bearing: 0,
  minZoom: 11,
  maxZoom: 19,
});

// ===== 全域物件 =====
let dogeMarker = null;
let realDotMarker = null;
const busMarkers = {};
const busStopMarkers = {};
const mrtMarkers = {};
const eventMarkers = {};

map.on('load', () => {

  // 地形
  map.addSource('dem', {
    type: 'raster-dem',
    url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
    tileSize: 512,
  });
  map.setTerrain({ source: 'dem', exaggeration: 1.2 });

  // 3D建築
  map.addLayer({
    id: '3d-buildings',
    source: 'composite',
    'source-layer': 'building',
    filter: ['==', 'extrude', 'true'],
    type: 'fill-extrusion',
    minzoom: 14,
    paint: {
      'fill-extrusion-color': '#b0b8c8',
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'min_height'],
      'fill-extrusion-opacity': 0.65,
    },
  });

  // 導航路線（外框白色 + 內層藍色）
  map.addSource('route', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
  });
  map.addLayer({
    id: 'route-border',
    type: 'line',
    source: 'route',
    paint: { 'line-color': 'white', 'line-width': 10, 'line-opacity': 0.4 },
    layout: { 'line-join': 'round', 'line-cap': 'round' },
  });
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    paint: { 'line-color': '#4A90E2', 'line-width': 6, 'line-opacity': 0.95 },
    layout: { 'line-join': 'round', 'line-cap': 'round' },
  });

  // DOGE小人
  const dogeEl = document.createElement('div');
  dogeEl.className = 'doge-marker';
  dogeEl.innerHTML = '🐕';
  dogeMarker = new mapboxgl.Marker({ element: dogeEl, anchor: 'bottom' })
    .setLngLat([121.5065, 25.0424])
    .addTo(map);

  sendToRN('mapReady', {});
});

// ===== 接收 React Native 指令 =====
window.handleMessage = function(msg) {
  const { action, data } = msg;
  switch (action) {

    // 更新DOGE小人位置
    case 'updateDoge':
      if (dogeMarker) dogeMarker.setLngLat([data.lng, data.lat]);
      break;

    // 飛到指定位置
    case 'flyTo':
      map.flyTo({
        center: [data.lng, data.lat],
        zoom: data.zoom || 16,
        pitch: 50,
        duration: 1500,
      });
      break;

    // 公車即時位置（半透明SVG圖示）
    case 'updateBuses':
      updateBuses(data.buses);
      break;

    // 公車站牌
    case 'addBusStops':
      addBusStops(data.stops);
      break;

    // 捷運站
    case 'addMrtStations':
      addMrtStations(data.stations);
      break;

    // 活動標記
    case 'addEventMarkers':
      addEventMarkers(data.events);
      break;

    // 畫導航路線
    case 'drawRoute':
      map.getSource('route').setData(data.geometry);
      break;

    // 清除路線
    case 'clearRoute':
      map.getSource('route').setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [] }
      });
      break;
  }
};

// ===== 公車 marker 管理 =====
function updateBuses(buses) {
  const currentIds = new Set(buses.map(b => b.id));

  // 移除消失的公車
  Object.keys(busMarkers).forEach(id => {
    if (!currentIds.has(id)) {
      busMarkers[id].remove();
      delete busMarkers[id];
    }
  });

  buses.forEach(bus => {
    if (busMarkers[bus.id]) {
      // 平滑移動：用 animate 補間
      animateBusMove(bus.id, bus.lng, bus.lat, bus.heading);
    } else {
      // 新建公車 marker
      const wrapper = document.createElement('div');
      wrapper.className = 'bus-wrapper';

      const label = document.createElement('div');
      label.className = 'bus-label';
      label.textContent = bus.routeName;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '28');
      svg.setAttribute('height', '28');
      svg.setAttribute('viewBox', '0 0 32 32');
      svg.className = 'bus-svg';
      svg.innerHTML = \`
        <rect x="3" y="8" width="26" height="15" rx="3" fill="rgba(30,100,220,0.55)" stroke="#4A90E2" stroke-width="1.5"/>
        <rect x="3" y="8" width="26" height="7" rx="2" fill="none" stroke="#4A90E2" stroke-width="1" opacity="0.6"/>
        <line x1="3" y1="15" x2="29" y2="15" stroke="#4A90E2" stroke-width="1"/>
        <rect x="6" y="10" width="4" height="3" rx="0.8" fill="none" stroke="#7AB8F5" stroke-width="0.8"/>
        <rect x="12" y="10" width="4" height="3" rx="0.8" fill="none" stroke="#7AB8F5" stroke-width="0.8"/>
        <rect x="18" y="10" width="4" height="3" rx="0.8" fill="none" stroke="#7AB8F5" stroke-width="0.8"/>
        <circle cx="9" cy="24" r="2.5" fill="none" stroke="#4A90E2" stroke-width="1.5"/>
        <circle cx="23" cy="24" r="2.5" fill="none" stroke="#4A90E2" stroke-width="1.5"/>
        <rect x="1" y="17" width="2" height="3" rx="0.5" fill="rgba(74,144,226,0.6)"/>
        <rect x="29" y="17" width="2" height="3" rx="0.5" fill="rgba(74,144,226,0.6)"/>
      \`;

      if (bus.heading) svg.style.transform = \`rotate(\${bus.heading - 90}deg)\`;

      wrapper.appendChild(label);
      wrapper.appendChild(svg);

      const popup = new mapboxgl.Popup({ offset: 20, closeButton: false })
        .setHTML(\`
          <div style="font-family:sans-serif;font-size:12px;padding:4px 6px;">
            <b style="color:#1E50B4">🚌 \${bus.routeName}</b><br>
            <span style="color:#555">速度：\${bus.speed} km/h</span>
          </div>
        \`);

      wrapper.addEventListener('mouseenter', () => popup.addTo(map));
      wrapper.addEventListener('mouseleave', () => popup.remove());

      const marker = new mapboxgl.Marker({ element: wrapper, anchor: 'bottom' })
        .setLngLat([bus.lng, bus.lat])
        .addTo(map);

      busMarkers[bus.id] = marker;
      busMarkers[bus.id]._targetLng = bus.lng;
      busMarkers[bus.id]._targetLat = bus.lat;
    }
  });
}

// 公車平滑移動動畫（補間30幀）
function animateBusMove(id, targetLng, targetLat, heading) {
  const marker = busMarkers[id];
  if (!marker) return;

  const startLng = marker.getLngLat().lng;
  const startLat = marker.getLngLat().lat;
  const frames = 30;
  let frame = 0;

  const svg = marker.getElement().querySelector('.bus-svg');
  if (svg && heading) svg.style.transform = \`rotate(\${heading - 90}deg)\`;

  const animate = () => {
    frame++;
    const t = frame / frames;
    const eased = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // easeInOut
    marker.setLngLat([
      startLng + (targetLng - startLng) * eased,
      startLat + (targetLat - startLat) * eased,
    ]);
    if (frame < frames) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

// ===== 公車站牌 =====
function addBusStops(stops) {
  stops.forEach(stop => {
    if (busStopMarkers[stop.id]) return;
    const el = document.createElement('div');
    el.className = 'bus-stop-marker';
    el.title = stop.name;
    el.addEventListener('click', () => {
      sendToRN('busStopClicked', { name: stop.name, route: stop.route });
    });
    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([stop.lng, stop.lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 12, closeButton: false })
          .setHTML(\`<div style="font-size:11px;padding:3px 6px;font-family:sans-serif;">
            🚏 <b>\${stop.name}</b><br>
            <span style="color:#888">路線 \${stop.route}</span>
          </div>\`)
      )
      .addTo(map);
    busStopMarkers[stop.id] = marker;
  });
}

// ===== 捷運站 =====
function addMrtStations(stations) {
  stations.forEach(station => {
    if (mrtMarkers[station.id]) return;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';

    const dot = document.createElement('div');
    dot.className = 'mrt-marker';
    dot.style.background = station.color;

    const label = document.createElement('div');
    label.className = 'mrt-label';
    label.textContent = station.name;

    dot.addEventListener('click', () => {
      sendToRN('mrtStationClicked', { name: station.name, line: station.line });
    });

    wrapper.appendChild(label);
    wrapper.appendChild(dot);

    const marker = new mapboxgl.Marker({ element: wrapper, anchor: 'center' })
      .setLngLat([station.lng, station.lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 14, closeButton: false })
          .setHTML(\`<div style="font-size:12px;padding:4px 8px;font-family:sans-serif;">
            🚇 <b>\${station.name}</b><br>
            <span style="color:\${station.color};font-weight:bold;">
              \${station.line === 'BL' ? '板南線' :
                station.line === 'R' ? '淡水信義線' :
                station.line === 'G' ? '松山新店線' : '中和新蘆線'}
            </span>
          </div>\`)
      )
      .addTo(map);

    mrtMarkers[station.id] = marker;
  });
}

// ===== 活動標記 =====
function addEventMarkers(events) {
  events.forEach(event => {
    if (eventMarkers[event.id]) return;
    const el = document.createElement('div');
    el.className = 'event-marker';
    el.innerHTML =
      event.tags?.includes('food') ? '🍜' :
      event.tags?.includes('music') ? '🎵' :
      event.tags?.includes('art') ? '🎨' :
      event.tags?.includes('history') ? '🏛️' : '📍';
    el.addEventListener('click', () => {
      sendToRN('eventMarkerClicked', { id: event.id });
    });
    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([event.lng, event.lat])
      .addTo(map);
    eventMarkers[event.id] = marker;
  });
}

function sendToRN(type, data) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
  }
}
</script>
</body>
</html>`;

  return (
    <View style={styles.container}>

      {/* Mapbox 地圖 */}
      <WebView
        ref={webViewRef}
        source={{ html: mapHTML }}
        style={styles.webView}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowUniversalAccessFromFileURLs={true}
      />

      {/* 語音提示 */}
      <VoiceGuide message={voiceMessage} />

      {/* 右側按鈕群組 */}
      <View style={styles.rightButtons}>

        {/* 公車載入指示 */}
        {busLoading && (
          <View style={styles.loadingBadge}>
            <ActivityIndicator size="small" color="#4A90E2" />
            <Text style={styles.loadingText}>公車更新中</Text>
          </View>
        )}

        {/* 定位按鈕 */}
        <TouchableOpacity
          style={[styles.locateBtn, isLocating && styles.locateBtnActive]}
          onPress={handleLocatePress}
          activeOpacity={0.8}
        >
          <Text style={styles.locateBtnIcon}>🧍</Text>
        </TouchableOpacity>

        {/* 活動列表按鈕 */}
        {!isNavigating && (
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setShowCards(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.menuBtnIcon}>🎯</Text>
          </TouchableOpacity>
        )}

        {/* 返回首頁 */}
        {!isNavigating && (
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.menuBtnIcon}>🏠</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 地理圍欄彈窗 */}
      {geofenceEvent && !isNavigating && (
        <GeofenceAlert
          event={geofenceEvent}
          onNavigate={(event) => {
            setGeofenceEvent(null);
            startNavigation(event);
          }}
          onDismiss={() => setGeofenceEvent(null)}
        />
      )}

      {/* Apple Maps 導航面板 */}
      {isNavigating && navigationRoute && (
        <NavigationPanel
          route={navigationRoute}
          currentLocation={realLocation}
          targetEvent={navigationTarget}
          onEndRoute={endNavigation}
          onOverview={() => {
            if (realLocation) {
              sendToMap('flyTo', {
                lat: realLocation.latitude,
                lng: realLocation.longitude,
                zoom: 14,
              });
            }
          }}
        />
      )}

      {/* Tinder 滑卡 */}
      {showCards && (
        <SwipeCards
          events={events}
          onSwipe={(event, direction) => {
            if (direction === 'right') {
              setShowCards(false);
              startNavigation(event);
            }
          }}
          onClose={() => setShowCards(false)}
        />
      )}

      {/* 活動詳情 */}
      <Modal visible={showEventDetail} transparent animationType="slide">
        <HistoricalEventCard
          event={currentEvent}
          onClose={() => setShowEventDetail(false)}
          onNavigate={(lat, lng) => {
            setShowEventDetail(false);
            startNavigation({ ...currentEvent, lat, lng });
          }}
        />
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webView: { flex: 1, width, height },

  rightButtons: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    alignItems: 'center',
    gap: 12,
  },

  locateBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  locateBtnActive: {
    backgroundColor: '#EBF4FF',
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  locateBtnIcon: { fontSize: 24 },

  menuBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(28,28,30,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  menuBtnIcon: { fontSize: 22 },

  loadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28,28,30,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
  },
  loadingText: {
    color: '#4A90E2',
    fontSize: 11,
    fontWeight: '500',
  },
});