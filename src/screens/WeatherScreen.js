/**
 * WeatherScreen - 天氣
 *
 * 資料：Open-Meteo（免金鑰）。每個地點快取 15 分鐘，切換地點先顯示舊資料再背景更新。
 * 內容：目前天氣、由預報推算的提醒、降雨、24 小時圖表（溫度/降雨/風/UV）、
 *       逐日預報、細節、空氣品質、日出日落與月相、多地點、單位切換。
 * 版面為原創：背景隨天氣與日夜變色，區塊用半透明卡片。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';

import WeatherService from '../services/WeatherService';
import {
  describeCode, skyColors, fmtTemp, rainSummary, deriveNotices, WIND_UNIT_LABEL,
} from '../utils/weather';
import SkyBackground from '../components/weather/SkyBackground';
import HourlyChart, { METRIC_KEYS } from '../components/weather/HourlyChart';
import SunMoonCard from '../components/weather/SunMoonCard';
import { Card, NoticeList, RainCard, DailyList, DetailGrid, AirCard } from '../components/weather/Cards';
import { notify } from '../utils/notify';

const METRIC_LABEL = { temp: 'Temp', rain: 'Rain', wind: 'Wind', uv: 'UV' };

/** 把「該地點當地時間字串」變成一個可以和日出日落比較的 Date（用同一套字串解析，兩邊偏差相同）*/
const localNowOf = (w) => new Date(w.current.time);

