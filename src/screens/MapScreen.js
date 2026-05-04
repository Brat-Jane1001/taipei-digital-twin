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

/**
 * MapScreen - 完整版 (升級高質感 UI 版本)
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
import { Ionicons } from '@expo/vector-icons'; // 👈 召喚高質感圖示的魔法陣

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

// 台北捷運站座標
const MRT_STATIONS = [
  { id: 'BL01', name: '南港展覽館', lat: 25.0554, lng: 121.6178, line: 'BL', color: '#0070BD' },
  { id: 'BL02', name: '南港', lat: 25.0552, lng: 121.6068, line: 'BL', color: '#0070BD' },
  { id: 'BL06', name: '忠孝復興', lat: 25.0418, lng: 121.5449, line: 'BL', color: '#0070BD' },
  { id: 'BL07', name: '忠孝新生', lat: 25.0424, lng: 121.5330, line: 'BL', color: '#0070BD' },
  { id: 'BL08', name: '忠孝敦化', lat: 25.0418, lng: 121.5510, line: 'BL', color: '#0070BD' },
  { id: 'BL11', name: '西門', lat: 25.0423, lng: 121.5076, line: 'BL', color: '#0070BD' },
  { id: 'BL12', name: '龍山寺', lat: 25.0366, lng: 121.4997, line: 'BL', color: '#0070BD' },
  { id: 'R10', name: '台北車站', lat: 25.0478, lng: 121.5170, line: 'R', color: '#E3121A' },
  { id: 'R11', name: '中山', lat: 25.0631, lng: 121.5203, line: 'R', color: '#E3121A' },
  { id: 'R16', name: '大安', lat: 25.0261, lng: 121.5435, line: 'R', color: '#E3121A' },
  { id: 'R22A', name: '象山', lat: 25.0270, lng: 121.5614, line: 'R', color: '#E3121A' },
  { id: 'G14', name: '台電大樓', lat: 25.0215, lng: 121.5293, line: 'G', color: '#008659' },
  { id: 'G15', name: '公館', lat: 25.0143, lng: 121.5344, line: 'G', color: '#008659' },
  { id: 'O11', name: '忠義', lat: 25.0483, lng: 121.5047, line: 'O', color: '#F8A81E' },
  { id: 'O12', name: '龍山寺', lat: 25.0366, lng: 121.4997, line: 'O', color: '#F8A81E' },
  { id: 'O13', name: '江子翠', lat: 25.0267, lng: 121.4784, line: 'O', color: '#F8A81E' },
];

export default function MapScreen({ navigation }) {
  const webViewRef = useRef(null);
  const [realLocation, setRealLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [navigationRoute, setNavigationRoute] = useState(null);
  const [navigationTarget, setNavigationTarget] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [geofenceEvent, setGeofenceEvent] = useState(null);
  const [triggeredEventIds, setTriggeredEventIds] = useState(new Set());
  const [busLoading, setBusLoading] = useState(false);

  const tdxTokenRef = useRef(null);
  const tdxTokenExpiryRef = useRef(null);
  const { events, setEvents } = useAppStore();

  useEffect(() => {
    loadEvents();
    getRealLocation();
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    setTimeout(() => {
      sendToMap('addMrtStations', { stations: MRT_STATIONS });
      sendToMap('addEventMarkers', { events });
      fetchAndUpdateBuses();
      fetchBusStops();
    }, 800);
    const busInterval = setInterval(fetchAndUpdateBuses, 30000);
    return () => clearInterval(busInterval);
  }, [mapReady, events]);

  useEffect(() => {
    if (!realLocation || !mapReady) return;
    sendToMap('updateDoge', { lat: realLocation.latitude, lng: realLocation.longitude });
    if (!isNavigating) checkGeofences(realLocation);
  }, [realLocation, mapReady]);

  useEffect(() => {
    let watcher = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        (loc) => setRealLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
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
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setRealLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch (e) { console.error('Location error:', e); }
  };

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
      const data = Array.isArray(raw) ? raw : (raw?.value ?? []);
      const buses = data
        .filter(b => b?.BusPosition?.PositionLon && b?.BusPosition?.PositionLat && b?.DutyStatus === 1)
        .map(b => ({
          id: b.PlateNumb,
          routeName: b.RouteName?.Zh_tw || '',
          lng: b.BusPosition.PositionLon,
          lat: b.BusPosition.PositionLat,
          heading: b.Bearing || 0,
          speed: b.Speed || 0,
        }));
      sendToMap('updateBuses', { buses });
    } catch (e) {
      console.error('Bus fetch error:', e.message);
    } finally {
      setBusLoading(false);
    }
  };

  const fetchBusStops = async () => {
    try {
      const token = await getTdxToken();
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
    } catch (e) { console.error('Bus stops error:', e); }
  };

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

  const handleLocatePress = async () => {
    setIsLocating(true);
    await getRealLocation();
    if (realLocation) {
      sendToMap('flyTo', { lat: realLocation.latitude, lng: realLocation.longitude, zoom: 17 });
    }
    setTimeout(() => setIsLocating(false), 2000);
  };

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
      sendToMap('flyTo', { lat: realLocation.latitude, lng: realLocation.longitude, zoom: 16 });
    } catch (e) {
      speakText('Sorry, could not find a route.');
      setIsNavigating(false);
      console.error('Nav error:', e);
    }
  };

  const endNavigation = () => {
    setNavigationRoute(null);
    setNavigationTarget(null);
    setIsNavigating(false);
    sendToMap('clearRoute', {});
    speakText('Navigation ended. Explore freely!');
  };

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
        case 'mapReady': setMapReady(true); break;
        case 'eventMarkerClicked':
          const ev = events.find(e => e.id === msg.data.id);
          if (ev) { setCurrentEvent(ev); setShowEventDetail(true); }
          break;
        case 'busStopClicked': speakText(`Bus stop: ${msg.data.name}, Route ${msg.data.route}`); break;
        case 'mrtStationClicked': speakText(`MRT Station: ${msg.data.name}`); break;
      }
    } catch (e) { console.error('WebView msg error:', e); }
  };

  const speakText = (text) => {
    setVoiceMessage(text);
    Speech.speak(text, { language: 'en-US', rate: 0.9 });
  };

  // ===== Mapbox HTML 區塊維持不動 =====
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
    .doge-marker { font-size: 32px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.7)); animation: doge-bounce 1s ease-in-out infinite alternate; }
    @keyframes doge-bounce { from { transform: translateY(0px); } to { transform: translateY(-4px); } }
    .bus-wrapper { position: relative; display: flex; flex-direction: column; align-items: center; }
    .bus-label { background: rgba(30,80,180,0.75); color: white; font-size: 8px; font-weight: bold; padding: 1px 4px; border-radius: 3px; margin-bottom: 2px; white-space: nowrap; backdrop-filter: blur(2px); }
    .bus-svg { opacity: 0.65; transition: transform 0.3s ease, opacity 0.3s; }
    .bus-svg:hover { opacity: 0.9; }
    .bus-stop-marker { width: 10px; height: 10px; border-radius: 50%; background: rgba(255, 140, 0, 0.7); border: 1.5px solid rgba(255,200,100,0.9); cursor: pointer; }
    .bus-stop-marker:hover { transform: scale(1.4); }
    .mrt-marker { width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.5); }
    .mrt-label { position: absolute; top: -18px; left: 50%; transform: translateX(-50%); color: white; font-size: 9px; font-weight: bold; white-space: nowrap; text-shadow: 0 1px 3px rgba(0,0,0,0.8); pointer-events: none; }
    .event-marker { font-size: 26px; cursor: pointer; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); transition: transform 0.15s; }
    .event-marker:active { transform: scale(1.2); }
  </style>
</head>
<body>
<div id="map"></div>
<script>
mapboxgl.accessToken = '${MAPBOX_TOKEN}';
const map = new mapboxgl.Map({
  container: 'map', style: 'mapbox://styles/mapbox/standard', center: [121.5065, 25.0424], zoom: 14, pitch: 45, bearing: 0, minZoom: 11, maxZoom: 19,
});
let dogeMarker = null; const busMarkers = {}; const busStopMarkers = {}; const mrtMarkers = {}; const eventMarkers = {};
map.on('load', () => {
  map.addSource('dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512 });
  map.setTerrain({ source: 'dem', exaggeration: 1.2 });
  map.addLayer({
    id: '3d-buildings', source: 'composite', 'source-layer': 'building', filter: ['==', 'extrude', 'true'], type: 'fill-extrusion', minzoom: 14,
    paint: { 'fill-extrusion-color': '#b0b8c8', 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'min_height'], 'fill-extrusion-opacity': 0.65 },
  });
  map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
  map.addLayer({ id: 'route-border', type: 'line', source: 'route', paint: { 'line-color': 'white', 'line-width': 10, 'line-opacity': 0.4 }, layout: { 'line-join': 'round', 'line-cap': 'round' } });
  map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#4A90E2', 'line-width': 6, 'line-opacity': 0.95 }, layout: { 'line-join': 'round', 'line-cap': 'round' } });
  const dogeEl = document.createElement('div'); dogeEl.className = 'doge-marker'; dogeEl.innerHTML = '🐕';
  dogeMarker = new mapboxgl.Marker({ element: dogeEl, anchor: 'bottom' }).setLngLat([121.5065, 25.0424]).addTo(map);
  sendToRN('mapReady', {});
});
window.handleMessage = function(msg) {
  const { action, data } = msg;
  switch (action) {
    case 'updateDoge': if (dogeMarker) dogeMarker.setLngLat([data.lng, data.lat]); break;
    case 'flyTo': map.flyTo({ center: [data.lng, data.lat], zoom: data.zoom || 16, pitch: 50, duration: 1500 }); break;
    case 'updateBuses': updateBuses(data.buses); break;
    case 'addBusStops': addBusStops(data.stops); break;
    case 'addMrtStations': addMrtStations(data.stations); break;
    case 'addEventMarkers': addEventMarkers(data.events); break;
    case 'drawRoute': map.getSource('route').setData(data.geometry); break;
    case 'clearRoute': map.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }); break;
  }
};
function updateBuses(buses) {
  const currentIds = new Set(buses.map(b => b.id));
  Object.keys(busMarkers).forEach(id => { if (!currentIds.has(id)) { busMarkers[id].remove(); delete busMarkers[id]; } });
  buses.forEach(bus => {
    if (busMarkers[bus.id]) { animateBusMove(bus.id, bus.lng, bus.lat, bus.heading); } 
    else {
      const wrapper = document.createElement('div'); wrapper.className = 'bus-wrapper';
      const label = document.createElement('div'); label.className = 'bus-label'; label.textContent = bus.routeName;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', '28'); svg.setAttribute('height', '28'); svg.setAttribute('viewBox', '0 0 32 32'); svg.className = 'bus-svg';
      svg.innerHTML = \`<rect x="3" y="8" width="26" height="15" rx="3" fill="rgba(30,100,220,0.55)" stroke="#4A90E2" stroke-width="1.5"/><rect x="3" y="8" width="26" height="7" rx="2" fill="none" stroke="#4A90E2" stroke-width="1" opacity="0.6"/><line x1="3" y1="15" x2="29" y2="15" stroke="#4A90E2" stroke-width="1"/><rect x="6" y="10" width="4" height="3" rx="0.8" fill="none" stroke="#7AB8F5" stroke-width="0.8"/><rect x="12" y="10" width="4" height="3" rx="0.8" fill="none" stroke="#7AB8F5" stroke-width="0.8"/><rect x="18" y="10" width="4" height="3" rx="0.8" fill="none" stroke="#7AB8F5" stroke-width="0.8"/><circle cx="9" cy="24" r="2.5" fill="none" stroke="#4A90E2" stroke-width="1.5"/><circle cx="23" cy="24" r="2.5" fill="none" stroke="#4A90E2" stroke-width="1.5"/><rect x="1" y="17" width="2" height="3" rx="0.5" fill="rgba(74,144,226,0.6)"/><rect x="29" y="17" width="2" height="3" rx="0.5" fill="rgba(74,144,226,0.6)"/>\`;
      if (bus.heading) svg.style.transform = \`rotate(\${bus.heading - 90}deg)\`;
      wrapper.appendChild(label); wrapper.appendChild(svg);
      const marker = new mapboxgl.Marker({ element: wrapper, anchor: 'bottom' }).setLngLat([bus.lng, bus.lat]).addTo(map);
      busMarkers[bus.id] = marker;
    }
  });
}
function animateBusMove(id, targetLng, targetLat, heading) {
  const marker = busMarkers[id]; if (!marker) return;
  const startLng = marker.getLngLat().lng; const startLat = marker.getLngLat().lat;
  const frames = 30; let frame = 0;
  const svg = marker.getElement().querySelector('.bus-svg'); if (svg && heading) svg.style.transform = \`rotate(\${heading - 90}deg)\`;
  const animate = () => {
    frame++; const t = frame / frames; const eased = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    marker.setLngLat([startLng + (targetLng - startLng) * eased, startLat + (targetLat - startLat) * eased]);
    if (frame < frames) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
function addBusStops(stops) {
  stops.forEach(stop => {
    if (busStopMarkers[stop.id]) return;
    const el = document.createElement('div'); el.className = 'bus-stop-marker';
    el.addEventListener('click', () => { sendToRN('busStopClicked', { name: stop.name, route: stop.route }); });
    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([stop.lng, stop.lat]).addTo(map);
    busStopMarkers[stop.id] = marker;
  });
}
function addMrtStations(stations) {
  stations.forEach(station => {
    if (mrtMarkers[station.id]) return;
    const wrapper = document.createElement('div'); wrapper.style.position = 'relative';
    const dot = document.createElement('div'); dot.className = 'mrt-marker'; dot.style.background = station.color;
    const label = document.createElement('div'); label.className = 'mrt-label'; label.textContent = station.name;
    dot.addEventListener('click', () => { sendToRN('mrtStationClicked', { name: station.name, line: station.line }); });
    wrapper.appendChild(label); wrapper.appendChild(dot);
    const marker = new mapboxgl.Marker({ element: wrapper, anchor: 'center' }).setLngLat([station.lng, station.lat]).addTo(map);
    mrtMarkers[station.id] = marker;
  });
}
function addEventMarkers(events) {
  events.forEach(event => {
    if (eventMarkers[event.id]) return;
    const el = document.createElement('div'); el.className = 'event-marker';
    el.innerHTML = event.tags?.includes('food') ? '🍜' : event.tags?.includes('music') ? '🎵' : event.tags?.includes('art') ? '🎨' : event.tags?.includes('history') ? '🏛️' : '📍';
    el.addEventListener('click', () => { sendToRN('eventMarkerClicked', { id: event.id }); });
    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([event.lng, event.lat]).addTo(map);
    eventMarkers[event.id] = marker;
  });
}
function sendToRN(type, data) { if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify({ type, data })); } }
</script>
</body>
</html>`;

  return (
    <View style={styles.container}>
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

      <VoiceGuide message={voiceMessage} />

      {/* 🚀 這裡就是重頭戲：改造後的右側按鈕群組 */}
      <View style={styles.rightButtons}>
        {busLoading && (
          <View style={styles.loadingBadge}>
            <ActivityIndicator size="small" color="#4A90E2" />
            <Text style={styles.loadingText}>更新中...</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.glassBtn, isLocating && styles.glassBtnActive]}
          onPress={handleLocatePress}
          activeOpacity={0.7}
        >
          {/* 漂亮的導航箭頭取代小人 Emoji */}
          <Ionicons 
            name={isLocating ? "navigate" : "navigate-outline"} 
            size={24} 
            color={isLocating ? "#4A90E2" : "white"} 
          />
        </TouchableOpacity>

        {!isNavigating && (
          <TouchableOpacity
            style={styles.glassBtn}
            onPress={() => setShowCards(true)}
            activeOpacity={0.7}
          >
            {/* 卡片圖示取代標靶 Emoji */}
            <Ionicons name="albums-outline" size={24} color="white" />
          </TouchableOpacity>
        )}

        {!isNavigating && (
          <TouchableOpacity
            style={styles.glassBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            {/* 乾淨的房子圖示取代原本的房子 Emoji */}
            <Ionicons name="home-outline" size={24} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {geofenceEvent && !isNavigating && (
        <GeofenceAlert event={geofenceEvent} onNavigate={(e) => { setGeofenceEvent(null); startNavigation(e); }} onDismiss={() => setGeofenceEvent(null)} />
      )}
      {isNavigating && navigationRoute && (
        <NavigationPanel route={navigationRoute} currentLocation={realLocation} targetEvent={navigationTarget} onEndRoute={endNavigation} onOverview={() => { if (realLocation) { sendToMap('flyTo', { lat: realLocation.latitude, lng: realLocation.longitude, zoom: 14 }); } }} />
      )}

      {showCards && (
        <SwipeCards
          events={events}
          onSwipe={(event, direction) => {
            if (direction === 'right') { setShowCards(false); startNavigation(event); }
          }}
          onClose={() => setShowCards(false)}
        />
      )}

      <Modal visible={showEventDetail} transparent animationType="slide">
        <HistoricalEventCard event={currentEvent} onClose={() => setShowEventDetail(false)} onNavigate={(lat, lng) => { setShowEventDetail(false); startNavigation({ ...currentEvent, lat, lng }); }} />
      </Modal>
    </View>
  );
}

// 🚀 改造後的高質感毛玻璃樣式
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webView: { flex: 1, width, height },

  rightButtons: {
    position: 'absolute',
    right: 20,
    bottom: 140, 
    alignItems: 'center',
    gap: 16, 
  },

  glassBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(28, 28, 30, 0.85)', 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)', 
  },
  glassBtnActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderColor: '#4A90E2',
    borderWidth: 1.5,
  },

  loadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  loadingText: {
    color: '#4A90E2',
    fontSize: 12,
    fontWeight: '600',
  },
});