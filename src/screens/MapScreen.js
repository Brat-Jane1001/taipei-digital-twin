/**
 * MapScreen.js - 完美融合高質感 UI 與後端導航功能版
 *
 * 功能：
 * 1. Mapbox 3D 台北地圖，自由拖曳
 * 2. DOGE 小人（🐕）= 真實 GPS 位置
 * 3. 定位按鈕 → 飛回自己位置 (高質感毛玻璃 + Ionicons)
 * 4. 公車：進入頁面/回到主畫面時抓一次靜態位置（不做移動動畫）
 * 5. 公車站牌（橘點，Nearby API）
 * 6. 捷運站（各線顏色）
 * 7. 活動標記（從後端 API 拿資料）
 * 8. Apple Maps 風格導航：
 * - 頂部：大字距離 + 明確轉彎箭頭 SVG + 路名
 * - 底部：抵達時間 / 分鐘 / 公里 + 結束按鈕
 * - 導航失敗自動 fallback 到 driving 模式
 * 9. Tinder 滑卡活動推薦
 * 10. 地理圍欄：走近活動觸發提示
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  SafeAreaView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons'; // 👈 召喚高質感圖示的魔法陣

import SwipeCards from '../components/SwipeCards';
import HistoricalEventCard from '../components/HistoricalEventCard';
import VoiceGuide from '../components/VoiceGuide';
import GeofenceAlert from '../components/GeofenceAlert';

import EventService from '../services/EventService';
import LocationService from '../services/LocationService';
import { useAppStore } from '../store/appStore';

const { width, height } = Dimensions.get('window');

// ===== 填入你的 Token =====
const MAPBOX_TOKEN   = '';
const TDX_CLIENT_ID  = '';
const TDX_CLIENT_SECRET = '';
const GEOFENCE_RADIUS_KM = 0.1;

// 台北捷運站靜態資料
const MRT_STATIONS = [
  { id:'BL11', name:'Ximen',            nameZh:'西門',      lat:25.0423, lng:121.5076, line:'BL', color:'#0070BD' },
  { id:'BL12', name:'Longshan Temple',    nameZh:'龍山寺',    lat:25.0366, lng:121.4997, line:'BL', color:'#0070BD' },
  { id:'BL10', name:'Taipei Main Station', nameZh:'台北車站',  lat:25.0478, lng:121.5170, line:'BL', color:'#0070BD' },
  { id:'BL07', name:'Zhongxiao Xinsheng', nameZh:'忠孝新生',  lat:25.0424, lng:121.5330, line:'BL', color:'#0070BD' },
  { id:'BL08', name:'Zhongxiao Dunhua',   nameZh:'忠孝敦化',  lat:25.0418, lng:121.5510, line:'BL', color:'#0070BD' },
  { id:'BL06', name:'Zhongxiao Fuxing',   nameZh:'忠孝復興',  lat:25.0418, lng:121.5449, line:'BL', color:'#0070BD' },
  { id:'R10',  name:'Taipei Main Station', nameZh:'台北車站',  lat:25.0479, lng:121.5168, line:'R',  color:'#E3121A' },
  { id:'R11',  name:'Zhongshan',           nameZh:'中山',      lat:25.0631, lng:121.5203, line:'R',  color:'#E3121A' },
  { id:'R09',  name:'CKS Memorial Hall',   nameZh:'中正紀念堂',lat:25.0336, lng:121.5200, line:'R',  color:'#E3121A' },
  { id:'R08',  name:'Guting',              nameZh:'古亭',      lat:25.0260, lng:121.5293, line:'R',  color:'#E3121A' },
  { id:'G15',  name:'Guting',              nameZh:'古亭',      lat:25.0253, lng:121.5313, line:'G',  color:'#008659' },
  { id:'G16',  name:'Zhongzheng Jr High',  nameZh:'中正國中',  lat:25.0342, lng:121.5386, line:'G',  color:'#008659' },
  { id:'O11',  name:'Zhongyi',             nameZh:'忠義',      lat:25.0483, lng:121.5047, line:'O',  color:'#F8A81E' },
  { id:'O12',  name:'Longshan Temple',     nameZh:'龍山寺',    lat:25.0358, lng:121.4993, line:'O',  color:'#F8A81E' },
];

// ============================================================
// Apple Maps 風格頂部轉彎 Banner
// ============================================================
function TopNavBanner({ step, nextStep, slideAnim }) {
  if (!step) return null;

  const dist = step.distance < 1000
    ? `${Math.round(step.distance)}`
    : `${(step.distance / 1000).toFixed(1)}`;
  const unit = step.distance < 1000 ? '公尺' : '公里';

  const getStreetName = (instr = '') => {
    const patterns = [/onto (.+)$/i, /on (.+)$/i, /along (.+)$/i, /toward (.+)$/i];
    for (const p of patterns) {
      const m = instr.match(p);
      if (m) return m[1];
    }
    return instr;
  };

  const ArrowSVG = ({ modifier, type, size = 52 }) => {
    const s = size;
    if (type === 'arrive') return <Text style={{ fontSize: s * 0.65 }}>🏁</Text>;
    if (!modifier || modifier === 'straight') {
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s, color: 'white', fontWeight: '200', lineHeight: s }}>↑</Text>
        </View>
      );
    }
    if (modifier === 'left' || modifier === 'sharp left') {
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s, color: 'white', fontWeight: '200', lineHeight: s }}>↰</Text>
        </View>
      );
    }
    if (modifier === 'right' || modifier === 'sharp right') {
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s, color: 'white', fontWeight: '200', lineHeight: s }}>↱</Text>
        </View>
      );
    }
    if (modifier === 'slight left') {
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s, color: 'white', fontWeight: '200', lineHeight: s }}>↖</Text>
        </View>
      );
    }
    if (modifier === 'slight right') {
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s, color: 'white', fontWeight: '200', lineHeight: s }}>↗</Text>
        </View>
      );
    }
    if (modifier === 'uturn') {
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s, color: 'white', fontWeight: '200', lineHeight: s }}>↩</Text>
        </View>
      );
    }
    return <Text style={{ fontSize: s, color: 'white' }}>↑</Text>;
  };

  const SmallArrow = ({ modifier, type }) => {
    const chars = {
      'left': '↰', 'sharp left': '↰',
      'right': '↱', 'sharp right': '↱',
      'slight left': '↖', 'slight right': '↗',
      'uturn': '↩', 'straight': '↑',
    };
    if (type === 'arrive') return <Text style={{ fontSize: 18, color: '#8E8E93' }}>🏁</Text>;
    return <Text style={{ fontSize: 22, color: '#8E8E93' }}>{chars[modifier] || '↑'}</Text>;
  };

  return (
    <Animated.View style={[nav.topBanner, { transform: [{ translateY: slideAnim }] }]}>
      <SafeAreaView>
        <View style={nav.topRow}>
          <View style={nav.arrowBox}>
            <ArrowSVG modifier={step.modifier} type={step.type} size={50} />
          </View>
          <View style={nav.infoBox}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={nav.distNum}>{dist}</Text>
              <Text style={nav.distUnit}>{unit}</Text>
            </View>
            <Text style={nav.streetName} numberOfLines={1}>
              {getStreetName(step.instruction)}
            </Text>
          </View>
          {nextStep && (
            <View style={nav.nextBox}>
              <Text style={nav.nextLabel}>接著</Text>
              <SmallArrow modifier={nextStep.modifier} type={nextStep.type} />
            </View>
          )}
        </View>
        <Text style={nav.fullInstr} numberOfLines={1}>
          {step.instruction}
        </Text>
      </SafeAreaView>
    </Animated.View>
  );
}

// ============================================================
// Apple Maps 底部 ETA 條
// ============================================================
function BottomETABar({ route, currentStepIdx, targetEvent, onEndRoute, slideAnim }) {
  if (!route) return null;

  const progress = Math.min((currentStepIdx / Math.max(route.steps?.length - 1, 1)), 1);
  const mins     = Math.round(route.duration / 60);
  const km       = (route.distance / 1000).toFixed(1);
  const now      = new Date();
  const arrival  = new Date(now.getTime() + route.duration * 1000);
  const eta      = arrival.toLocaleTimeString('zh-TW', { hour: 'numeric', minute: '2-digit', hour12: false });

  return (
    <Animated.View style={[nav.bottomBar, { transform: [{ translateY: slideAnim }] }]}>
      <View style={nav.progressTrack}>
        <View style={[nav.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={nav.bottomRow}>
        <View style={nav.etaBlock}>
          <Text style={nav.etaBig}>{eta}</Text>
          <Text style={nav.etaSub}>抵達</Text>
        </View>
        <View style={nav.etaDivider} />
        <View style={nav.etaBlock}>
          <Text style={nav.etaBig}>{mins}</Text>
          <Text style={nav.etaSub}>分鐘</Text>
        </View>
        <View style={nav.etaDivider} />
        <View style={nav.etaBlock}>
          <Text style={nav.etaBig}>{km}</Text>
          <Text style={nav.etaSub}>公里</Text>
        </View>
        <TouchableOpacity style={nav.endBtn} onPress={onEndRoute}>
          <Text style={nav.endBtnText}>結束</Text>
        </TouchableOpacity>
      </View>
      {targetEvent && (
        <Text style={nav.destName} numberOfLines={1}>
          {targetEvent.tags?.includes('food') ? '🍜 ' :
           targetEvent.tags?.includes('music') ? '🎵 ' :
           targetEvent.tags?.includes('art') ? '🎨 ' : '📍 '}
          {targetEvent.title}
        </Text>
      )}
    </Animated.View>
  );
}

// ============================================================
// 主元件
// ============================================================
export default function MapScreen({ navigation }) {
  const webViewRef = useRef(null);
  
  // GPS 狀態
  const [realLocation, setRealLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // 導航狀態
  const [navigationRoute, setNavigationRoute] = useState(null);
  const [navigationTarget, setNavigationTarget] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // Apple Maps 動畫核心
  const topBannerAnim = useRef(new Animated.Value(-200)).current;
  const bottomBarAnim = useRef(new Animated.Value(300)).current;

  // UI 互動狀態
  const [showCards, setShowCards] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [geofenceEvent, setGeofenceEvent] = useState(null);
  const [triggeredIds, setTriggeredIds] = useState(new Set());
  const [busLoading, setBusLoading] = useState(false);

  // TDX Token 快取變數
  const tdxTokenRef = useRef(null);
  const tdxTokenExpiryRef = useRef(null);
  const { events, setEvents } = useAppStore();

  // ── 初始化 ───────────────────────────────────────────
  useEffect(() => {
    loadEvents();
    startGPS();
  }, []);

  // ── 地圖就緒後初始化圖層 ─────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const t = setTimeout(() => {
      sendToMap('addMrtStations', { stations: MRT_STATIONS });
      sendToMap('addEventMarkers', { events });
      // 公車：進入頁面時抓一次靜態位置
      fetchBuses();
      fetchBusStops();
    }, 800);
    return () => clearTimeout(t);
  }, [mapReady, events]);

  // ── 位置更新 → DOGE + 地理圍欄 + 導航步驟 ────────────
  useEffect(() => {
    if (!realLocation || !mapReady) return;
    sendToMap('updateDoge', { lat: realLocation.latitude, lng: realLocation.longitude });
    if (!isNavigating) checkGeofences(realLocation);
    if (isNavigating && navigationRoute) updateStep(realLocation);
  }, [realLocation, mapReady]);

  const loadEvents = async () => {
    try {
      const allEvents = await EventService.getAllEvents();
      setEvents(allEvents);
    } catch (e) { console.error('載入景點活動失敗:', e); }
  };

  // ── GPS 持續追蹤 ─────────────────────────────────────
  const startGPS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setRealLocation({
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
      });
      await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 8 },
        loc => setRealLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        })
      );
    } catch (e) { console.error('GPS追蹤錯誤:', e); }
  };

  // ── 定位按鈕（精確重取GPS並追蹤）──────────────────────────
  const handleLocatePress = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setRealLocation({ latitude: lat, longitude: lng });
      sendToMap('flyTo', { lat, lng, zoom: 17 });
      speakText('已更新目前定位！');
    } catch (e) {
      console.error('重新定位錯誤:', e);
    } finally {
      setTimeout(() => setIsLocating(false), 1500);
    }
  };

  // ── TDX API Token 處理 ────────────────────────────────
  const getTdxToken = async () => {
    if (tdxTokenRef.current && Date.now() < (tdxTokenExpiryRef.current || 0)) {
      return tdxTokenRef.current;
    }
    const r = await fetch(
      'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&client_id=${TDX_CLIENT_ID}&client_secret=${TDX_CLIENT_SECRET}`,
      }
    );
    const d = await r.json();
    tdxTokenRef.current = d.access_token;
    tdxTokenExpiryRef.current = Date.now() + (d.expires_in - 300) * 1000;
    return d.access_token;
  };

  // ── 公車靜態載入（只抓一次，不做移動動畫）────────────
  const fetchBuses = async () => {
    try {
      setBusLoading(true);
      const token = await getTdxToken();
      const r = await fetch(
        'https://tdx.transportdata.tw/api/basic/v2/Bus/RealTimeByFrequency/City/Taipei?$top=300&$format=JSON',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const raw = await r.json();
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

      console.log('✅ 靜態公車數據加載成功，數量:', buses.length);
      sendToMap('setBuses', { buses });
    } catch (e) {
      console.error('公車快取載入失敗:', e.message);
    } finally {
      setBusLoading(false);
    }
  };

  // ── 公車站牌（Nearby API 橘點圖層）─────────────────────
  const fetchBusStops = async () => {
    try {
      const token = await getTdxToken();
      const points = [
        { lat: 25.0424, lng: 121.5065 },
        { lat: 25.0478, lng: 121.5170 },
        { lat: 25.0418, lng: 121.5449 },
        { lat: 25.0330, lng: 121.5654 },
      ];
      const allStops = [];
      const seenIds = new Set();

      await Promise.allSettled(points.map(async p => {
        try {
          const r = await fetch(
            `https://tdx.transportdata.tw/api/basic/V3/Map/Bus/Network/Stop/City/Taipei/Nearby/${p.lng}/${p.lat}/1000?$format=JSON`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const gj = await r.json();
          (gj?.features ?? []).forEach(f => {
            const props = f.properties || {};
            const coords = f.geometry?.coordinates;
            if (!coords || seenIds.has(props.StopUID)) return;
            seenIds.add(props.StopUID);
            allStops.push({
              id: props.StopUID || `${coords[0]}_${coords[1]}`,
              name: props.StopName?.Zh_tw || '',
              nameEn: props.StopName?.En || '',
              routeName: props.RouteName?.Zh_tw || '',
              lng: coords[0],
              lat: coords[1],
            });
          });
        } catch (_) {}
      }));

      console.log('✅ 周邊公車站牌獲取完畢，數量:', allStops.length);
      sendToMap('addBusStops', { stops: allStops });
    } catch (e) { console.error('公車站牌下載錯誤:', e); }
  };

  // ── 地理圍欄偵測 ──────────────────────────────────────
  const checkGeofences = useCallback((loc) => {
    if (!events?.length || geofenceEvent) return;
    events.forEach(ev => {
      if (triggeredIds.has(ev.id)) return;
      const d = LocationService.calculateDistance(loc.latitude, loc.longitude, ev.lat, ev.lng);
      if (d <= GEOFENCE_RADIUS_KM) {
        setGeofenceEvent({ ...ev, distance: d });
        setTriggeredIds(prev => new Set([...prev, ev.id]));
        speakText(`您已接近景點： ${ev.title}!`);
      }
    });
  }, [events, geofenceEvent, triggeredIds]);

  // ── 開始導航機制（walking → driving fallback）──────────
  const startNavigation = async (event) => {
    if (!realLocation) {
      speakText('請稍候，定位抓取中。');
      return;
    }
    try {
      speakText(`開始導航至 ${event.title}`);
      setIsNavigating(true);
      setCurrentStepIdx(0);

      let route = null;

      // 優先嘗試步行(walking)，失敗則無縫 fallback 至開車(driving)
      for (const profile of ['walking', 'driving']) {
        try {
          const url =
            `https://api.mapbox.com/directions/v5/mapbox/${profile}/` +
            `${realLocation.longitude},${realLocation.latitude};${event.lng},${event.lat}` +
            `?steps=true&voice_instructions=true&banner_instructions=true` +
            `&geometries=geojson&language=zh&access_token=${MAPBOX_TOKEN}`;
          const r = await fetch(url);
          const data = await r.json();

          if (data.routes?.length > 0) {
            const rt = data.routes[0];
            route = {
              geometry: rt.geometry,
              distance: rt.distance,
              duration: rt.duration,
              steps: rt.legs[0].steps.map(s => ({
                instruction: s.maneuver.instruction,
                distance: s.distance,
                duration: s.duration,
                type: s.maneuver.type,
                modifier: s.maneuver.modifier || 'straight',
                location: s.maneuver.location,
              })),
            };
            break;
          }
        } catch (_) {}
      }

      if (!route) {
        speakText('無法生成路徑，請稍後再試。');
        setIsNavigating(false);
        return;
      }

      setNavigationRoute(route);
      setNavigationTarget(event);
      sendToMap('drawRoute', { geometry: route.geometry });
      sendToMap('flyTo', { lat: realLocation.latitude, lng: realLocation.longitude, zoom: 17 });

      if (route.steps[0]) speakText(route.steps[0].instruction);

      // Apple Maps Banner 高端絲滑滑入動畫
      Animated.parallel([
        Animated.spring(topBannerAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
        Animated.spring(bottomBarAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();

    } catch (e) {
      speakText('導航連線失敗。');
      setIsNavigating(false);
      console.error('導航核心錯誤:', e);
    }
  };

  // ── 更新導航路徑（當真實 GPS 發生經緯度移動時）─────────
  const updateStep = (loc) => {
    if (!navigationRoute?.steps) return;
    let minDist = Infinity, idx = 0;
    navigationRoute.steps.forEach((s, i) => {
      const [sLng, sLat] = s.location || [0, 0];
      const d = Math.sqrt(
        Math.pow((loc.longitude - sLng) * 111320 * Math.cos(loc.latitude * Math.PI / 180), 2) +
        Math.pow((loc.latitude - sLat) * 110540, 2)
      );
      if (d < minDist) { minDist = d; idx = i; }
    });
    if (idx !== currentStepIdx) {
      setCurrentStepIdx(idx);
      speakText(navigationRoute.steps[idx]?.instruction || '');
    }
  };

  // ── 結束導航與 Banner 滑出邏輯 ─────────────────────────
  const endNavigation = () => {
    Animated.parallel([
      Animated.timing(topBannerAnim, { toValue: -200, duration: 250, useNativeDriver: true }),
      Animated.timing(bottomBarAnim, { toValue: 300, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setNavigationRoute(null);
      setNavigationTarget(null);
      setIsNavigating(false);
      setCurrentStepIdx(0);
      sendToMap('clearRoute', {});
      speakText('導航已關閉。');
    });
  };

  // ── WebView 與 Mapbox 底層雙向通訊 ───────────────────
  const sendToMap = (action, data) => {
    webViewRef.current?.injectJavaScript(`
      if (window.handleMsg) window.handleMsg(${JSON.stringify({ action, data })});
      true;
    `);
  };

  const onWebMsg = (e) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      switch (msg.type) {
        case 'mapReady': 
          setMapReady(true); 
          break;
        case 'eventClicked':
          const ev = events.find(x => x.id === msg.data.id);
          if (ev) { setCurrentEvent(ev); setShowEventDetail(true); }
          break;
        case 'busStopClicked':
          speakText(`公車站牌: ${msg.data.name}`);
          break;
        case 'mrtClicked':
          speakText(`捷運站: ${msg.data.name}`);
          break;
      }
    } catch (_) {}
  };

  const speakText = (text) => {
    setVoiceMessage(text);
    Speech.speak(text, { language: 'zh-TW', rate: 0.95 });
  };

  const currentStep = navigationRoute?.steps?.[currentStepIdx] || null;
  const nextStep = navigationRoute?.steps?.[currentStepIdx + 1] || null;

  // ── Mapbox HTML 注入 ─────────────────────────────────
  const mapHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.js"></script>
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.css" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body, html { width:100%; height:100%; overflow:hidden; background:#000; }
    #map { width:100%; height:100%; }
    .doge { font-size:32px; filter:drop-shadow(0 3px 8px rgba(0,0,0,.7)); animation:bob 1.6s ease-in-out infinite alternate; cursor:default; }
    @keyframes bob { from { transform:translateY(0); } to { transform:translateY(-5px); } }
    .bus-wrap { display:flex; flex-direction:column; align-items:center; cursor:pointer; }
    .bus-tag { background:rgba(20,60,180,.8); color:#fff; font-size:8px; font-weight:700; padding:1px 4px; border-radius:3px; margin-bottom:1px; white-space:nowrap; }
    .bus-svg { opacity:.65; }
    .stop-dot { width:9px; height:9px; border-radius:50%; background:rgba(255,140,0,.75); border:1.5px solid rgba(255,210,100,.9); cursor:pointer; }
    .mrt-wrap { position:relative; display:flex; flex-direction:column; align-items:center; cursor:pointer; }
    .mrt-dot { width:13px; height:13px; border-radius:50%; border:2px solid white; box-shadow:0 1px 5px rgba(0,0,0,.5); }
    .mrt-name { position:absolute; bottom:16px; color:white; font-size:8px; font-weight:700; white-space:nowrap; pointer-events:none; text-shadow:0 1px 3px rgba(0,0,0,.9); }
    .ev-pin { font-size:26px; cursor:pointer; filter:drop-shadow(0 2px 5px rgba(0,0,0,.6)); }
    .ev-pin:active { transform:scale(1.2); }
  </style>
</head>
<body>
<div id="map"></div>
<script>
mapboxgl.accessToken = '${MAPBOX_TOKEN}';
const map = new mapboxgl.Map({
  container: 'map', style: 'mapbox://styles/mapbox/standard', center: [121.5065, 25.0424], zoom: 14, pitch: 45, bearing: 0, minZoom: 11, maxZoom: 19,
});

let dogeMk = null;
const busMks={}, stopMks={}, mrtMks={}, evMks={};

map.on('load', () => {
  map.addSource('dem', { type:'raster-dem', url:'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize:512 });
  map.setTerrain({ source:'dem', exaggeration:1.2 });

  map.addLayer({
    id:'bldg', source:'composite', 'source-layer':'building', filter:['==','extrude','true'], type:'fill-extrusion', minzoom:14,
    paint:{ 'fill-extrusion-color':'#b0b8c8', 'fill-extrusion-height':['get','height'], 'fill-extrusion-base':['get','min_height'], 'fill-extrusion-opacity':0.65 },
  });

  map.addSource('route', { type:'geojson', data:{ type:'Feature', geometry:{ type:'LineString', coordinates:[] } } });
  map.addLayer({ id:'route-bg', type:'line', source:'route', paint:{ 'line-color':'white', 'line-width':12, 'line-opacity':.3 }, layout:{ 'line-join':'round', 'line-cap':'round' } });
  map.addLayer({ id:'route-main', type:'line', source:'route', paint:{ 'line-color':'#1A73E8', 'line-width':6, 'line-opacity':.95 }, layout:{ 'line-join':'round', 'line-cap':'round' } });

  const el = document.createElement('div'); el.className='doge'; el.innerHTML='🐕';
  dogeMk = new mapboxgl.Marker({ element:el, anchor:'bottom' }).setLngLat([121.5065, 25.0424]).addTo(map);

  sendRN('mapReady', {});
});

window.handleMsg = function({ action, data }) {
  switch (action) {
    case 'updateDoge': dogeMk?.setLngLat([data.lng, data.lat]); break;
    case 'flyTo': map.flyTo({ center:[data.lng, data.lat], zoom:data.zoom||17, pitch:50, duration:1500 }); break;
    case 'setBuses':
      Object.values(busMks).forEach(m => m.remove());
      Object.keys(busMks).forEach(k => delete busMks[k]);
      data.buses.forEach(b => {
        const w = document.createElement('div'); w.className='bus-wrap';
        const tag = document.createElement('div'); tag.className='bus-tag'; tag.textContent=b.routeName;
        const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
        svg.setAttribute('width','26'); svg.setAttribute('height','26'); svg.setAttribute('viewBox','0 0 32 32'); svg.className='bus-svg';
        svg.innerHTML = '<rect x="3" y="8" width="26" height="15" rx="3" fill="rgba(20,80,200,.45)" stroke="#5599EE" stroke-width="1.5"/><line x1="3" y1="15" x2="29" y2="15" stroke="#7AB8F5" stroke-width=".8"/><circle cx="9" cy="24" r="2.5" fill="none" stroke="#5599EE" stroke-width="1.5"/><circle cx="23" cy="24" r="2.5" fill="none" stroke="#5599EE" stroke-width="1.5"/>';
if (b.heading) svg.style.transform = 'rotate(' + (b.heading - 90) + 'deg)';
        w.appendChild(tag); w.appendChild(svg);
        busMks[b.id] = new mapboxgl.Marker({ element:w, anchor:'bottom' }).setLngLat([b.lng, b.lat]).addTo(map);
      });
      break;
    case 'addBusStops':
      data.stops.forEach(s => {
        if (stopMks[s.id]) return;
        const el = document.createElement('div'); el.className='stop-dot';
        el.addEventListener('click', () => { sendRN('busStopClicked', { name:s.name }); });
        stopMks[s.id] = new mapboxgl.Marker({ element:el, anchor:'center' }).setLngLat([s.lng, s.lat]).addTo(map);
      });
      break;
    case 'addMrtStations':
      data.stations.forEach(st => {
        if (mrtMks[st.id]) return;
        const w = document.createElement('div'); w.className='mrt-wrap';
        const nm = document.createElement('div'); nm.className='mrt-name'; nm.textContent=st.nameZh;
        const dot = document.createElement('div'); dot.className='mrt-dot'; dot.style.background=st.color;
        dot.addEventListener('click', () => { sendRN('mrtClicked', { name:st.nameZh }); });
        w.appendChild(nm); w.appendChild(dot);
        mrtMks[st.id] = new mapboxgl.Marker({ element:w, anchor:'center' }).setLngLat([st.lng, st.lat]).addTo(map);
      });
      break;
    case 'addEventMarkers':
      data.events.forEach(ev => {
        if (evMks[ev.id]) return;
        const el = document.createElement('div'); el.className='ev-pin';
        el.innerHTML = ev.tags?.includes('food')?'🍜':ev.tags?.includes('music')?'🎵':ev.tags?.includes('art')?'🎨':'📍';
        el.addEventListener('click', () => sendRN('eventClicked', { id:ev.id }));
        evMks[ev.id] = new mapboxgl.Marker({ element:el, anchor:'bottom' }).setLngLat([ev.lng, ev.lat]).addTo(map);
      });
      break;
    case 'drawRoute': map.getSource('route').setData(data.geometry); break;
    case 'clearRoute': map.getSource('route').setData({ type:'Feature', geometry:{ type:'LineString', coordinates:[] } }); break;
  }
};
function sendRN(type, data) { window.ReactNativeWebView?.postMessage(JSON.stringify({ type, data })); }
</script>
</body>
</html>`;

  return (
    <View style={styles.container}>
      {/* 3D 渲染核心 WebView */}
      <WebView
        ref={webViewRef}
        source={{ html: mapHTML }}
        style={styles.webView}
        onMessage={onWebMsg}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        allowUniversalAccessFromFileURLs
      />

      {/* Apple Maps 頂部轉彎 Banner */}
      {isNavigating && (
        <TopNavBanner
          step={currentStep}
          nextStep={nextStep}
          slideAnim={topBannerAnim}
        />
      )}

      {/* 語音提示元件 */}
      {!isNavigating && <VoiceGuide message={voiceMessage} />}

      {/* 🚀 經由你重新改造過的高質感毛玻璃按鈕群組 (僅在非導航模式顯示) */}
      {!isNavigating && (
        <View style={styles.rightButtons}>
          {busLoading && (
            <View style={styles.loadingBadge}>
              <ActivityIndicator size="small" color="#4A90E2" />
              <Text style={styles.loadingText}>更新中...</Text>
            </View>
          )}

          {/* 1. 高質感毛玻璃定位按鈕 */}
          <TouchableOpacity
            style={[styles.glassBtn, isLocating && styles.glassBtnActive]}
            onPress={handleLocatePress}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={isLocating ? "navigate" : "navigate-outline"} 
              size={24} 
              color={isLocating ? "#4A90E2" : "white"} 
            />
          </TouchableOpacity>

          {/* 2. 高質感毛玻璃活動滑卡按鈕 */}
          <TouchableOpacity
            style={styles.glassBtn}
            onPress={() => setShowCards(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="albums-outline" size={24} color="white" />
          </TouchableOpacity>

          {/* 3. 高質感毛玻璃返回首頁按鈕 */}
          <TouchableOpacity
            style={styles.glassBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="home-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      )}

      {/* Apple Maps 底部 ETA 條 */}
      {isNavigating && (
        <BottomETABar
          route={navigationRoute}
          currentStepIdx={currentStepIdx}
          targetEvent={navigationTarget}
          onEndRoute={endNavigation}
          slideAnim={bottomBarAnim}
        />
      )}

      {/* 地理圍欄警示 */}
      {geofenceEvent && !isNavigating && (
        <GeofenceAlert
          event={geofenceEvent}
          onNavigate={ev => { setGeofenceEvent(null); startNavigation(ev); }}
          onDismiss={() => setGeofenceEvent(null)}
        />
      )}

      {/* Tinder 推薦卡片 */}
      {showCards && (
        <SwipeCards
          events={events}
          onSwipe={(ev, dir) => {
            if (dir === 'right') { setShowCards(false); startNavigation(ev); }
          }}
          onClose={() => setShowCards(false)}
        />
      )}

      {/* 活動詳情彈出視窗 */}
      <Modal visible={showEventDetail} transparent animationType="slide">
        <HistoricalEventCard 
          event={currentEvent} 
          onClose={() => setShowEventDetail(false)} 
          onNavigate={(lat, lng) => { setShowEventDetail(false); startNavigation({ ...currentEvent, lat, lng }); }} 
        />
      </Modal>
    </View>
  );
}

// ============================================================
// 整合優化後的完全體樣式表 (包含毛玻璃與 Apple Maps 元素)
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webView: { flex: 1, width, height },

  // 右側高質感毛玻璃按鈕群組
  rightButtons: {
    position: 'absolute',
    right: 20,
    bottom: 120, 
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

const nav = StyleSheet.create({
  // Apple Maps 頂部導航橫幅
  topBanner: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: '#1C1C1E',
    paddingBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: .45, shadowRadius: 8, elevation: 15,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 12,
    gap: 12,
  },
  arrowBox:   { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoBox:    { flex: 1 },
  distNum:    { color: 'white', fontSize: 36, fontWeight: '700', lineHeight: 42 },
  distUnit:   { color: '#8E8E93', fontSize: 16, fontWeight: '400' },
  streetName: { color: 'white', fontSize: 18, fontWeight: '400', marginTop: 2 },
  nextBox:    { alignItems: 'center', gap: 2, marginRight: 4 },
  nextLabel:  { color: '#636366', fontSize: 10, fontWeight: '600' },
  fullInstr:  { color: '#8E8E93', fontSize: 12, paddingHorizontal: 16, paddingTop: 6 },

  // Apple Maps 底部 ETA 控制列
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 },
    shadowOpacity: .4, shadowRadius: 10, elevation: 15,
  },
  progressTrack: { height: 4, backgroundColor: '#2C2C2E', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: '#1A73E8' },
  bottomRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  etaBlock:      { flex: 1, alignItems: 'center' },
  etaBig:        { color: 'white', fontSize: 22, fontWeight: '700' },
  etaSub:        { color: '#8E8E93', fontSize: 11, marginTop: 2 },
  etaDivider:    { width: 1, height: 30, backgroundColor: '#48484A' },
  endBtn:        { backgroundColor: '#FF3B30', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, marginLeft: 6 },
  endBtnText:    { color: 'white', fontSize: 16, fontWeight: '700' },
  destName:      { color: '#8E8E93', fontSize: 13, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 2 },
});