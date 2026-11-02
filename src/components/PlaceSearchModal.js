/**
 * PlaceSearchModal - 幫行程選地點
 * 三種來源：App 內的活動地點、Mapbox 地點搜尋（餐廳、景點、地址）、我目前的位置
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Location from 'expo-location';

import EventService from '../services/EventService';
import { MAPBOX_TOKEN } from '../config';
import { notify } from '../utils/notify';

const TAIPEI = { lng: 121.5654, lat: 25.033 };

async function searchMapbox(q) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
    + `?access_token=${MAPBOX_TOKEN}&limit=6&language=en&country=tw&proximity=${TAIPEI.lng},${TAIPEI.lat}`
    + '&types=poi,address,neighborhood,locality,place';
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 401 ? 'The Mapbox token was rejected.' : `Place search failed (${res.status})`);
  const j = await res.json();
  return (j.features || []).map(f => ({
    id: f.id,
    name: f.text || f.place_name,
    sub: f.place_name,
    lat: f.center[1],
    lng: f.center[0],
  }));
}

export default function PlaceSearchModal({ visible, onClose, onPick }) {
  const [query, setQuery]     = useState('');
  const [spots, setSpots]     = useState([]);
  const [results, setResults] = useState([]);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const [locating, setLocating] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (visible) EventService.getAllEvents().then(setSpots).catch(() => {});
    else { setQuery(''); setResults([]); setErr(''); }
  }, [visible]);

  const q = query.trim();

  useEffect(() => {
    if (q.length < 2 || !MAPBOX_TOKEN) { setResults([]); setErr(''); setBusy(false); return undefined; }
    const mine = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchMapbox(q);
        if (mine === seq.current) { setResults(r); setErr(''); }
      } catch (e) {
        if (mine === seq.current) setErr(e instanceof TypeError ? 'Cannot reach the place search. Check your connection.' : e.message);
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const matchingSpots = spots.filter(s =>
    !q || `${s.title} ${s.location || ''}`.toLowerCase().includes(q.toLowerCase()));

  const pickHere = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { notify('Location is off', 'Allow location access, or search for a place.'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      onPick({ name: 'My location', lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (_) {
      notify('Could not get your location', 'Try again, or search for a place.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Add a stop</Text>
            <TouchableOpacity onPress={onClose} style={styles.close}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={MAPBOX_TOKEN ? 'Search a restaurant, sight or address' : 'Filter the spots below'}
            placeholderTextColor="#64748b"
            autoCorrect={false}
          />

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 440 }}>
            {!q && (
              <TouchableOpacity style={styles.row} onPress={pickHere} disabled={locating}>
                <Text style={styles.name}>📍  My current location</Text>
                {locating && <ActivityIndicator color="#fff" />}
              </TouchableOpacity>
            )}

            {q.length >= 2 && !MAPBOX_TOKEN && (
              <Text style={styles.note}>Place search needs your Mapbox token in src/config.js. You can still pick from the app's spots.</Text>
            )}
            {busy && <ActivityIndicator color="#fff" style={{ margin: 12 }} />}
            {!!err && <Text style={styles.note}>{err}</Text>}

            {results.length > 0 && <Text style={styles.section}>Places</Text>}
            {results.map(r => (
              <TouchableOpacity key={r.id} style={styles.row} onPress={() => onPick({ name: r.name, lat: r.lat, lng: r.lng })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{r.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {matchingSpots.length > 0 && <Text style={styles.section}>Spots in the app</Text>}
            {matchingSpots.map(s => (
              <TouchableOpacity key={s.id} style={styles.row} onPress={() => onPick({ name: s.title, lat: s.lat, lng: s.lng })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{s.title}</Text>
                  {!!s.location && <Text style={styles.sub} numberOfLines={1}>{s.location}</Text>}
                </View>
              </TouchableOpacity>
            ))}

            {q.length >= 2 && !busy && !err && results.length === 0 && matchingSpots.length === 0 && MAPBOX_TOKEN ? (
              <Text style={styles.note}>Nothing found for "{q}".</Text>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#16213e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 34 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  closeText: { color: 'white', fontSize: 20 },
  input: { backgroundColor: 'rgba(255,255,255,0.08)', color: 'white', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 8 },
  section: { color: '#94a3b8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  name: { color: 'white', fontSize: 16, fontWeight: '600' },
  sub: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
  note: { color: '#cbd5e0', fontSize: 14, padding: 14, lineHeight: 20 },
});
