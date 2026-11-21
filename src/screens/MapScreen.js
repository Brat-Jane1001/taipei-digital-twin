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
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import SwipeCards from '../components/SwipeCards';
import HistoricalEventCard from '../components/HistoricalEventCard';
import VoiceGuide from '../components/VoiceGuide';
import GeofenceAlert from '../components/GeofenceAlert';

import EventService from '../services/EventService';
import LocationService from '../services/LocationService';
import TransportService from '../services/TransportService';
import NavigationService from '../services/NavigationService';
import MeetupService from '../services/MeetupService';
import { useAppStore } from '../store/appStore';

const { width, height } = Dimensions.get('window');

const MAPBOX_TOKEN = '填入金鑰';
const GEOFENCE_RADIUS_KM = 0.1;
const DEMO_LOCATION = { latitude: 25.0424, longitude: 121.5065 };

const getWeatherIcon = (code) => {
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '🌤';
  if (code === 3) return '☁️';
  if (code >= 45 && code <= 48) return '🌫';
  if (code >= 51 && code <= 67) return '🌧';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦';
  if (code >= 95 && code <= 99) return '⛈';
  return '☁️';
};

const MRT_STATIONS = [
  { id: 'BL11', name: 'Ximen', nameZh: '西門', lat: 25.0423, lng: 121.5076, line: 'BL', color: '#0070BD' },
  { id: 'BL12', name: 'Longshan Temple', nameZh: '龍山寺', lat: 25.0366, lng: 121.4997, line: 'BL', color: '#0070BD' },
  { id: 'BL10', name: 'Taipei Main Station', nameZh: '台北車站', lat: 25.0478, lng: 121.5170, line: 'BL', color: '#0070BD' },
];

function TopNavBanner({ step, slideAnim }) {
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

  const ArrowSVG = ({ modifier, type, size = 56 }) => {
    if (type === 'arrive') return <Text style={{ fontSize: size * 0.65 }}>🏁</Text>;
    const arrows = { 'left': '↰', 'sharp left': '↰', 'right': '↱', 'sharp right': '↱', 'slight left': '↖', 'slight right': '↗', 'uturn': '↩' };
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size, color: 'white', fontWeight: '300', lineHeight: size }}>{arrows[modifier] || '↑'}</Text>
      </View>
    );
  };

  return (
    <Animated.View style={[nav.topBannerWrapper, { transform: [{ translateY: slideAnim }] }]}>
      <BlurView intensity={85} tint="dark" style={nav.blurContainer}>
        <SafeAreaView>
          <View style={nav.topRow}>
            <View style={nav.arrowBox}><ArrowSVG modifier={step.modifier} type={step.type} /></View>
            <View style={nav.infoBox}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={nav.distNum}>{dist}</Text>
                <Text style={nav.distUnit}>{unit}</Text>
              </View>
              <Text style={nav.streetName} numberOfLines={1}>{getStreetName(step.instruction)}</Text>
            </View>
          </View>
          <Text style={nav.fullInstr} numberOfLines={1}>{step.instruction}</Text>
        </SafeAreaView>
      </BlurView>
    </Animated.View>
  );
}

