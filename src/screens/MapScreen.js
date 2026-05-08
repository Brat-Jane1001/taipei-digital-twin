/**
 * MapScreen.js - 最終完整版
 *
 * 功能：
 * 1. Mapbox 3D 台北地圖，自由拖曳
 * 2. DOGE 小人（🐕）= 真實 GPS 位置
 * 3. 定位按鈕 → 飛回自己位置
 * 4. 公車：進入頁面/回到主畫面時抓一次靜態位置（不做移動動畫）
 * 5. 公車站牌（橘點，Nearby API）
 * 6. 捷運站（各線顏色）
 * 7. 活動標記（從後端 API 拿資料）
 * 8. Apple Maps 風格導航：
 *    - 頂部：大字距離 + 明確轉彎箭頭 SVG + 路名
 *    - 底部：抵達時間 / 分鐘 / 公里 + 結束按鈕
 *    - 導航失敗自動 fallback 到 driving 模式
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

// ===== 捷運站靜態資料 =====
const MRT_STATIONS = [
  { id:'BL11', name:'Ximen',               nameZh:'西門',      lat:25.0423, lng:121.5076, line:'BL', color:'#0070BD' },
  { id:'BL12', name:'Longshan Temple',     nameZh:'龍山寺',    lat:25.0366, lng:121.4997, line:'BL', color:'#0070BD' },
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
// 大字距離 + SVG 轉彎箭頭 + 路名（仿照 Apple Maps）
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

  // SVG 轉彎箭頭（明確方向）
  const ArrowSVG = ({ modifier, type, size = 52 }) => {
    const s = size;
    if (type === 'arrive') {
      return <Text style={{ fontSize: s * 0.65 }}>🏁</Text>;
    }
    // 直行
    if (!modifier || modifier === 'straight') {
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s, color: 'white', fontWeight: '200', lineHeight: s + 4 }}>↑</Text>
        </View>
      );
    }
    // 左轉
    if (modifier === 'left' || modifier === 'sharp left') {
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s, color: 'white', fontWeight: '200', lineHeight: s + 4 }}>↰</Text>
        </View>
      );
    }
    // 右轉
    if (modifier === 'right' || modifier === 'sharp right') {
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s, color: 'white', fontWeight: '200', lineHeight: s + 4 }}>↱</Text>
        </View>
      );
    }
    // 稍微左
    if (modifier === 'slight left') {
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s, color: 'white', fontWeight: '200', lineHeight: s + 4 }}>↖</Text>
        </View>
      );
    }
    // 稍微右
    if (modifier === 'slight right') {
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s, color: 'white', fontWeight: '200', lineHeight: s + 4 }}>↗</Text>
        </View>
      );
    }
    // U 迴轉
    if (modifier === 'uturn') {
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s, color: 'white', fontWeight: '200', lineHeight: s + 4 }}>↩</Text>
        </View>
      );
    }
    return (
      <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: s, color: 'white', fontWeight: '200', lineHeight: s + 4 }}>↑</Text>
      </View>
    );
  };

  // 小箭頭（下一步預覽）
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
          {/* 左：SVG 轉彎箭頭 */}
          <View style={nav.arrowBox}>
            <ArrowSVG modifier={step.modifier} type={step.type} size={50} />
          </View>

          {/* 中：距離 + 路名 */}
          <View style={nav.infoBox}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={nav.distNum}>{dist}</Text>
              <Text style={nav.distUnit}>{unit}</Text>
            </View>
            <Text style={nav.streetName} numberOfLines={1}>
              {getStreetName(step.instruction)}
            </Text>
          </View>

          {/* 右：下一步小預覽 */}
          {nextStep && (
            <View style={nav.nextBox}>
              <Text style={nav.nextLabel}>接著</Text>
              <SmallArrow modifier={nextStep.modifier} type={nextStep.type} />
            </View>
          )}
        </View>

        {/* 完整指示文字 */}
        <Text style={nav.fullInstr} numberOfLines={1}>
          {step.instruction}
        </Text>
      </SafeAreaView>
    </Animated.View>
  );
}

