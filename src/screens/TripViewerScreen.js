/**
 * TripViewerScreen - 查看別人分享的行程（唯讀）
 * 從分享連結（taipeidt://trip/CODE）或「貼上代碼」進來。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';

import TripService from '../services/TripService';
import { notify } from '../utils/notify';

export default function TripViewerScreen({ navigation, route }) {
  const code = route.params?.code;
  const [trip, setTrip]   = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dayIdx, setDayIdx]   = useState(0);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setTrip(await TripService.fetchShared(code)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [code]);
  useEffect(() => { load(); }, [load]);

  const saveCopy = async () => {
    setSaving(true);
    try {
      const copy = await TripService.importShared(trip);
      navigation.replace('TripEditor', { tripId: copy.id });
    } catch (e) {
      notify('Could not save a copy', e.message);
      setSaving(false);
    }
  };

  const viewOnMap = () => {
    const day = trip.days[dayIdx];
    if (!day.stops.length) return;
    const params = {
      showTrip: {
        title: `${trip.title} · Day ${dayIdx + 1}`,
        stops: day.stops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng })),
        ts: Date.now(),
      },
    };
    const hasMap = navigation.getState().routes.some(r => r.name === 'Map');
    if (hasMap && typeof navigation.popTo === 'function') navigation.popTo('Map', params);
    else navigation.navigate('Map', params);
  };

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'));
  const day = trip?.days[dayIdx];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={goBack}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.title} numberOfLines={2}>{trip ? trip.title : 'Shared trip'}</Text>
        {!!trip && <Text style={styles.sub}>Shared with you · read only</Text>}
      </View>

      {loading && <View style={styles.center}><ActivityIndicator color="#3b82f6" size="large" /></View>}

      {!loading && error ? (
        <View style={styles.center}>
          <Text style={styles.errTitle}>{/not found/i.test(error) ? 'This trip is no longer shared' : 'Could not open this trip'}</Text>
          <Text style={styles.errText}>{/not found/i.test(error) ? 'The owner may have stopped sharing it, or the link is incomplete.' : error}</Text>
          {!/not found/i.test(error) && <TouchableOpacity style={styles.btn} onPress={load}><Text style={styles.btnText}>Try again</Text></TouchableOpacity>}
        </View>
      ) : null}

      {!!trip && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabs}>
            {trip.days.map((d, i) => (
              <TouchableOpacity key={i} style={[styles.tab, i === dayIdx && styles.tabActive]} onPress={() => setDayIdx(i)}>
                <Text style={[styles.tabText, i === dayIdx && styles.tabTextActive]}>Day {i + 1}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView contentContainerStyle={styles.list}>
            {day.stops.length === 0 && <Text style={styles.errText}>No stops on this day.</Text>}
            {day.stops.map((s, i) => (
              <View key={i} style={styles.stop}>
                <View style={styles.badge}><Text style={styles.badgeText}>{i + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopName}>{s.time ? <Text style={styles.time}>{s.time}  </Text> : null}{s.name}</Text>
                  {!!s.note && <Text style={styles.note}>{s.note}</Text>}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost, !day.stops.length && { opacity: 0.4 }]} onPress={viewOnMap} disabled={!day.stops.length}>
              <Text style={styles.btnGhostText}>View day on map</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} onPress={saveCopy} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save a copy'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 8 },
  back: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backText: { color: '#3b82f6', fontSize: 16 },
  title: { color: 'white', fontSize: 28, fontWeight: 'bold' },
  sub: { color: '#94a3b8', fontSize: 13, marginTop: 4 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  errTitle: { color: 'white', fontSize: 18, fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  errText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  tabScroll: { flexGrow: 0 },
  tabs: { paddingHorizontal: 20, gap: 8, paddingVertical: 10 },
  tab: { minHeight: 38, paddingHorizontal: 18, borderRadius: 19, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { color: '#94a3b8', fontWeight: '600' },
  tabTextActive: { color: 'white' },

  list: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4 },
  stop: { flexDirection: 'row', gap: 12, backgroundColor: '#16213e', borderRadius: 14, padding: 14, marginBottom: 10 },
  badge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#1a1a2e', fontWeight: 'bold' },
  stopName: { color: 'white', fontSize: 16, fontWeight: '600' },
  time: { color: '#60a5fa', fontWeight: '700' },
  note: { color: '#94a3b8', fontSize: 14, marginTop: 3, lineHeight: 19 },

  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
  btn: { flex: 1, minHeight: 50, borderRadius: 25, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#475569' },
  btnGhostText: { color: '#cbd5e0', fontSize: 15, fontWeight: '600' },
});
