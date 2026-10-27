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
import { Ionicons } from '@expo/vector-icons';

import SwipeCards from '../components/SwipeCards';
import HistoricalEventCard from '../components/HistoricalEventCard';
import VoiceGuide from '../components/VoiceGuide';
import GeofenceAlert from '../components/GeofenceAlert';

import EventService from '../services/EventService';
import LocationService from '../services/LocationService';
import TransportService from '../services/TransportService';
import NavigationService from '../services/NavigationService';
import { useAppStore } from '../store/appStore';

const { width, height } = Dimensions.get('window');

const MAPBOX_TOKEN   = '貼上金鑰';
const GEOFENCE_RADIUS_KM = 0.1;

const MRT_STATIONS = [
  { id:'BL11', name:'Ximen', nameZh:'西門', lat:25.0423, lng:121.5076, line:'BL', color:'#0070BD' },
  { id:'BL12', name:'Longshan Temple', nameZh:'龍山寺', lat:25.0366, lng:121.4997, line:'BL', color:'#0070BD' },
  { id:'BL10', name:'Taipei Main Station', nameZh:'台北車站', lat:25.0478, lng:121.5170, line:'BL', color:'#0070BD' },
];

function TopNavBanner({ step, nextStep, slideAnim }) {
  if (!step) return null;
  const dist = step.distance < 1000 ? `${Math.round(step.distance)}` : `${(step.distance / 1000).toFixed(1)}`;
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
    if (type === 'arrive') return <Text style={{ fontSize: size * 0.65 }}>🏁</Text>;
    const arrows = { 'left': '↰', 'sharp left': '↰', 'right': '↱', 'sharp right': '↱', 'slight left': '↖', 'slight right': '↗', 'uturn': '↩' };
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size, color: 'white', fontWeight: '200', lineHeight: size }}>{arrows[modifier] || '↑'}</Text>
      </View>
    );
  };

  return (
    <Animated.View style={[nav.topBanner, { transform: [{ translateY: slideAnim }] }]}>
      <SafeAreaView>
        <View style={nav.topRow}>
          <View style={nav.arrowBox}><ArrowSVG modifier={step.modifier} type={step.type} size={50} /></View>
          <View style={nav.infoBox}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={nav.distNum}>{dist}</Text><Text style={nav.distUnit}>{unit}</Text>
            </View>
            <Text style={nav.streetName} numberOfLines={1}>{getStreetName(step.instruction)}</Text>
          </View>
        </View>
        <Text style={nav.fullInstr} numberOfLines={1}>{step.instruction}</Text>
      </SafeAreaView>
    </Animated.View>
  );
}