// ============================================================
// Apple Maps 底部 ETA 條
// 抵達時間 | 分鐘 | 公里 + 結束按鈕
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
      {/* 進度條 */}
      <View style={nav.progressTrack}>
        <View style={[nav.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={nav.bottomRow}>
        {/* ETA */}
        <View style={nav.etaBlock}>
          <Text style={nav.etaBig}>{eta}</Text>
          <Text style={nav.etaSub}>抵達</Text>
        </View>
        <View style={nav.etaDivider} />
        {/* 分鐘 */}
        <View style={nav.etaBlock}>
          <Text style={nav.etaBig}>{mins}</Text>
          <Text style={nav.etaSub}>分鐘</Text>
        </View>
        <View style={nav.etaDivider} />
        {/* 公里 */}
        <View style={nav.etaBlock}>
          <Text style={nav.etaBig}>{km}</Text>
          <Text style={nav.etaSub}>公里</Text>
        </View>
        {/* 結束按鈕 */}
        <TouchableOpacity style={nav.endBtn} onPress={onEndRoute}>
          <Text style={nav.endBtnText}>結束</Text>
        </TouchableOpacity>
      </View>

      {/* 目的地名稱 */}
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

  // GPS
  const [realLocation,    setRealLocation]    = useState(null);
  const [isLocating,      setIsLocating]      = useState(false);
  const [mapReady,        setMapReady]        = useState(false);

  // 導航
  const [navigationRoute,  setNavigationRoute]  = useState(null);
  const [navigationTarget, setNavigationTarget] = useState(null);
  const [isNavigating,     setIsNavigating]     = useState(false);
  const [currentStepIdx,   setCurrentStepIdx]   = useState(0);

  // Apple Maps 動畫
  const topBannerAnim = useRef(new Animated.Value(-200)).current;
  const bottomBarAnim = useRef(new Animated.Value(300)).current;

  // UI
  const [showCards,       setShowCards]       = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [currentEvent,    setCurrentEvent]    = useState(null);
  const [voiceMessage,    setVoiceMessage]    = useState('');
  const [geofenceEvent,   setGeofenceEvent]   = useState(null);
  const [triggeredIds,    setTriggeredIds]    = useState(new Set());
  const [busLoading,      setBusLoading]      = useState(false);

  // TDX Token 快取
  const tdxTokenRef       = useRef(null);
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
    sendToMap('updateDoge', {
      lat: realLocation.latitude,
      lng: realLocation.longitude,
    });
    if (!isNavigating) checkGeofences(realLocation);
    if (isNavigating && navigationRoute) updateStep(realLocation);
  }, [realLocation, mapReady]);

  // ── GPS 持續追蹤 ─────────────────────────────────────
  const startGPS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setRealLocation({
        latitude:  initial.coords.latitude,
        longitude: initial.coords.longitude,
      });
      await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 8 },
        loc => setRealLocation({
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
        })
      );
    } catch (e) { console.error('GPS:', e); }
  };

  const loadEvents = async () => {
    try {
      const all = await EventService.getAllEvents();
      setEvents(all);
    } catch (e) { console.error('Load events:', e); }
  };

  // ── TDX Token ────────────────────────────────────────
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
    tdxTokenRef.current       = d.access_token;
    tdxTokenExpiryRef.current = Date.now() + (d.expires_in - 300) * 1000;
    return d.access_token;
  };

  // ── 公車靜態載入（只抓一次，不做移動動畫）────────────
  const fetchBuses = async () => {
    try {
      setBusLoading(true);
      const token = await getTdxToken();
      const r     = await fetch(
        'https://tdx.transportdata.tw/api/basic/v2/Bus/RealTimeByFrequency/City/Taipei?$top=300&$format=JSON',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const raw  = await r.json();
      const data = Array.isArray(raw) ? raw : (raw?.value ?? []);

      const buses = data
        .filter(b =>
          b?.BusPosition?.PositionLon &&
          b?.BusPosition?.PositionLat &&
          b?.DutyStatus === 1
        )
        .map(b => ({
          id:        b.PlateNumb,
          routeName: b.RouteName?.Zh_tw || '',
          lng:       b.BusPosition.PositionLon,
          lat:       b.BusPosition.PositionLat,
          heading:   b.Bearing || 0,
          speed:     b.Speed   || 0,
        }));

      console.log('✅ 公車數量:', buses.length);
      // setBuses = 靜態放置，不做動畫
      sendToMap('setBuses', { buses });
    } catch (e) {
      console.error('Bus fetch error:', e.message);
    } finally {
      setBusLoading(false);
    }
  };

  // ── 公車站牌（Nearby API）───────────────────────────
  const fetchBusStops = async () => {
    try {
      const token  = await getTdxToken();
      const points = [
        { lat: 25.0424, lng: 121.5065 },
        { lat: 25.0478, lng: 121.5170 },
        { lat: 25.0418, lng: 121.5449 },
        { lat: 25.0330, lng: 121.5654 },
      ];
      const allStops = [];
      const seenIds  = new Set();

      await Promise.allSettled(points.map(async p => {
        try {
          const r  = await fetch(
            `https://tdx.transportdata.tw/api/basic/V3/Map/Bus/Network/Stop/City/Taipei/Nearby/${p.lng}/${p.lat}/1000?$format=JSON`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const gj = await r.json();
          (gj?.features ?? []).forEach(f => {
            const props  = f.properties || {};
            const coords = f.geometry?.coordinates;
            if (!coords || seenIds.has(props.StopUID)) return;
            seenIds.add(props.StopUID);
            allStops.push({
              id:        props.StopUID || `${coords[0]}_${coords[1]}`,
              name:      props.StopName?.Zh_tw || '',
              nameEn:    props.StopName?.En    || '',
              routeName: props.RouteName?.Zh_tw || '',
              lng: coords[0],
              lat: coords[1],
            });
          });
        } catch (_) {}
      }));

      console.log('✅ 公車站牌:', allStops.length);
      sendToMap('addBusStops', { stops: allStops });
    } catch (e) { console.error('Bus stops:', e); }
  };

  // ── 地理圍欄 ─────────────────────────────────────────
  const checkGeofences = useCallback((loc) => {
    if (!events?.length || geofenceEvent) return;
    events.forEach(ev => {
      if (triggeredIds.has(ev.id)) return;
      const d = LocationService.calculateDistance(
        loc.latitude, loc.longitude, ev.lat, ev.lng
      );
      if (d <= GEOFENCE_RADIUS_KM) {
        setGeofenceEvent({ ...ev, distance: d });
        setTriggeredIds(prev => new Set([...prev, ev.id]));
        speakText(`You are near ${ev.title}!`);
      }
    });
  }, [events, geofenceEvent, triggeredIds]);

  // ── 定位按鈕（精確重取GPS）──────────────────────────
  const handleLocate = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setRealLocation({ latitude: lat, longitude: lng });
      sendToMap('flyTo', { lat, lng, zoom: 17 }); // lng 先，lat 後（Mapbox 格式）
      speakText('Found your location!');
    } catch (e) {
      console.error('Locate:', e);
    } finally {
      setTimeout(() => setIsLocating(false), 2000);
    }
  };

  // ── 開始導航（walking → driving fallback）────────────
  const startNavigation = async (event) => {
    if (!realLocation) {
      speakText('Please wait for location detection.');
      return;
    }
    try {
      speakText(`Starting navigation to ${event.title}`);
      setIsNavigating(true);
      setCurrentStepIdx(0);

      let route = null;

      // 先試 walking，失敗再試 driving
      for (const profile of ['walking', 'driving']) {
        try {
          const url =
            `https://api.mapbox.com/directions/v5/mapbox/${profile}/` +
            `${realLocation.longitude},${realLocation.latitude};${event.lng},${event.lat}` +
            `?steps=true&voice_instructions=true&banner_instructions=true` +
            `&geometries=geojson&language=zh&access_token=${MAPBOX_TOKEN}`;
          const r    = await fetch(url);
          const data = await r.json();

          if (data.routes?.length > 0) {
            const rt = data.routes[0];
            route = {
              geometry: rt.geometry,
              distance: rt.distance,
              duration: rt.duration,
              steps: rt.legs[0].steps.map(s => ({
                instruction: s.maneuver.instruction,
                distance:    s.distance,
                duration:    s.duration,
                type:        s.maneuver.type,
                modifier:    s.maneuver.modifier || 'straight',
                location:    s.maneuver.location,
              })),
            };
            break;
          }
        } catch (_) {}
      }

      if (!route) {
        speakText('Cannot find a route. Please try again.');
        setIsNavigating(false);
        return;
      }

      setNavigationRoute(route);
      setNavigationTarget(event);
      sendToMap('drawRoute', { geometry: route.geometry });
      sendToMap('flyTo', { lat: realLocation.latitude, lng: realLocation.longitude, zoom: 17 });

      if (route.steps[0]) speakText(route.steps[0].instruction);

      // Banner 滑入
      Animated.parallel([
        Animated.spring(topBannerAnim, { toValue: 0,   tension: 65, friction: 10, useNativeDriver: true }),
        Animated.spring(bottomBarAnim, { toValue: 0,   tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();

    } catch (e) {
      speakText('Navigation error. Please try again.');
      setIsNavigating(false);
      console.error('Nav:', e);
    }
  };

  // ── 更新導航步驟（GPS 變化時）────────────────────────
  const updateStep = (loc) => {
    if (!navigationRoute?.steps) return;
    let minDist = Infinity, idx = 0;
    navigationRoute.steps.forEach((s, i) => {
      const [sLng, sLat] = s.location || [0, 0];
      const d = Math.sqrt(
        Math.pow((loc.longitude - sLng) * 111320 * Math.cos(loc.latitude * Math.PI / 180), 2) +
        Math.pow((loc.latitude  - sLat) * 110540, 2)
      );
      if (d < minDist) { minDist = d; idx = i; }
    });
    if (idx !== currentStepIdx) {
      setCurrentStepIdx(idx);
      speakText(navigationRoute.steps[idx]?.instruction || '');
    }
  };

  // ── 結束導航 ─────────────────────────────────────────
  const endNavigation = () => {
    Animated.parallel([
      Animated.timing(topBannerAnim, { toValue: -200, duration: 250, useNativeDriver: true }),
      Animated.timing(bottomBarAnim, { toValue:  300, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setNavigationRoute(null);
      setNavigationTarget(null);
      setIsNavigating(false);
      setCurrentStepIdx(0);
      sendToMap('clearRoute', {});
      speakText('Navigation ended.');
    });
  };

  // ── WebView 通訊 ─────────────────────────────────────
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
          speakText(`Bus stop: ${msg.data.name}`);
          break;
        case 'mrtClicked':
          speakText(`MRT: ${msg.data.name}`);
          break;
      }
    } catch (_) {}
  };

  const speakText = (text) => {
    setVoiceMessage(text);
    Speech.speak(text, { language: 'en-US', rate: 0.9 });
  };

  const currentStep = navigationRoute?.steps?.[currentStepIdx]     || null;
  const nextStep    = navigationRoute?.steps?.[currentStepIdx + 1] || null;

  // ── Mapbox HTML ──────────────────────────────────────
  const mapHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.js"></script>
  <link  href="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.css" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body,html{width:100%;height:100%;overflow:hidden;background:#000}
    #map{width:100%;height:100%}

    /* DOGE 小人 */
    .doge{font-size:32px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.7));
          animation:bob 1.6s ease-in-out infinite alternate;cursor:default}
    @keyframes bob{from{transform:translateY(0)}to{transform:translateY(-5px)}}

    /* 公車（半透明，靜態）*/
    .bus-wrap{display:flex;flex-direction:column;align-items:center;cursor:pointer}
    .bus-tag{background:rgba(20,60,180,.8);color:#fff;font-size:8px;font-weight:700;
             padding:1px 4px;border-radius:3px;margin-bottom:1px;white-space:nowrap}
    .bus-svg{opacity:.65}

    /* 公車站牌 */
    .stop-dot{width:9px;height:9px;border-radius:50%;
              background:rgba(255,140,0,.75);border:1.5px solid rgba(255,210,100,.9);cursor:pointer}

    /* 捷運站 */
    .mrt-wrap{position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer}
    .mrt-dot{width:13px;height:13px;border-radius:50%;border:2px solid white;
             box-shadow:0 1px 5px rgba(0,0,0,.5)}
    .mrt-name{position:absolute;bottom:16px;color:white;font-size:8px;font-weight:700;
              white-space:nowrap;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,.9)}

    /* 活動標記 */
    .ev-pin{font-size:26px;cursor:pointer;filter:drop-shadow(0 2px 5px rgba(0,0,0,.6))}
    .ev-pin:active{transform:scale(1.2)}
  </style>
</head>
<body>
<div id="map"></div>
<script>
mapboxgl.accessToken = '${MAPBOX_TOKEN}';

const map = new mapboxgl.Map({
  container:'map',
  style:'mapbox://styles/mapbox/standard',
  center:[121.5065,25.0424], zoom:14, pitch:45, bearing:0,
  minZoom:11, maxZoom:19,
});

let dogeMk = null;
const busMks={}, stopMks={}, mrtMks={}, evMks={};

map.on('load',()=>{
  // 地形
  map.addSource('dem',{type:'raster-dem',url:'mapbox://mapbox.mapbox-terrain-dem-v1',tileSize:512});
  map.setTerrain({source:'dem',exaggeration:1.2});

  // 3D 建築
  map.addLayer({
    id:'bldg',source:'composite','source-layer':'building',
    filter:['==','extrude','true'],type:'fill-extrusion',minzoom:14,
    paint:{
      'fill-extrusion-color':'#b0b8c8',
      'fill-extrusion-height':['get','height'],
      'fill-extrusion-base':['get','min_height'],
      'fill-extrusion-opacity':0.65,
    },
  });

  // 導航路線（外框 + 主線）
  map.addSource('route',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:[]}}});
  map.addLayer({id:'route-bg',  type:'line',source:'route',
    paint:{'line-color':'white','line-width':12,'line-opacity':.3},
    layout:{'line-join':'round','line-cap':'round'}});
  map.addLayer({id:'route-main',type:'line',source:'route',
    paint:{'line-color':'#1A73E8','line-width':6,'line-opacity':.95},
    layout:{'line-join':'round','line-cap':'round'}});

  // DOGE
  const el=document.createElement('div');
  el.className='doge'; el.innerHTML='🐕';
  dogeMk=new mapboxgl.Marker({element:el,anchor:'bottom'})
    .setLngLat([121.5065,25.0424]).addTo(map);

  sendRN('mapReady',{});
});