export default function WeatherScreen({ navigation }) {
  const [locations, setLocations] = useState([]);
  const [activeId, setActiveId]   = useState(null);
  const [units, setUnits]         = useState({ temp: 'C', wind: 'kmh' });
  const [store, setStore]         = useState({});            // locationId -> { w, stale }
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metric, setMetric]       = useState('temp');

  const [sheet, setSheet]         = useState(false);
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [locating, setLocating]   = useState(false);
  const searchSeq = useRef(0);

  // ── 初始化：地點與單位 ──
  useEffect(() => {
    (async () => {
      const [locs, u] = await Promise.all([WeatherService.getLocations(), WeatherService.getUnits()]);
      setLocations(locs);
      setUnits(u);
      setActiveId(locs[0].id);
    })();
  }, []);

  const active = useMemo(() => locations.find(l => l.id === activeId) || null, [locations, activeId]);
  const entry = active ? store[active.id] : null;
  const w = entry?.w || null;

  // ── 讀取天氣 ──
  const load = useCallback(async (loc, { force = false } = {}) => {
    if (!loc) return;
    setError('');
    try {
      await WeatherService.load(loc.lat, loc.lng, (data, meta) => {
        setStore(prev => ({ ...prev, [loc.id]: { w: data, stale: meta.stale } }));
        setLoading(false);
      }, { force });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    if (!store[active.id]) setLoading(true);
    load(active);
  }, [active?.id]);          // eslint-disable-line react-hooks/exhaustive-deps

  // ── 地點管理 ──
  const persist = (list) => { setLocations(list); WeatherService.saveLocations(list); };

  const addLocation = (loc) => {
    const exists = locations.find(l => Math.abs(l.lat - loc.lat) < 0.01 && Math.abs(l.lng - loc.lng) < 0.01);
    if (exists) { setActiveId(exists.id); }
    else if (locations.length >= 8) { notify('Location limit', 'You can keep up to 8 locations. Remove one first.'); return; }
    else { persist([...locations, loc]); setActiveId(loc.id); }
    setSheet(false); setQuery(''); setResults([]);
  };

  const removeLocation = (id) => {
    if (locations.length <= 1) return;
    const next = locations.filter(l => l.id !== id);
    persist(next);
    if (activeId === id) setActiveId(next[0].id);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { notify('Location is off', 'Allow location access to see the weather where you are.'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let name = 'My location', sub = '';
      try {
        const [place] = await Location.reverseGeocodeAsync(pos.coords);
        if (place) { name = place.district || place.city || place.subregion || name; sub = place.city || place.country || ''; }
      } catch (_) { /* 取不到地名就用預設 */ }
      const loc = { id: 'gps', name, sub, lat: pos.coords.latitude, lng: pos.coords.longitude, gps: true };
      const rest = locations.filter(l => l.id !== 'gps');
      persist([loc, ...rest]);
      setStore(prev => { const { gps, ...others } = prev; return others; });
      setActiveId('gps');
      setSheet(false);
    } catch (e) {
      notify('Could not get your location', 'Try again, or search for a place.');
    } finally {
      setLocating(false);
    }
  };

  // ── 搜尋（輸入停頓 400ms 才送出，且只採用最新一次的結果）──
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearchErr(''); setSearching(false); return undefined; }
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await WeatherService.search(q);
        if (seq !== searchSeq.current) return;
        setResults(r); setSearchErr('');
      } catch (e) {
        if (seq === searchSeq.current) setSearchErr(e.message);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const setUnit = (key, value) => {
    const next = { ...units, [key]: value };
    setUnits(next);
    WeatherService.saveUnits(next);
  };

  // ── 衍生資料（天氣沒變就不重算）──
  const derived = useMemo(() => {
    if (!w) return null;
    const desc = describeCode(w.current.code, w.current.isDay);
    return {
      desc,
      sky: skyColors(desc.kind, w.current.isDay),
      notices: deriveNotices(w),
      summary: rainSummary(w),
      localNow: localNowOf(w),
    };
  }, [w]);

  const updatedAt = w ? new Date(w.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

  // ── 畫面 ──
  const sky = derived?.sky || ['#1b2a41', '#324a5f'];

  return (
    <View style={styles.container}>
      <SkyBackground colors={sky} />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Text style={styles.iconText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.place} onPress={() => setSheet(true)} accessibilityLabel="Change location">
          <Text style={styles.placeName} numberOfLines={1}>{active ? `${active.gps ? '📍 ' : ''}${active.name}` : 'Weather'}</Text>
          <Text style={styles.placeChevron}>▾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setSheet(true)} accessibilityLabel="Locations and units">
          <Text style={styles.iconText}>⚙︎</Text>
        </TouchableOpacity>
      </View>

      {locations.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
          {locations.map(l => (
            <TouchableOpacity key={l.id} style={[styles.chip, l.id === activeId && styles.chipActive]} onPress={() => setActiveId(l.id)}>
              <Text style={[styles.chipText, l.id === activeId && styles.chipTextActive]} numberOfLines={1}>{l.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!w && loading && <View style={styles.center}><ActivityIndicator color="#fff" size="large" /></View>}

      {!w && !loading && error ? (
        <View style={styles.center}>
          <Text style={styles.errTitle}>Could not load the weather</Text>
          <Text style={styles.errText}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); load(active, { force: true }); }}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {w && derived && (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(active, { force: true }); }} tintColor="#fff" />}
        >
          {/* 目前天氣 */}
          <View style={styles.hero}>
            <Text style={styles.heroTemp}>{fmtTemp(w.current.temp, units.temp)}</Text>
            <Text style={styles.heroDesc}>{derived.desc.icon}  {derived.desc.label}</Text>
            <Text style={styles.heroSub}>
              Feels like {fmtTemp(w.current.feels, units.temp)}  ·  H {fmtTemp(w.days[0].max, units.temp)}  L {fmtTemp(w.days[0].min, units.temp)}
            </Text>
            <Text style={styles.updated}>
              Updated {updatedAt}{entry?.stale ? ' · refreshing…' : ''}{error ? ' · offline, showing saved data' : ''}
            </Text>
          </View>

          <NoticeList notices={derived.notices} />

          <RainCard summary={derived.summary} next={w.nextHours} />

          <Card title="Next 24 hours" icon="🕒">
            <View style={styles.metricRow}>
              {METRIC_KEYS.map(k => (
                <TouchableOpacity key={k} style={[styles.metricBtn, metric === k && styles.metricActive]} onPress={() => setMetric(k)}>
                  <Text style={[styles.metricText, metric === k && styles.metricTextActive]}>{METRIC_LABEL[k]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <HourlyChart hours={w.hours} metric={metric} units={units} />
          </Card>

          <DailyList days={w.days} units={units} currentTemp={w.current.temp} />

          <DetailGrid current={w.current} units={units} />

          <AirCard air={w.air} />

          <Card title="Sun and moon" icon="🌅">
            <SunMoonCard day={w.days[0]} localNow={derived.localNow} />
          </Card>

          <TouchableOpacity onPress={() => Linking.openURL('https://open-meteo.com/')}>
            <Text style={styles.credit}>Weather data by Open-Meteo.com</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* 地點與單位 */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <KeyboardAvoidingView style={styles.sheetWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setSheet(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Locations</Text>
              <TouchableOpacity onPress={() => setSheet(false)} style={styles.sheetClose}><Text style={styles.iconText}>✕</Text></TouchableOpacity>
            </View>

            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search a city or district"
              placeholderTextColor="#7b8ba1"
              autoCorrect={false}
              returnKeyType="search"
            />

            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }}>
              {query.trim().length >= 2 ? (
                <>
                  {searching && <ActivityIndicator color="#fff" style={{ margin: 12 }} />}
                  {!searching && searchErr ? <Text style={styles.sheetNote}>{searchErr}</Text> : null}
                  {!searching && !searchErr && results.length === 0 && <Text style={styles.sheetNote}>No places found for "{query.trim()}".</Text>}
                  {results.map(r => (
                    <TouchableOpacity key={r.id} style={styles.locRow} onPress={() => addLocation(r)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.locName}>{r.name}</Text>
                        {!!r.sub && <Text style={styles.locSub}>{r.sub}</Text>}
                      </View>
                      <Text style={styles.locAdd}>Add</Text>
                    </TouchableOpacity>
                  ))}
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.locRow} onPress={useMyLocation} disabled={locating}>
                    <Text style={styles.locName}>📍  Use my current location</Text>
                    {locating && <ActivityIndicator color="#fff" />}
                  </TouchableOpacity>

                  {locations.map(l => (
                    <View key={l.id} style={styles.locRow}>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => { setActiveId(l.id); setSheet(false); }}>
                        <Text style={[styles.locName, l.id === activeId && { color: '#ffd166' }]}>{l.gps ? '📍 ' : ''}{l.name}</Text>
                        {!!l.sub && <Text style={styles.locSub}>{l.sub}</Text>}
                      </TouchableOpacity>
                      {locations.length > 1 && (
                        <TouchableOpacity onPress={() => removeLocation(l.id)} style={styles.locRemove} accessibilityLabel={`Remove ${l.name}`}>
                          <Text style={styles.locSub}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  <Text style={styles.unitHead}>Units</Text>
                  <View style={styles.unitRow}>
                    <Text style={styles.unitLabel}>Temperature</Text>
                    {['C', 'F'].map(u => (
                      <TouchableOpacity key={u} style={[styles.unitBtn, units.temp === u && styles.unitActive]} onPress={() => setUnit('temp', u)}>
                        <Text style={[styles.unitText, units.temp === u && styles.unitTextActive]}>°{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.unitRow}>
                    <Text style={styles.unitLabel}>Wind</Text>
                    {Object.keys(WIND_UNIT_LABEL).map(u => (
                      <TouchableOpacity key={u} style={[styles.unitBtn, units.wind === u && styles.unitActive]} onPress={() => setUnit('wind', u)}>
                        <Text style={[styles.unitText, units.wind === u && styles.unitTextActive]}>{WIND_UNIT_LABEL[u]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1b2a41' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 12, paddingBottom: 6 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#fff', fontSize: 22 },
  place: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 44, gap: 6 },
  placeName: { color: '#fff', fontSize: 20, fontWeight: '600', maxWidth: '80%' },
  placeChevron: { color: '#dbe6f2', fontSize: 14 },

  chipScroll: { flexGrow: 0 },
  chipRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  chip: { paddingHorizontal: 14, minHeight: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  chipActive: { backgroundColor: '#fff' },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '600', maxWidth: 120 },
  chipTextActive: { color: '#1b2a41' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  errTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 6 },
  errText: { color: '#dbe6f2', fontSize: 14, textAlign: 'center' },
  retry: { marginTop: 16, backgroundColor: '#fff', borderRadius: 22, minHeight: 44, paddingHorizontal: 24, justifyContent: 'center' },
  retryText: { color: '#1b2a41', fontWeight: '700' },

  scroll: { paddingHorizontal: 16, paddingBottom: 48 },
  hero: { alignItems: 'center', paddingTop: 12, paddingBottom: 26 },
  heroTemp: { color: '#fff', fontSize: 104, fontWeight: '200', lineHeight: 112, letterSpacing: -2 },
  heroDesc: { color: '#fff', fontSize: 22, fontWeight: '500', marginTop: 2 },
  heroSub: { color: '#dbe6f2', fontSize: 14, marginTop: 8 },
  updated: { color: '#bccbdb', fontSize: 11, marginTop: 8 },

  metricRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  metricBtn: { paddingHorizontal: 14, minHeight: 32, borderRadius: 16, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  metricActive: { backgroundColor: '#fff' },
  metricText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  metricTextActive: { color: '#1b2a41' },

  credit: { color: '#bccbdb', fontSize: 12, textAlign: 'center', paddingVertical: 12, textDecorationLine: 'underline' },

  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#17233a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 34 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sheetClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  search: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 8 },
  sheetNote: { color: '#cfdbe8', fontSize: 14, padding: 14 },
  locRow: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)' },
  locName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  locSub: { color: '#9fb0c6', fontSize: 12, marginTop: 1 },
  locAdd: { color: '#ffd166', fontSize: 14, fontWeight: '700', paddingHorizontal: 6 },
  locRemove: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  unitHead: { color: '#9fb0c6', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 6 },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50 },
  unitLabel: { color: '#fff', fontSize: 15, flex: 1 },
  unitBtn: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  unitActive: { backgroundColor: '#ffd166' },
  unitText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  unitTextActive: { color: '#17233a' },
});