function BottomETABar({ route, currentStepIdx, targetEvent, onEndRoute, slideAnim }) {
  if (!route) return null;
  const progress = Math.min((currentStepIdx / Math.max(route.steps?.length - 1, 1)), 1);
  const mins = Math.round(route.duration / 60);
  const km = (route.distance / 1000).toFixed(1);
  const now = new Date();
  const arrival = new Date(now.getTime() + route.duration * 1000);
  const eta = arrival.toLocaleTimeString('zh-TW', { hour: 'numeric', minute: '2-digit', hour12: false });

  return (
    <Animated.View style={[nav.bottomBar, { transform: [{ translateY: slideAnim }] }]}>
      <View style={nav.progressTrack}><View style={[nav.progressFill, { width: `${progress * 100}%` }]} /></View>
      <View style={nav.bottomRow}>
        <View style={nav.etaBlock}><Text style={nav.etaBig}>{eta}</Text><Text style={nav.etaSub}>抵達</Text></View>
        <View style={nav.etaDivider} />
        <View style={nav.etaBlock}><Text style={nav.etaBig}>{mins}</Text><Text style={nav.etaSub}>分鐘</Text></View>
        <View style={nav.etaDivider} />
        <View style={nav.etaBlock}><Text style={nav.etaBig}>{km}</Text><Text style={nav.etaSub}>公里</Text></View>
        <TouchableOpacity style={nav.endBtn} onPress={onEndRoute}><Text style={nav.endBtnText}>結束</Text></TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// 📍 展示模式：鎖定座標在西門町中心
const DEMO_LOCATION = { latitude: 25.0424, longitude: 121.5065 };

export default function MapScreen({ navigation }) {

  const webViewRef = useRef(null);
  const speakTimeout = useRef(null);
  
  const [realLocation, setRealLocation] = useState(DEMO_LOCATION);
  const [isLocating, setIsLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [showWeatherPanel, setShowWeatherPanel] = useState(false);

  const [navigationRoute, setNavigationRoute] = useState(null);
  const [navigationTarget, setNavigationTarget] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const topBannerAnim = useRef(new Animated.Value(-200)).current;
  const bottomBarAnim = useRef(new Animated.Value(300)).current;

  const [showCards, setShowCards] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [geofenceEvent, setGeofenceEvent] = useState(null);
  const [triggeredIds, setTriggeredIds] = useState(new Set());
  const [busLoading, setBusLoading] = useState(false);

  const { events, setEvents, itinerary, addToItinerary, removeFromItinerary } = useAppStore();
  const [showItineraryPanel, setShowItineraryPanel] = useState(false);

  useEffect(() => {
    loadEvents();
    startGPS();
    
    fetch('https://api.open-meteo.com/v1/forecast?latitude=25.0424&longitude=121.5065&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FTaipei')
      .then(res => res.json())
      .then(data => {
        setWeather(data.current_weather);
        setForecast(data.daily);
      })
      .catch(e => console.log('天氣載入失敗', e));
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const t = setTimeout(() => {
      sendToMap('addMrtStations', { stations: MRT_STATIONS });
      sendToMap('addEventMarkers', { events });
      fetchBusesAndStops();
    }, 800);
    return () => clearTimeout(t);
  }, [mapReady, events]);

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

  // 📍 展示模式：直接設定假定位，放棄真實 GPS
  const startGPS = async () => {
    try {
      setRealLocation(DEMO_LOCATION);
    } catch (e) {
      console.error('設定展示定位失敗:', e);
    }
  };

  // 📍 展示模式：點擊定位按鈕直接瞬間飛回西門町
  const handleLocatePress = () => {
    setIsLocating(true);
    sendToMap('flyTo', { lat: DEMO_LOCATION.latitude, lng: DEMO_LOCATION.longitude, zoom: 17 });
    speakText('已回到展示起始點！');
    setTimeout(() => setIsLocating(false), 800);
  };

  const fetchBusesAndStops = async () => {
    try {
      setBusLoading(true);
      const buses = await TransportService.getBusLocations();
      sendToMap('setBuses', { buses });
      
      const points = [
        { lat: 25.0424, lng: 121.5065 }, { lat: 25.0478, lng: 121.5170 },
        { lat: 25.0418, lng: 121.5449 }, { lat: 25.0330, lng: 121.5654 },
      ];
      const stops = await TransportService.getMultipleNearbyBusStops(points, 1000);
      sendToMap('addBusStops', { stops });
    } catch (e) {
      console.error('公車資料載入失敗:', e);
    } finally {
      setBusLoading(false);
    }
  };

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

  const startNavigation = async (event) => {
    if (!realLocation) return speakText('定位載入中，請稍候。');
    try {
      speakText(`開始導航至 ${event.title}`);
      setIsNavigating(true);
      setCurrentStepIdx(0);
      let route = null;
      const waypoints = [ { lng: realLocation.longitude, lat: realLocation.latitude }, { lng: event.lng, lat: event.lat } ];

      for (const profile of ['walking', 'driving']) {
        try {
          route = await NavigationService.getWaypointRoute(waypoints, profile);
          if (route) break;
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

      Animated.parallel([
        Animated.spring(topBannerAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
        Animated.spring(bottomBarAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();
    } catch (e) {
      speakText('導航連線失敗。');
      setIsNavigating(false);
    }
  };

  const updateStep = (loc) => {
    if (!navigationRoute?.steps) return;
    let minDist = Infinity, idx = 0;
    navigationRoute.steps.forEach((s, i) => {
      const [sLng, sLat] = s.location || [0, 0];
      const d = NavigationService.calculateDistance(loc.latitude, loc.longitude, sLat, sLng);
      if (d < minDist) { minDist = d; idx = i; }
    });
    if (idx !== currentStepIdx) {
      setCurrentStepIdx(idx);
      speakText(navigationRoute.steps[idx]?.instruction || '');
    }
  };

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

  const sendToMap = (action, data) => {
    webViewRef.current?.injectJavaScript(`if(window.handleMsg) window.handleMsg(${JSON.stringify({ action, data })}); true;`);
  };

  const onWebMsg = (e) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'mapReady') setMapReady(true);
      if (msg.type === 'eventClicked') {
        const ev = events.find(x => x.id === msg.data.id);
        if (ev) { setCurrentEvent(ev); setShowEventDetail(true); }
      }
      if (msg.type === 'busStopClicked' || msg.type === 'mrtClicked') speakText(`站點: ${msg.data.name}`);
    } catch (_) {}
  };

  const speakText = (text) => {
    setVoiceMessage(text);
    Speech.speak(text, { language: 'zh-TW', rate: 0.95 });
    if (speakTimeout.current) clearTimeout(speakTimeout.current);
    speakTimeout.current = setTimeout(() => {
      setVoiceMessage('');
    }, 3000);
  };

  const currentStep = navigationRoute?.steps?.[currentStepIdx] || null;
  const nextStep = navigationRoute?.steps?.[currentStepIdx + 1] || null;

  const mapHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><script src="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.js"></script><link href="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.css" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body,html{width:100%;height:100%;overflow:hidden;background:#000}#map{width:100%;height:100%}.doge{font-size:32px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.7));animation:bob 1.6s ease-in-out infinite alternate;cursor:default}@keyframes bob{from{transform:translateY(0)}to{transform:translateY(-5px)}}.bus-wrap{display:flex;flex-direction:column;align-items:center;cursor:pointer}.bus-tag{background:rgba(20,60,180,.8);color:#fff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px;margin-bottom:1px;white-space:nowrap}.bus-svg{opacity:.65}.stop-dot{width:9px;height:9px;border-radius:50%;background:rgba(255,140,0,.75);border:1.5px solid rgba(255,210,100,.9);cursor:pointer}.mrt-wrap{position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer}.mrt-dot{width:13px;height:13px;border-radius:50%;border:2px solid white;box-shadow:0 1px 5px rgba(0,0,0,.5)}.mrt-name{position:absolute;bottom:16px;color:white;font-size:8px;font-weight:700;white-space:nowrap;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,.9)}.ev-pin{cursor:pointer;filter:drop-shadow(0 2px 5px rgba(0,0,0,.6));}.ev-pin:active{transform:scale(1.2)}</style></head><body><div id="map"></div><script>mapboxgl.accessToken='${MAPBOX_TOKEN}';const map=new mapboxgl.Map({container:'map',style:'mapbox://styles/mapbox/standard',center:[121.5065,25.0424],zoom:14,pitch:45,bearing:0,minZoom:11,maxZoom:19});let dogeMk=null;const busMks={},stopMks={},mrtMks={},evMks={};map.on('load',()=>{map.addSource('dem',{type:'raster-dem',url:'mapbox://mapbox.mapbox-terrain-dem-v1',tileSize:512});map.setTerrain({source:'dem',exaggeration:1.2});map.addLayer({id:'bldg',source:'composite','source-layer':'building',filter:['==','extrude','true'],type:'fill-extrusion',minzoom:14,paint:{'fill-extrusion-color':'#b0b8c8','fill-extrusion-height':['get','height'],'fill-extrusion-base':['get','min_height'],'fill-extrusion-opacity':0.65}});map.addSource('route',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:[]}}});map.addLayer({id:'route-bg',type:'line',source:'route',paint:{'line-color':'white','line-width':12,'line-opacity':.3},layout:{'line-join':'round','line-cap':'round'}});map.addLayer({id:'route-main',type:'line',source:'route',paint:{'line-color':'#1A73E8','line-width':6,'line-opacity':.95},layout:{'line-join':'round','line-cap':'round'}});const el=document.createElement('div');el.className='doge';el.innerHTML='🐕';dogeMk=new mapboxgl.Marker({element:el,anchor:'bottom'}).setLngLat([121.5065,25.0424]).addTo(map);sendRN('mapReady',{})});window.handleMsg=function({action,data}){switch(action){case'updateDoge':dogeMk?.setLngLat([data.lng,data.lat]);break;case'flyTo':map.flyTo({center:[data.lng,data.lat],zoom:data.zoom||17,pitch:50,duration:1500});break;case'setBuses':Object.values(busMks).forEach(m=>m.remove());Object.keys(busMks).forEach(k=>delete busMks[k]);data.buses.forEach(b=>{const w=document.createElement('div');w.className='bus-wrap';const tag=document.createElement('div');tag.className='bus-tag';tag.textContent=b.routeName;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','26');svg.setAttribute('height','26');svg.setAttribute('viewBox','0 0 32 32');svg.className='bus-svg';svg.innerHTML='<rect x="3" y="8" width="26" height="15" rx="3" fill="rgba(20,80,200,.45)" stroke="#5599EE" stroke-width="1.5"/><line x1="3" y1="15" x2="29" y2="15" stroke="#7AB8F5" stroke-width=".8"/><circle cx="9" cy="24" r="2.5" fill="none" stroke="#5599EE" stroke-width="1.5"/><circle cx="23" cy="24" r="2.5" fill="none" stroke="#5599EE" stroke-width="1.5"/>';if(b.heading)svg.style.transform='rotate('+(b.heading-90)+'deg)';w.appendChild(tag);w.appendChild(svg);busMks[b.id]=new mapboxgl.Marker({element:w,anchor:'bottom'}).setLngLat([b.lng,b.lat]).addTo(map)});break;case'addBusStops':data.stops.forEach(s=>{if(stopMks[s.id])return;const el=document.createElement('div');el.className='stop-dot';el.addEventListener('click',()=>{sendRN('busStopClicked',{name:s.name})});stopMks[s.id]=new mapboxgl.Marker({element:el,anchor:'center'}).setLngLat([s.lng,s.lat]).addTo(map)});break;case'addMrtStations':data.stations.forEach(st=>{if(mrtMks[st.id])return;const w=document.createElement('div');w.className='mrt-wrap';const nm=document.createElement('div');nm.className='mrt-name';nm.textContent=st.nameZh;const dot=document.createElement('div');dot.className='mrt-dot';dot.style.background=st.color;dot.addEventListener('click',()=>{sendRN('mrtClicked',{name:st.nameZh})});w.appendChild(nm);w.appendChild(dot);mrtMks[st.id]=new mapboxgl.Marker({element:w,anchor:'center'}).setLngLat([st.lng,st.lat]).addTo(map)});break;case'addEventMarkers':data.events.forEach(ev=>{if(evMks[ev.id]||!ev.lng||!ev.lat)return;const el=document.createElement('div');el.className='ev-pin';el.style.fontSize='32px';el.style.textShadow='0 2px 4px rgba(0,0,0,0.8)';el.innerHTML=ev.tags?.includes('food')?'🍜':ev.tags?.includes('music')?'🎵':ev.tags?.includes('art')?'🎨':'📍';el.addEventListener('click',()=>sendRN('eventClicked',{id:ev.id}));evMks[ev.id]=new mapboxgl.Marker({element:el,anchor:'bottom'}).setLngLat([ev.lng,ev.lat]).addTo(map)});break;case'drawRoute':let routeData=data.geometry;if(typeof routeData==='string'){console.warn('請確認 geojson 格式');}else{map.getSource('route').setData({type:'Feature',properties:{},geometry:routeData});}break;case'clearRoute':map.getSource('route').setData({type:'Feature',geometry:{type:'LineString',coordinates:[]}});break;}};function sendRN(type,data){window.ReactNativeWebView?.postMessage(JSON.stringify({type,data}))}</script></body></html>`;

  return (
    <View style={styles.container}>
      <WebView ref={webViewRef} source={{ html: mapHTML }} style={styles.webView} onMessage={onWebMsg} javaScriptEnabled originWhitelist={['*']} mixedContentMode="always" />
      
      {isNavigating && <TopNavBanner step={currentStep} nextStep={nextStep} slideAnim={topBannerAnim} />}
      {!isNavigating && <VoiceGuide message={voiceMessage} />}
      
      {weather && !isNavigating && (
        <TouchableOpacity 
          style={styles.weatherWidget} 
          onPress={() => setShowWeatherPanel(true)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18, marginRight: 6 }}>{weather.temperature >= 25 ? '☀️' : '☁️'}</Text>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{weather.temperature}°C</Text>
        </TouchableOpacity>
      )}

      {!isNavigating && (
        <View style={styles.rightButtons}>
          {busLoading && (
            <View style={styles.loadingBadge}><ActivityIndicator size="small" color="#4A90E2" /><Text style={styles.loadingText}>更新中...</Text></View>
          )}
          
          <TouchableOpacity style={[styles.glassBtn, isLocating && styles.glassBtnActive]} onPress={handleLocatePress} activeOpacity={0.7}>
            <Ionicons name={isLocating ? "navigate" : "navigate-outline"} size={24} color={isLocating ? "#4A90E2" : "white"} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.glassBtn} onPress={() => setShowItineraryPanel(true)} activeOpacity={0.7}>
            <Ionicons name="map-outline" size={24} color="white" />
            {itinerary?.length > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{itinerary.length}</Text></View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.glassBtn} onPress={() => setShowCards(true)} activeOpacity={0.7}>
            <Ionicons name="albums-outline" size={24} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.glassBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="home-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      )}

      {isNavigating && <BottomETABar route={navigationRoute} currentStepIdx={currentStepIdx} targetEvent={navigationTarget} onEndRoute={endNavigation} slideAnim={bottomBarAnim} />}
      {geofenceEvent && !isNavigating && <GeofenceAlert event={geofenceEvent} onNavigate={ev => { setGeofenceEvent(null); startNavigation(ev); }} onDismiss={() => setGeofenceEvent(null)} />}
      
      {showCards && (
        <SwipeCards 
          events={events} 
          onSwipe={(ev, dir) => { 
            if (dir === 'right') { 
              addToItinerary(ev);
              speakText(`已將 ${ev.title} 加入行程！`);
            } 
          }} 
          onClose={() => setShowCards(false)} 
        />
      )}
      
      <Modal visible={showEventDetail} transparent animationType="slide">
        <HistoricalEventCard event={currentEvent} onClose={() => setShowEventDetail(false)} onNavigate={(lat, lng) => { setShowEventDetail(false); startNavigation({ ...currentEvent, lat, lng }); }} />
      </Modal>

      <Modal visible={showWeatherPanel} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.weatherPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🌤 台北近期天氣預報</Text>
              <TouchableOpacity onPress={() => setShowWeatherPanel(false)} style={{ padding: 5 }}>
                <Ionicons name="close-circle" size={28} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            {forecast?.time ? forecast.time.slice(0, 5).map((date, idx) => (
              <View key={date} style={styles.weatherRow}>
                <Text style={styles.weatherDate}>{date.slice(5)}</Text>
                <View style={styles.weatherBar}>
                  <Text style={styles.weatherTempMin}>{Math.round(forecast.temperature_2m_min[idx])}°</Text>
                  <View style={styles.weatherLine} />
                  <Text style={styles.weatherTempMax}>{Math.round(forecast.temperature_2m_max[idx])}°C</Text>
                </View>
              </View>
            )) : (
              <ActivityIndicator size="large" color="#4A90E2" style={{ marginVertical: 20 }} />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showItineraryPanel} transparent animationType="slide">
        <View style={styles.modalOverlayBottom}>
          <View style={styles.itineraryPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎒 我的行程包包</Text>
              <TouchableOpacity onPress={() => setShowItineraryPanel(false)} style={{ padding: 5 }}>
                <Ionicons name="close-circle" size={28} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            {(!itinerary || itinerary.length === 0) ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#8E8E93', fontSize: 16 }}>目前還沒有加入任何景點喔！</Text>
              </View>
            ) : (
              itinerary.map((item, index) => (
                <View key={item.id || index} style={styles.itineraryItem}>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', flex: 1 }}>{index + 1}. {item.title}</Text>
                  <TouchableOpacity onPress={() => removeFromItinerary(item.id)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))
            )}
            
            {itinerary?.length > 0 && (
              <TouchableOpacity style={styles.navButton}>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>開始最佳路線導航</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' }, webView: { flex: 1, width, height },
  rightButtons: { position: 'absolute', right: 20, bottom: 120, alignItems: 'center', gap: 16 },
  glassBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(28, 28, 30, 0.85)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)' },
  glassBtnActive: { backgroundColor: 'rgba(0, 0, 0, 0.9)', borderColor: '#4A90E2', borderWidth: 1.5 },
  loadingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(28, 28, 30, 0.9)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  loadingText: { color: '#4A90E2', fontSize: 12, fontWeight: '600' },
  badge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FF3B30', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  
  weatherWidget: { position: 'absolute', top: 60, left: 20, backgroundColor: 'rgba(28,28,30,0.85)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  weatherPanel: { width: '85%', backgroundColor: '#1C1C1E', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  weatherRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  weatherDate: { color: 'white', fontSize: 16, fontWeight: '500' },
  weatherBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weatherTempMin: { color: '#4A90E2', fontSize: 16, fontWeight: '600', width: 35, textAlign: 'right' },
  weatherLine: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  weatherTempMax: { color: '#FF9F0A', fontSize: 16, fontWeight: '600', width: 35 },
  
  itineraryPanel: { backgroundColor: '#1C1C1E', height: '65%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  itineraryItem: { backgroundColor: '#2C2C2E', padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  navButton: { backgroundColor: '#4A90E2', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 'auto' },
});

const nav = StyleSheet.create({
  topBanner: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#1C1C1E', paddingBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: .45, shadowRadius: 8, elevation: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 0 : 12, gap: 12 },
  arrowBox: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoBox: { flex: 1 }, distNum: { color: 'white', fontSize: 36, fontWeight: '700', lineHeight: 42 }, distUnit: { color: '#8E8E93', fontSize: 16, fontWeight: '400' }, streetName: { color: 'white', fontSize: 18, fontWeight: '400', marginTop: 2 },
  fullInstr: { color: '#8E8E93', fontSize: 12, paddingHorizontal: 16, paddingTop: 6 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 22, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: .4, shadowRadius: 10, elevation: 15 },
  progressTrack: { height: 4, backgroundColor: '#2C2C2E', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: '#1A73E8' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  etaBlock: { flex: 1, alignItems: 'center' }, etaBig: { color: 'white', fontSize: 22, fontWeight: '700' }, etaSub: { color: '#8E8E93', fontSize: 11, marginTop: 2 }, etaDivider: { width: 1, height: 30, backgroundColor: '#48484A' },
  endBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, marginLeft: 6 }, endBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