window.handleMsg=function({action,data}){
  switch(action){

    case 'updateDoge':
      dogeMk?.setLngLat([data.lng,data.lat]);
      break;

    case 'flyTo':
      // Mapbox center 格式：[lng, lat]
      map.flyTo({center:[data.lng,data.lat],zoom:data.zoom||17,pitch:50,duration:1500});
      break;

    // 公車靜態放置（進入頁面/刷新時）
    case 'setBuses':
      // 清除舊的
      Object.values(busMks).forEach(m=>m.remove());
      Object.keys(busMks).forEach(k=>delete busMks[k]);
      // 放新的
      data.buses.forEach(b=>{
        const w=document.createElement('div'); w.className='bus-wrap';
        const tag=document.createElement('div'); tag.className='bus-tag';
        tag.textContent=b.routeName;
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
        svg.setAttribute('width','26');svg.setAttribute('height','26');
        svg.setAttribute('viewBox','0 0 32 32');svg.className='bus-svg';
        svg.innerHTML=\`
          <rect x="3" y="8" width="26" height="15" rx="3"
            fill="rgba(20,80,200,.45)" stroke="#5599EE" stroke-width="1.5"/>
          <line x1="3" y1="15" x2="29" y2="15" stroke="#7AB8F5" stroke-width=".8"/>
          <rect x="6" y="10" width="4" height="3" rx=".8"
            fill="rgba(180,220,255,.3)" stroke="#7AB8F5" stroke-width=".7"/>
          <rect x="12" y="10" width="4" height="3" rx=".8"
            fill="rgba(180,220,255,.3)" stroke="#7AB8F5" stroke-width=".7"/>
          <rect x="18" y="10" width="4" height="3" rx=".8"
            fill="rgba(180,220,255,.3)" stroke="#7AB8F5" stroke-width=".7"/>
          <circle cx="9"  cy="24" r="2.5" fill="none" stroke="#5599EE" stroke-width="1.5"/>
          <circle cx="23" cy="24" r="2.5" fill="none" stroke="#5599EE" stroke-width="1.5"/>
        \`;
        if(b.heading) svg.style.transform=\`rotate(\${b.heading-90}deg)\`;
        w.appendChild(tag); w.appendChild(svg);
        w.addEventListener('click',()=>{
          new mapboxgl.Popup({offset:15,closeButton:false})
            .setLngLat([b.lng,b.lat])
            .setHTML(\`<div style="font:12px sans-serif;padding:4px 6px">
              <b style="color:#1E50B4">🚌 \${b.routeName}</b><br>
              <span style="color:#555">\${b.speed} km/h</span>
            </div>\`).addTo(map);
        });
        busMks[b.id]=new mapboxgl.Marker({element:w,anchor:'bottom'})
          .setLngLat([b.lng,b.lat]).addTo(map);
      });
      break;

    case 'addBusStops':
      data.stops.forEach(s=>{
        if(stopMks[s.id]) return;
        const el=document.createElement('div'); el.className='stop-dot';
        el.addEventListener('click',()=>{
          sendRN('busStopClicked',{name:s.name});
          new mapboxgl.Popup({offset:10,closeButton:false})
            .setLngLat([s.lng,s.lat])
            .setHTML(\`<div style="font:11px sans-serif;padding:3px 6px">
              🚏 <b>\${s.name}</b>
              \${s.nameEn?'<br><span style=color:#666>'+s.nameEn+'</span>':''}
              \${s.routeName?'<br><span style=color:#888>'+s.routeName+'</span>':''}
            </div>\`).addTo(map);
        });
        stopMks[s.id]=new mapboxgl.Marker({element:el,anchor:'center'})
          .setLngLat([s.lng,s.lat]).addTo(map);
      });
      break;

    case 'addMrtStations':
      data.stations.forEach(st=>{
        if(mrtMks[st.id]) return;
        const w=document.createElement('div'); w.className='mrt-wrap';
        const nm=document.createElement('div'); nm.className='mrt-name'; nm.textContent=st.nameZh;
        const dot=document.createElement('div'); dot.className='mrt-dot'; dot.style.background=st.color;
        dot.addEventListener('click',()=>{
          sendRN('mrtClicked',{name:st.name});
          new mapboxgl.Popup({offset:12,closeButton:false})
            .setLngLat([st.lng,st.lat])
            .setHTML(\`<div style="font:12px sans-serif;padding:5px 8px">
              🚇 <b>\${st.nameZh}</b> \${st.name}<br>
              <span style="color:\${st.color};font-weight:600">\${
                st.line==='BL'?'板南線':st.line==='R'?'淡水信義線':
                st.line==='G'?'松山新店線':'中和新蘆線'}</span>
            </div>\`).addTo(map);
        });
        w.appendChild(nm); w.appendChild(dot);
        mrtMks[st.id]=new mapboxgl.Marker({element:w,anchor:'center'})
          .setLngLat([st.lng,st.lat]).addTo(map);
      });
      break;

    case 'addEventMarkers':
      data.events.forEach(ev=>{
        if(evMks[ev.id]) return;
        const el=document.createElement('div'); el.className='ev-pin';
        el.innerHTML=ev.tags?.includes('food')?'🍜':ev.tags?.includes('music')?'🎵':
                     ev.tags?.includes('art')?'🎨':ev.tags?.includes('history')?'🏛️':'📍';
        el.addEventListener('click',()=>sendRN('eventClicked',{id:ev.id}));
        evMks[ev.id]=new mapboxgl.Marker({element:el,anchor:'bottom'})
          .setLngLat([ev.lng,ev.lat]).addTo(map);
      });
      break;

    case 'drawRoute':
      map.getSource('route').setData(data.geometry);
      break;

    case 'clearRoute':
      map.getSource('route').setData({type:'Feature',geometry:{type:'LineString',coordinates:[]}});
      break;
  }
};

function sendRN(type,data){
  window.ReactNativeWebView?.postMessage(JSON.stringify({type,data}));
}
</script>
</body>
</html>`;

  return (
    <View style={s.container}>

      {/* 地圖 */}
      <WebView
        ref={webViewRef}
        source={{ html: mapHTML }}
        style={s.webView}
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

      {/* 語音提示（非導航時）*/}
      {!isNavigating && <VoiceGuide message={voiceMessage} />}

      {/* 右側按鈕群組 */}
      {!isNavigating && (
        <View style={s.rightBtns}>
          {busLoading && (
            <View style={s.loadingDot}>
              <ActivityIndicator size="small" color="#4A90E2" />
            </View>
          )}
          {/* 定位按鈕 */}
          <TouchableOpacity
            style={[s.btn, s.btnWhite, isLocating && s.btnLocating]}
            onPress={handleLocate}
          >
            <Text style={s.btnIcon}>🧍</Text>
          </TouchableOpacity>
          {/* 活動列表 */}
          <TouchableOpacity
            style={[s.btn, s.btnDark]}
            onPress={() => setShowCards(true)}
          >
            <Text style={s.btnIcon}>🎯</Text>
          </TouchableOpacity>
          {/* 返回首頁 */}
          <TouchableOpacity
            style={[s.btn, s.btnDark]}
            onPress={() => navigation.goBack()}
          >
            <Text style={s.btnIcon}>🏠</Text>
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

      {/* 地理圍欄彈窗 */}
      {geofenceEvent && !isNavigating && (
        <GeofenceAlert
          event={geofenceEvent}
          onNavigate={ev => { setGeofenceEvent(null); startNavigation(ev); }}
          onDismiss={() => setGeofenceEvent(null)}
        />
      )}

      {/* Tinder 滑卡 */}
      {showCards && (
        <SwipeCards
          events={events}
          onSwipe={(ev, dir) => {
            if (dir === 'right') { setShowCards(false); startNavigation(ev); }
          }}
          onClose={() => setShowCards(false)}
        />
      )}

      {/* 活動詳情 Modal */}
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

// ── Styles ────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#000' },
  webView:    { flex: 1, width, height },
  rightBtns:  { position: 'absolute', right: 16, bottom: 120, alignItems: 'center', gap: 12 },
  btn:        { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                shadowOpacity: .3, shadowRadius: 5, elevation: 8 },
  btnWhite:   { backgroundColor: 'white' },
  btnLocating:{ backgroundColor: '#EBF4FF', borderWidth: 2, borderColor: '#4A90E2' },
  btnDark:    { backgroundColor: 'rgba(28,28,30,.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)' },
  btnIcon:    { fontSize: 22 },
  loadingDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(28,28,30,.88)',
                alignItems: 'center', justifyContent: 'center' },
});

// ── Apple Maps Navigation Styles ──────────────────────────
const nav = StyleSheet.create({
  // 頂部 Banner
  topBanner: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: '#1C1C1E',
    paddingBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: .45, shadowRadius: 8, elevation: 15,
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 12,
    gap: 10,
  },
  arrowBox:   { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoBox:    { flex: 1 },
  distNum:    { color: 'white', fontSize: 38, fontWeight: '700', lineHeight: 44 },
  distUnit:   { color: '#8E8E93', fontSize: 16, fontWeight: '400' },
  streetName: { color: 'white', fontSize: 18, fontWeight: '400', marginTop: 2 },
  nextBox:    { alignItems: 'center', gap: 2 },
  nextLabel:  { color: '#636366', fontSize: 10 },
  fullInstr:  { color: '#8E8E93', fontSize: 12, paddingHorizontal: 16, paddingTop: 4 },

  // 底部 ETA 條
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: .4, shadowRadius: 10, elevation: 15,
  },
  progressTrack: { height: 3, backgroundColor: '#2C2C2E',
                   borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: '#1A73E8' },
  bottomRow:     { flexDirection: 'row', alignItems: 'center',
                   paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  etaBlock:      { flex: 1, alignItems: 'center' },
  etaBig:        { color: 'white', fontSize: 20, fontWeight: '700' },
  etaSub:        { color: '#8E8E93', fontSize: 11, marginTop: 2 },
  etaDivider:    { width: 1, height: 32, backgroundColor: '#48484A' },
  endBtn:        { backgroundColor: '#FF3B30', paddingHorizontal: 20, paddingVertical: 12,
                   borderRadius: 12, marginLeft: 8 },
  endBtnText:    { color: 'white', fontSize: 16, fontWeight: '700' },
  destName:      { color: '#8E8E93', fontSize: 13, paddingHorizontal: 16,
                   paddingTop: 8, paddingBottom: 4 },
});