function BottomETABar({ route, currentStepIdx, onEndRoute, onSimulate, slideAnim, hasNextStop, onNextStop }) {
  if (!route) return null;
  const progress = Math.min((currentStepIdx / Math.max(route.steps?.length - 1, 1)), 1);
  const mins = Math.round(route.duration / 60);
  const km = (route.distance / 1000).toFixed(1);
  const now = new Date();
  const arrival = new Date(now.getTime() + route.duration * 1000);
  const eta = arrival.toLocaleTimeString('zh-TW', { hour: 'numeric', minute: '2-digit', hour12: false });

  const isArrived = route.steps && currentStepIdx >= route.steps.length - 1;

  return (
    <Animated.View style={[nav.bottomBarWrapper, { transform: [{ translateY: slideAnim }] }]}>
      <BlurView intensity={90} tint="dark" style={nav.bottomBlurContainer}>
        <View style={nav.progressTrack}>
          <View style={[nav.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={nav.bottomRow}>
          <View style={nav.etaBlock}><Text style={nav.etaBig}>{eta}</Text><Text style={nav.etaSub}>抵達</Text></View>
          <View style={nav.etaDivider} />
          <View style={nav.etaBlock}><Text style={nav.etaBig}>{mins}</Text><Text style={nav.etaSub}>分鐘</Text></View>
          <View style={nav.etaDivider} />
          <View style={nav.etaBlock}><Text style={nav.etaBig}>{km}</Text><Text style={nav.etaSub}>公里</Text></View>

          <TouchableOpacity style={nav.simBtn} onPress={onSimulate} activeOpacity={0.7}>
            <Ionicons name="footsteps" size={20} color="#0A84FF" />
          </TouchableOpacity>

          {isArrived && hasNextStop ? (
            <TouchableOpacity style={[nav.endBtn, { backgroundColor: '#0A84FF', borderColor: '#0A84FF' }]} onPress={onNextStop}>
              <Text style={[nav.endBtnText, { color: 'white' }]}>下一站</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={nav.endBtn} onPress={onEndRoute}>
              <Text style={nav.endBtnText}>結束</Text>
            </TouchableOpacity>
          )}
        </View>
      </BlurView>
    </Animated.View>
  );
}

export default function MapScreen({ navigation, route }) {
  const webViewRef = useRef(null);
  const speakTimeout = useRef(null);

  const [realLocation, setRealLocation] = useState(DEMO_LOCATION);
  const [isLocating, setIsLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [hourlyForecast, setHourlyForecast] = useState(null);
  const [showWeatherPanel, setShowWeatherPanel] = useState(false);

  const [navigationRoute, setNavigationRoute] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const [itineraryQueue, setItineraryQueue] = useState([]);

  const topBannerAnim = useRef(new Animated.Value(-200)).current;
  const bottomBarAnim = useRef(new Animated.Value(300)).current;

  const [showCards, setShowCards] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [geofenceEvent, setGeofenceEvent] = useState(null);
  const [triggeredIds, setTriggeredIds] = useState(new Set());

  const [busUpdating, setBusUpdating] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [selectedStop, setSelectedStop] = useState(null);
  const [stopEtas, setStopEtas] = useState([]);
  const [etaLoading, setEtaLoading] = useState(false);

  const { events, setEvents, itinerary, addToItinerary, removeFromItinerary } = useAppStore();
  const [showItineraryPanel, setShowItineraryPanel] = useState(false);

  const speakText = (text) => {
    setVoiceMessage(text);
    Speech.speak(text, { language: 'zh-TW', rate: 0.95 });
    if (speakTimeout.current) clearTimeout(speakTimeout.current);
    speakTimeout.current = setTimeout(() => { setVoiceMessage(''); }, 3500);
  };

  const sendToMap = (action, data) => {
    webViewRef.current?.injectJavaScript(`if(window.handleMsg) window.handleMsg(${JSON.stringify({ action, data })}); true;`);
  };

  useEffect(() => {
    loadEvents();
    setRealLocation(DEMO_LOCATION);
    fetchWeather();
  }, []);

  const fetchWeather = () => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=25.0424&longitude=121.5065&current_weather=true&daily=temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weathercode&timezone=Asia%2FTaipei')
      .then(res => res.json())
      .then(data => {
        setWeather(data.current_weather);
        setForecast(data.daily);
        setHourlyForecast(data.hourly);
      })
      .catch(e => console.log('天氣載入失敗', e));
  };

  useEffect(() => {
    if (!mapReady) return;
    fetchStaticMapData();
    fetchBusesGPS();
    const busInterval = setInterval(() => { fetchBusesGPS(); }, 15000);
    return () => clearInterval(busInterval);
  }, [mapReady, events]);

  // 組隊圖釘：地圖就緒時載入，回到此畫面時更新
  const loadMeetupMarkers = useCallback(async () => {
    try {
      const meetups = await MeetupService.list();
      sendToMap('addMeetupMarkers', { meetups });
    } catch (e) { console.log('Meetup markers:', e.message); }
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    loadMeetupMarkers();
    const unsub = navigation.addListener('focus', loadMeetupMarkers);
    return unsub;
  }, [mapReady, loadMeetupMarkers, navigation]);

  // 從組隊列表按「View on map」進來：飛到該組隊的位置
  useEffect(() => {
    const f = route?.params?.focus;
    if (!f || !mapReady) return;
    sendToMap('flyTo', { lat: f.lat, lng: f.lng, zoom: 17 });
  }, [route?.params?.focus, mapReady]);

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

  const fetchStaticMapData = async () => {
    sendToMap('addMrtStations', { stations: MRT_STATIONS });
    sendToMap('addEventMarkers', { events });
    try {
      const points = [
        { lat: 25.0424, lng: 121.5065 }, { lat: 25.0478, lng: 121.5170 },
        { lat: 25.0418, lng: 121.5449 }, { lat: 25.0330, lng: 121.5654 },
      ];
      const stops = await TransportService.getMultipleNearbyBusStops(points, 1200);
      sendToMap('setBusStops', { stops });
    } catch (e) { console.log('站牌載入失敗', e); }
  };

  const fetchBusesGPS = async () => {
    try {
      setBusUpdating(true);
      const buses = await TransportService.getBusLocations();
      sendToMap('updateBuses', { buses });
    } catch (e) {
      console.log('公車動態載入失敗', e);
    } finally {
      setIsFirstLoad(false);
      setTimeout(() => setBusUpdating(false), 1000);
    }
  };

  const fetchEtaForStop = async (stopId) => {
    setEtaLoading(true);
    const etas = await TransportService.getBusStopETA(stopId);
    setStopEtas(etas);
    setEtaLoading(false);
  };

  const handleLocatePress = () => {
    setIsLocating(true);
    setRealLocation(DEMO_LOCATION);
    sendToMap('updateDoge', { lat: DEMO_LOCATION.latitude, lng: DEMO_LOCATION.longitude });
    sendToMap('flyTo', { lat: DEMO_LOCATION.latitude, lng: DEMO_LOCATION.longitude, zoom: 17 });
    speakText('已回到西門町起始點');
    setTimeout(() => setIsLocating(false), 800);
  };

  const checkGeofences = useCallback((loc) => {
    if (!events?.length || geofenceEvent) return;
    events.forEach(ev => {
      if (triggeredIds.has(ev.id)) return;
      const d = LocationService.calculateDistance(loc.latitude, loc.longitude, ev.lat, ev.lng);
      if (d <= GEOFENCE_RADIUS_KM) {
        setGeofenceEvent({ ...ev, distance: d });
        setTriggeredIds(prev => new Set([...prev, ev.id]));
        speakText(`您已接近景點： ${ev.title}`);
      }
    });
  }, [events, geofenceEvent, triggeredIds]);

  const routeToTarget = async (startLoc, targetEvent) => {
    try {
      speakText(`開始導航至 ${targetEvent.title || targetEvent.name}`);
      setIsNavigating(true);
      setCurrentStepIdx(0);

      let route = await NavigationService.getWaypointRoute(
        [{ lng: startLoc.longitude, lat: startLoc.latitude }, { lng: targetEvent.lng, lat: targetEvent.lat }], 'walking'
      );

      if (!route) throw new Error('無路徑');

      setNavigationRoute(route);
      sendToMap('drawRoute', { geometry: route.geometry });
      sendToMap('flyTo', { lat: startLoc.latitude, lng: startLoc.longitude, zoom: 17 });

      if (route.steps && route.steps[0]) speakText(route.steps[0].instruction);

      Animated.parallel([
        Animated.spring(topBannerAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
        Animated.spring(bottomBarAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
      ]).start();
    } catch (e) {
      speakText('導航規劃失敗，請稍後再試');
      setIsNavigating(false);
    }
  };

  const startItineraryNavigation = async () => {
    if (!realLocation || !itinerary || itinerary.length === 0) return;
    setShowItineraryPanel(false);
    speakText(`開始行程導航，共 ${itinerary.length} 個停靠點`);

    setItineraryQueue([...itinerary]);
    await routeToTarget(realLocation, itinerary[0]);
  };

  const handleNextStop = async () => {
    if (itineraryQueue.length <= 1) return;

    const nextQueue = itineraryQueue.slice(1);
    setItineraryQueue(nextQueue);

    await routeToTarget(realLocation, nextQueue[0]);
  };

  const startNavigation = async (event) => {
    if (!realLocation) return;
    setSelectedStop(null);
    setItineraryQueue([]);
    await routeToTarget(realLocation, event);
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

  const handleSimulateMovement = () => {
    if (!navigationRoute?.steps) return;
    const nextIdx = Math.min(currentStepIdx + 1, navigationRoute.steps.length - 1);
    setCurrentStepIdx(nextIdx);

    const step = navigationRoute.steps[nextIdx];
    if (step && step.location) {
      const fakeLoc = { latitude: step.location[1], longitude: step.location[0] };
      setRealLocation(fakeLoc);

      sendToMap('updateDoge', { lat: fakeLoc.latitude, lng: fakeLoc.longitude });
      sendToMap('flyTo', { lat: fakeLoc.latitude, lng: fakeLoc.longitude, zoom: 17 });
      speakText(step.instruction || '');
    }
  };

  const endNavigation = () => {
    Animated.parallel([
      Animated.timing(topBannerAnim, { toValue: -200, duration: 250, useNativeDriver: true }),
      Animated.timing(bottomBarAnim, { toValue: 300, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setNavigationRoute(null);
      setIsNavigating(false);
      setCurrentStepIdx(0);
      sendToMap('clearRoute', {});
      speakText('導航已結束');
    });
  };

  const onWebMsg = (e) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'mapReady') setMapReady(true);
      if (msg.type === 'eventClicked') {
        const ev = events.find(x => x.id === msg.data.id);
        if (ev) { setCurrentEvent(ev); setShowEventDetail(true); }
      }
      if (msg.type === 'meetupClicked') {
        navigation.navigate('Meetups', { focusId: msg.data.id });
      }
      if (msg.type === 'busStopClicked') {
        speakText(`站牌: ${msg.data.name}`);
        setSelectedStop(msg.data);
        fetchEtaForStop(msg.data.id);
      }
      if (msg.type === 'mrtClicked') speakText(`站點: ${msg.data.name}`);
    } catch (_) {}
  };

  const currentStep = navigationRoute?.steps?.[currentStepIdx] || null;

  const getEtaText = (status, estimateTime) => {
    if (status === 1) return '尚未發車';
    if (status === 2) return '交管不停';
    if (status === 3) return '末班已過';
    if (status === 4) return '未營運';
    if (estimateTime === undefined || estimateTime === null) return '計算中';
    const mins = Math.floor(estimateTime / 60);
    if (mins <= 1) return '進站中';
    return `${mins} 分鐘`;
  };

  const mapHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><script src="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.js"></script><link href="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.css" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body,html{width:100%;height:100%;overflow:hidden;background:#000}#map{width:100%;height:100%}.doge{font-size:32px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.7));animation:bob 1.6s ease-in-out infinite alternate;cursor:default}@keyframes bob{from{transform:translateY(0)}to{transform:translateY(-5px)}}.mrt-wrap{position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer}.mrt-dot{width:13px;height:13px;border-radius:50%;border:2px solid white;box-shadow:0 1px 5px rgba(0,0,0,.5)}.mrt-name{position:absolute;bottom:16px;color:white;font-size:8px;font-weight:700;white-space:nowrap;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,.9)}.ev-pin{cursor:pointer;filter:drop-shadow(0 2px 5px rgba(0,0,0,.6));}.ev-pin:active{transform:scale(1.2)}.mt-pin{display:flex;flex-direction:column;align-items:center;cursor:pointer;filter:drop-shadow(0 2px 5px rgba(0,0,0,.6))}.mt-ico{font-size:26px;line-height:1}.mt-cnt{background:#0A84FF;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px;margin-top:-2px;border:1.5px solid #fff}</style></head><body><div id="map"></div><script>mapboxgl.accessToken='${MAPBOX_TOKEN}';const map=new mapboxgl.Map({container:'map',style:'mapbox://styles/mapbox/standard',center:[121.5065,25.0424],zoom:14,pitch:45});let dogeMk=null;const mrtMks={},evMks={},mtMks={};map.on('load',()=>{map.addSource('dem',{type:'raster-dem',url:'mapbox://mapbox.mapbox-terrain-dem-v1',tileSize:512});map.setTerrain({source:'dem',exaggeration:1.2});map.addLayer({id:'bldg',source:'composite','source-layer':'building',filter:['==','extrude','true'],type:'fill-extrusion',minzoom:14,paint:{'fill-extrusion-color':'#b0b8c8','fill-extrusion-height':['get','height'],'fill-extrusion-opacity':0.65}});map.addSource('route',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:[]}}});map.addLayer({id:'route-bg',type:'line',source:'route',paint:{'line-color':'#ffffff','line-width':10,'line-opacity':.4},layout:{'line-join':'round','line-cap':'round'}});map.addLayer({id:'route-main',type:'line',source:'route',paint:{'line-color':'#0A84FF','line-width':6,'line-opacity':1},layout:{'line-join':'round','line-cap':'round'}});const el=document.createElement('div');el.className='doge';el.innerHTML='🐕';dogeMk=new mapboxgl.Marker({element:el,anchor:'bottom'}).setLngLat([121.5065,25.0424]).addTo(map);
  map.addSource('bus-stops',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({
    id:'bus-stops-layer',
    type:'circle',
    source:'bus-stops',
    minzoom: 14.8,
    paint:{'circle-radius':5.5,'circle-color':'rgba(255,140,0,0.85)','circle-stroke-width':1.5,'circle-stroke-color':'rgba(255,210,100,0.9)'}
  });
  map.on('click','bus-stops-layer',(e)=>{const p=e.features[0].properties;sendRN('busStopClicked',{id:p.id,name:p.name,lat:p.lat,lng:p.lng})});
  map.on('mouseenter','bus-stops-layer',()=>{map.getCanvas().style.cursor='pointer'});map.on('mouseleave','bus-stops-layer',()=>{map.getCanvas().style.cursor=''});

  map.addSource('buses',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  const busSvg = '<svg width="26" height="26" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="8" width="26" height="15" rx="3" fill="rgba(20,80,200,0.85)" stroke="#5599EE" stroke-width="1.5"/><line x1="3" y1="15" x2="29" y2="15" stroke="#7AB8F5" stroke-width="0.8"/><circle cx="9" cy="24" r="2.5" fill="#fff" stroke="#5599EE" stroke-width="1.5"/><circle cx="23" cy="24" r="2.5" fill="#fff" stroke="#5599EE" stroke-width="1.5"/></svg>';
  const busImg = new Image(26, 26);
  busImg.onload = () => {
    if (!map.hasImage('bus-icon')) map.addImage('bus-icon', busImg);
    map.addLayer({
      id:'buses-layer',
      type:'symbol',
      source:'buses',
      layout:{
        'icon-image':'bus-icon',
        'icon-size':1.1,
        'icon-allow-overlap':true,
        'text-field':['get','routeName'],
        'text-size':10,
        'text-offset':[0,-1.4],
        'text-allow-overlap':false
      },
      paint:{'text-color':'#FFFFFF','text-halo-color':'#0A84FF','text-halo-width':1.5}
    });
  };
  busImg.src = 'data:image/svg+xml;base64,' + btoa(busSvg);
  sendRN('mapReady',{})});

  window.handleMsg=function({action,data}){switch(action){case'updateDoge':dogeMk?.setLngLat([data.lng,data.lat]);break;case'flyTo':map.flyTo({center:[data.lng,data.lat],zoom:data.zoom||17,pitch:50,duration:1200});break;
  case'setBusStops': {
    const feats = data.stops.map(s=>({type:'Feature',properties:{id:s.id,name:s.name,lat:s.lat,lng:s.lng},geometry:{type:'Point',coordinates:[s.lng,s.lat]}}));
    map.getSource('bus-stops')?.setData({type:'FeatureCollection',features:feats});
    break;
  }
  case'updateBuses': {
    const feats = data.buses.map(b=>({type:'Feature',properties:{routeName:b.routeName},geometry:{type:'Point',coordinates:[b.lng,b.lat]}}));
    map.getSource('buses')?.setData({type:'FeatureCollection',features:feats});
    break;
  }
  case'addMrtStations':data.stations.forEach(st=>{if(mrtMks[st.id])return;const w=document.createElement('div');w.className='mrt-wrap';const nm=document.createElement('div');nm.className='mrt-name';nm.textContent=st.nameZh;const dot=document.createElement('div');dot.className='mrt-dot';dot.style.background=st.color;dot.addEventListener('click',()=>{sendRN('mrtClicked',{name:st.nameZh})});w.appendChild(nm);w.appendChild(dot);mrtMks[st.id]=new mapboxgl.Marker({element:w,anchor:'center'}).setLngLat([st.lng,st.lat]).addTo(map)});break;
  case'addEventMarkers':data.events.forEach(ev=>{if(evMks[ev.id])return;const el=document.createElement('div');el.className='ev-pin';el.style.fontSize='32px';el.innerHTML=ev.tags?.includes('food')?'🍜':ev.tags?.includes('music')?'🎵':ev.tags?.includes('art')?'🎨':'📍';el.addEventListener('click',()=>sendRN('eventClicked',{id:ev.id}));evMks[ev.id]=new mapboxgl.Marker({element:el,anchor:'bottom'}).setLngLat([ev.lng,ev.lat]).addTo(map)});break;
  case'addMeetupMarkers':
    Object.values(mtMks).forEach(mk=>mk.remove());
    Object.keys(mtMks).forEach(k=>delete mtMks[k]);
    data.meetups.forEach(mt=>{
      const el=document.createElement('div'); el.className='mt-pin';
      const ico=document.createElement('span'); ico.className='mt-ico'; ico.textContent='👥';
      const cnt=document.createElement('span'); cnt.className='mt-cnt'; cnt.textContent=mt.member_count+'/'+mt.max_people;
      el.appendChild(ico); el.appendChild(cnt);
      el.addEventListener('click',()=>sendRN('meetupClicked',{id:mt.id}));
      mtMks[mt.id]=new mapboxgl.Marker({element:el,anchor:'bottom'}).setLngLat([mt.lng,mt.lat]).addTo(map);
    });
    break;
  case'drawRoute':map.getSource('route').setData({type:'Feature',geometry:data.geometry});break;case'clearRoute':map.getSource('route').setData({type:'Feature',geometry:{type:'LineString',coordinates:[]}});break;}};function sendRN(type,data){window.ReactNativeWebView?.postMessage(JSON.stringify({type,data}))}</script></body></html>`;

  return (
    <View style={styles.container}>
      <WebView ref={webViewRef} source={{ html: mapHTML }} style={styles.webView} onMessage={onWebMsg} javaScriptEnabled originWhitelist={['*']} />

      {isNavigating && <TopNavBanner step={currentStep} slideAnim={topBannerAnim} />}
      {!isNavigating && <VoiceGuide message={voiceMessage} />}

      {weather && !isNavigating && (
        <SafeAreaView style={styles.weatherSafeArea}>
          <BlurView intensity={80} tint="dark" style={styles.weatherWidget}>
            <TouchableOpacity onPress={() => setShowWeatherPanel(true)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, marginRight: 6 }}>{weather.temperature >= 25 ? '☀️' : '☁️'}</Text>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{weather.temperature}°C</Text>
            </TouchableOpacity>
          </BlurView>
        </SafeAreaView>
      )}

      {selectedStop && !isNavigating && (
        <View style={styles.stopEtaPanelWrapper}>
          <BlurView intensity={90} tint="dark" style={styles.stopEtaPanel}>
            <View style={styles.stopEtaHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="bus" size={24} color="#0A84FF" />
                <Text style={styles.stopTitle}>{selectedStop.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStop(null)}>
                <Ionicons name="close-circle" size={26} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.etaListContainer}>
              {etaLoading ? (
                <ActivityIndicator size="small" color="#0A84FF" style={{ marginVertical: 20 }} />
              ) : stopEtas.length === 0 ? (
                <Text style={styles.etaEmptyText}>目前無到站資訊</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {stopEtas.map((item, idx) => (
                    <View key={idx} style={styles.etaBadge}>
                      <Text style={styles.etaRouteName}>{item.routeName}</Text>
                      <Text style={[styles.etaTime, item.estimateTime <= 120 && { color: '#FF453A' }]}>
                        {getEtaText(item.status, item.estimateTime)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <TouchableOpacity style={styles.navToStopBtn} onPress={() => startNavigation(selectedStop)} activeOpacity={0.8}>
              <Ionicons name="navigate" size={18} color="white" />
              <Text style={styles.navToStopBtnText}>導航至此站</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      )}

      {!isNavigating && !selectedStop && (
        <View style={styles.rightButtons}>
          {(busUpdating || isFirstLoad) && (
            <BlurView intensity={80} tint="dark" style={styles.loadingBadge}>
              <ActivityIndicator size="small" color="#0A84FF" />
              <Text style={styles.loadingText}>{isFirstLoad ? '連線 TDX 中...' : '即時路況'}</Text>
            </BlurView>
          )}

          <TouchableOpacity style={styles.glassBtnWrapper} onPress={handleLocatePress} activeOpacity={0.8}>
            <BlurView intensity={isLocating ? 100 : 75} tint={isLocating ? 'light' : 'dark'} style={[styles.glassBtn, isLocating && styles.glassBtnActive]}>
              <Ionicons name={isLocating ? 'navigate' : 'navigate-outline'} size={26} color={isLocating ? '#0A84FF' : 'white'} />
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity style={styles.glassBtnWrapper} onPress={() => navigation.navigate('Meetups')} activeOpacity={0.8}>
            <BlurView intensity={75} tint="dark" style={styles.glassBtn}>
              <Ionicons name="people-outline" size={26} color="white" />
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity style={styles.glassBtnWrapper} onPress={() => setShowItineraryPanel(true)} activeOpacity={0.8}>
            <BlurView intensity={75} tint="dark" style={styles.glassBtn}>
              <Ionicons name="map-outline" size={26} color="white" />
              {itinerary?.length > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{itinerary.length}</Text></View>
              )}
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity style={styles.glassBtnWrapper} onPress={() => setShowCards(true)} activeOpacity={0.8}>
            <BlurView intensity={75} tint="dark" style={styles.glassBtn}>
              <Ionicons name="albums-outline" size={26} color="white" />
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity style={styles.glassBtnWrapper} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <BlurView intensity={75} tint="dark" style={styles.glassBtn}>
              <Ionicons name="home-outline" size={26} color="white" />
            </BlurView>
          </TouchableOpacity>
        </View>
      )}

      {isNavigating && (
        <BottomETABar
          route={navigationRoute}
          currentStepIdx={currentStepIdx}
          onEndRoute={endNavigation}
          onSimulate={handleSimulateMovement}
          slideAnim={bottomBarAnim}
          hasNextStop={itineraryQueue.length > 1}
          onNextStop={handleNextStop}
        />
      )}

      {geofenceEvent && !isNavigating && <GeofenceAlert event={geofenceEvent} onNavigate={ev => { setGeofenceEvent(null); startNavigation(ev); }} onDismiss={() => setGeofenceEvent(null)} />}

      {showCards && <SwipeCards events={events} onSwipe={(ev, dir) => { if (dir === 'right') addToItinerary(ev); }} onClose={() => setShowCards(false)} />}

      <Modal visible={showEventDetail} transparent animationType="slide">
        <HistoricalEventCard event={currentEvent} onClose={() => setShowEventDetail(false)} onNavigate={(lat, lng) => { setShowEventDetail(false); startNavigation({ ...currentEvent, lat, lng }); }} />
      </Modal>

      <Modal visible={showItineraryPanel} transparent animationType="slide">
        <View style={styles.modalOverlayBottom}>
          <BlurView intensity={95} tint="dark" style={styles.itineraryPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎒 我的行程</Text>
              <TouchableOpacity onPress={() => setShowItineraryPanel(false)}>
                <Ionicons name="close-circle" size={28} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {(!itinerary || itinerary.length === 0) ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="folder-open-outline" size={48} color="#48484A" style={{ marginBottom: 12 }} />
                <Text style={{ color: '#8E8E93', fontSize: 16 }}>目前還沒加入景點</Text>
              </View>
            ) : (
              itinerary.map((item, index) => (
                <View key={item.id || index} style={styles.itineraryItem}>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', flex: 1 }}>{index + 1}. {item.title}</Text>
                  <TouchableOpacity onPress={() => removeFromItinerary(item.id)} style={{ padding: 6, backgroundColor: 'rgba(255,59,48,0.15)', borderRadius: 8 }}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {itinerary?.length > 0 && (
              <TouchableOpacity style={styles.navButton} activeOpacity={0.8} onPress={startItineraryNavigation}>
                <Text style={{ color: 'white', fontSize: 17, fontWeight: '600' }}>開始行程導航</Text>
              </TouchableOpacity>
            )}
          </BlurView>
        </View>
      </Modal>

      <Modal visible={showWeatherPanel} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView intensity={95} tint="dark" style={styles.weatherPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🌤 台北天氣預報</Text>
              <TouchableOpacity onPress={() => setShowWeatherPanel(false)}>
                <Ionicons name="close-circle" size={28} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {hourlyForecast?.time ? (
              <View style={styles.hourlyContainer}>
                <Text style={styles.sectionTitle}>未來 24 小時預報</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyScroll}>
                  {hourlyForecast.time
                    .map((timeString, idx) => ({
                      time: new Date(timeString),
                      temp: Math.round(hourlyForecast.temperature_2m[idx]),
                      code: hourlyForecast.weathercode[idx]
                    }))
                    .filter(item => item.time.getTime() >= Date.now() - 3600000)
                    .slice(0, 24)
                    .map((item, idx) => (
                      <View key={idx} style={styles.hourlyItem}>
                        <Text style={styles.hourlyTime}>{idx === 0 ? '現在' : `${item.time.getHours()}:00`}</Text>
                        <Text style={styles.hourlyIcon}>{getWeatherIcon(item.code)}</Text>
                        <Text style={styles.hourlyTemp}>{item.temp}°</Text>
                      </View>
                    ))
                  }
                </ScrollView>
              </View>
            ) : (
              <ActivityIndicator size="small" color="#0A84FF" style={{ marginBottom: 20 }} />
            )}

            <View style={styles.weatherDivider} />

            <Text style={styles.sectionTitle}>近五日溫度趨勢</Text>
            {forecast?.time ? forecast.time.slice(0, 5).map((date, idx) => (
              <View key={date} style={styles.weatherRow}>
                <Text style={styles.weatherDate}>{date.slice(5)}</Text>
                <View style={styles.weatherBar}>
                  <Text style={styles.weatherTempMin}>{Math.round(forecast.temperature_2m_min[idx])}°</Text>
                  <View style={styles.weatherLine} />
                  <Text style={styles.weatherTempMax}>{Math.round(forecast.temperature_2m_max[idx])}°</Text>
                </View>
              </View>
            )) : (
              <ActivityIndicator size="large" color="#0A84FF" style={{ marginVertical: 20 }} />
            )}
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webView: { flex: 1, width, height },
  rightButtons: { position: 'absolute', right: 20, bottom: Platform.OS === 'ios' ? 140 : 120, alignItems: 'center', gap: 16 },
  glassBtnWrapper: { borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  glassBtn: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  glassBtnActive: { borderColor: '#0A84FF', borderWidth: 1.5 },

  loadingBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, gap: 8, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  loadingText: { color: '#0A84FF', fontSize: 13, fontWeight: '600' },
  badge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#FF3B30', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#1C1C1E' },
  badgeText: { color: 'white', fontSize: 11, fontWeight: 'bold' },

  weatherSafeArea: { position: 'absolute', top: 20, left: 20 },
  weatherWidget: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },

  stopEtaPanelWrapper: { position: 'absolute', bottom: Platform.OS === 'ios' ? 34 : 20, left: 16, right: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 15 },
  stopEtaPanel: { borderRadius: 24, padding: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  stopEtaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  stopTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  etaListContainer: { minHeight: 60, justifyContent: 'center' },
  etaEmptyText: { color: '#8E8E93', fontSize: 14, textAlign: 'center', paddingVertical: 10 },
  etaBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, alignItems: 'center', minWidth: 70 },
  etaRouteName: { color: 'white', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  etaTime: { color: '#32D74B', fontSize: 12, fontWeight: '700' },
  navToStopBtn: { backgroundColor: '#0A84FF', paddingVertical: 14, borderRadius: 16, marginTop: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  navToStopBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  modalOverlayBottom: { flex: 1, justifyContent: 'flex-end' },
  itineraryPanel: { height: '65%', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: 'white', fontSize: 22, fontWeight: '700' },
  itineraryItem: { backgroundColor: 'rgba(255,255,255,0.08)', padding: 18, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  navButton: { backgroundColor: '#0A84FF', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 'auto', shadowColor: '#0A84FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  weatherPanel: { width: '85%', borderRadius: 24, padding: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  weatherRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  weatherDate: { color: 'white', fontSize: 16, fontWeight: '500' },
  weatherBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weatherTempMin: { color: '#0A84FF', fontSize: 16, fontWeight: '600', width: 35, textAlign: 'right' },
  weatherLine: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  weatherTempMax: { color: '#FF453A', fontSize: 16, fontWeight: '600', width: 35 },
  hourlyContainer: { marginBottom: 20 },
  sectionTitle: { color: '#8E8E93', fontSize: 13, fontWeight: '600', marginBottom: 12, letterSpacing: 1 },
  hourlyScroll: { gap: 16 },
  hourlyItem: { alignItems: 'center', minWidth: 45 },
  hourlyTime: { color: '#EBEBF5', fontSize: 14, fontWeight: '500', marginBottom: 8 },
  hourlyIcon: { fontSize: 24, marginBottom: 8 },
  hourlyTemp: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  weatherDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 16 },
});

const nav = StyleSheet.create({
  topBannerWrapper: { position: 'absolute', top: 0, left: 0, right: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 15 },
  blurContainer: { paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 10 : 20, gap: 16 },
  arrowBox: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  infoBox: { flex: 1, justifyContent: 'center' },
  distNum: { color: 'white', fontSize: 42, fontWeight: '800', tracking: -1 },
  distUnit: { color: '#A1A1A6', fontSize: 18, fontWeight: '500', marginBottom: 4 },
  streetName: { color: 'white', fontSize: 20, fontWeight: '600', marginTop: 4 },
  fullInstr: { color: '#A1A1A6', fontSize: 13, paddingHorizontal: 24, paddingTop: 12, fontWeight: '400' },

  bottomBarWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 20 },
  bottomBlurContainer: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: Platform.OS === 'ios' ? 34 : 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  progressTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.1)', width: '100%' },
  progressFill: { height: '100%', backgroundColor: '#0A84FF', borderTopRightRadius: 5, borderBottomRightRadius: 5 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, gap: 12 },
  etaBlock: { flex: 1, alignItems: 'center' },
  etaBig: { color: 'white', fontSize: 24, fontWeight: '700' },
  etaSub: { color: '#A1A1A6', fontSize: 12, marginTop: 4, fontWeight: '500' },
  etaDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.15)' },
  simBtn: { backgroundColor: 'rgba(10,132,255,0.15)', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 20, marginLeft: 8, borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)' },
  endBtn: { backgroundColor: 'rgba(255,59,48,0.15)', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 20, marginLeft: 8, borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)' },
  endBtnText: { color: '#FF453A', fontSize: 17, fontWeight: '600' },
});