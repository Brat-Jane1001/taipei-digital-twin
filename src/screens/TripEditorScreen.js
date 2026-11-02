/**
 * TripEditorScreen - 編輯行程
 *
 * - 分天，每天一串景點；按住左邊 ☰ 上下拖曳換順序（▲▼ 可微調）
 * - 點景點可改名稱、時間、備註
 * - 變更會自動存在手機（離開畫面時也會存）
 * - Share：上傳快照並取得連結，再次按會更新同一個連結
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal,
  KeyboardAvoidingView, Platform, Share, ActivityIndicator,
} from 'react-native';

import TripService, { newId, emptyDay } from '../services/TripService';
import DraggableList from '../components/DraggableList';
import PlaceSearchModal from '../components/PlaceSearchModal';
import { notify, confirmAction } from '../utils/notify';

const ROW_H = 76;
const MAX_DAYS = 14;
const MAX_STOPS_PER_DAY = 30;

function normalizeTime(raw) {
  const t = raw.trim();
  if (!t) return '';
  const m = t.match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export default function TripEditorScreen({ navigation, route }) {
  const tripId = route.params?.tripId;
  const [trip, setTrip]         = useState(null);
  const [missing, setMissing]   = useState(false);
  const [dayIdx, setDayIdx]     = useState(0);
  const [dragging, setDragging] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [editing, setEditing]   = useState(null);     // { id, name, time, note }
  const [timeErr, setTimeErr]   = useState('');
  const [sharing, setSharing]   = useState(false);

  const latest = useRef(null);
  const timer  = useRef(null);
  const dirty  = useRef(false);

  useEffect(() => {
    TripService.get(tripId).then(t => {
      if (!t) { setMissing(true); return; }
      latest.current = t;
      setTrip(t);
    });
  }, [tripId]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (dirty.current && latest.current) {
      dirty.current = false;
      await TripService.save(latest.current);
    }
  }, []);

  // 離開畫面時把還沒存的內容存起來
  useEffect(() => () => { flush(); }, [flush]);

  const update = useCallback((fn) => {
    setTrip(prev => {
      if (!prev) return prev;
      const next = fn(prev);
      latest.current = next;
      dirty.current = true;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 500);
      return next;
    });
  }, [flush]);

  const day = trip?.days[Math.min(dayIdx, (trip?.days.length || 1) - 1)];
  const safeIdx = trip ? Math.min(dayIdx, trip.days.length - 1) : 0;

  const patchDay = (fn) => update(t => ({
    ...t, days: t.days.map((d, i) => (i === safeIdx ? fn(d) : d)),
  }));

  // ── 景點 ──
  const addStop = (place) => {
    if (day.stops.length >= MAX_STOPS_PER_DAY) { notify('Day is full', `A day can have up to ${MAX_STOPS_PER_DAY} stops.`); return; }
    patchDay(d => ({
      ...d,
      stops: [...d.stops, { id: newId(), name: place.name.slice(0, 80), lat: place.lat, lng: place.lng, note: '', time: '' }],
    }));
    setSearchOpen(false);
  };

  const removeStop = (id) => patchDay(d => ({ ...d, stops: d.stops.filter(s => s.id !== id) }));

  const moveStop = (index, delta) => patchDay(d => {
    const to = index + delta;
    if (to < 0 || to >= d.stops.length) return d;
    const stops = [...d.stops];
    const [m] = stops.splice(index, 1);
    stops.splice(to, 0, m);
    return { ...d, stops };
  });

  const reorder = (next) => patchDay(d => ({ ...d, stops: next }));

  const saveEdit = () => {
    const name = editing.name.trim();
    if (!name) { setTimeErr('Give this stop a name.'); return; }
    const time = normalizeTime(editing.time);
    if (time === null) { setTimeErr('Use a time like 09:30, or leave it empty.'); return; }
    patchDay(d => ({
      ...d,
      stops: d.stops.map(s => (s.id === editing.id ? { ...s, name: name.slice(0, 80), time, note: editing.note.trim().slice(0, 200) } : s)),
    }));
    setEditing(null); setTimeErr('');
  };

  // ── 天 ──
  const addDay = () => {
    if (trip.days.length >= MAX_DAYS) { notify('Day limit', `A trip can have up to ${MAX_DAYS} days.`); return; }
    update(t => ({ ...t, days: [...t.days, emptyDay()] }));
    setDayIdx(trip.days.length);
  };

  const removeDay = async () => {
    if (trip.days.length <= 1) return;
    if (day.stops.length) {
      const ok = await confirmAction(`Remove Day ${safeIdx + 1}?`, `Its ${day.stops.length} stop(s) will be deleted.`, 'Remove');
      if (!ok) return;
    }
    update(t => ({ ...t, days: t.days.filter((_, i) => i !== safeIdx) }));
    setDayIdx(Math.max(0, safeIdx - 1));
  };

  // ── 地圖 / 分享 ──
  const viewOnMap = () => {
    if (!day.stops.length) return;
    flush();
    const params = {
      showTrip: {
        title: `${trip.title} · Day ${safeIdx + 1}`,
        stops: day.stops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng })),
        ts: Date.now(),
      },
    };
    const hasMap = navigation.getState().routes.some(r => r.name === 'Map');
    if (hasMap && typeof navigation.popTo === 'function') navigation.popTo('Map', params);
    else navigation.navigate('Map', params);
  };

  const shareTrip = async () => {
    const total = trip.days.reduce((n, d) => n + d.stops.length, 0);
    if (total === 0) { notify('Add a stop first', 'There is nothing to share yet.'); return; }
    setSharing(true);
    try {
      await flush();
      const out = await TripService.share(latest.current);
      update(t => ({ ...t, shareCode: out.code }));
      try {
        await Share.share({ message: `${trip.title}\n${out.url}`, url: out.url });
      } catch (_) { /* 使用者關掉分享選單 */ }
    } catch (e) {
      notify('Could not share this trip', e.message);
    } finally {
      setSharing(false);
    }
  };

  const stopSharing = async () => {
    const ok = await confirmAction('Stop sharing?', 'The link will stop working for everyone who has it.', 'Stop sharing');
    if (!ok) return;
    try {
      await TripService.unshare(latest.current);
      update(t => { const { shareCode, ...rest } = t; return rest; });
    } catch (e) {
      notify('Could not stop sharing', e.message);
    }
  };

  if (missing) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.title}>Trip not found</Text>
        <TouchableOpacity style={styles.primary} onPress={() => navigation.goBack()}><Text style={styles.primaryText}>Back</Text></TouchableOpacity>
      </View>
    );
  }
  if (!trip) return <View style={[styles.container, styles.center]}><ActivityIndicator color="#3b82f6" /></View>;

  const renderRow = (item, index, panHandlers, active) => (
    <View style={[styles.row, active && styles.rowActive]}>
      <View {...panHandlers} style={styles.handle} accessibilityLabel="Drag to reorder">
        <Text style={styles.handleText}>☰</Text>
      </View>

      <TouchableOpacity
        style={styles.rowBody}
        activeOpacity={0.7}
        onPress={() => { setTimeErr(''); setEditing({ id: item.id, name: item.name, time: item.time || '', note: item.note || '' }); }}
      >
        <View style={styles.badge}><Text style={styles.badgeText}>{index + 1}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stopName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.stopMeta} numberOfLines={1}>
            {[item.time, item.note].filter(Boolean).join('  ·  ') || 'Tap to add a time or note'}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.steps}>
        <TouchableOpacity style={styles.step} onPress={() => moveStop(index, -1)} disabled={index === 0} accessibilityLabel="Move up">
          <Text style={[styles.stepText, index === 0 && styles.stepOff]}>▲</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.step} onPress={() => moveStop(index, 1)} disabled={index === day.stops.length - 1} accessibilityLabel="Move down">
          <Text style={[styles.stepText, index === day.stops.length - 1 && styles.stepOff]}>▼</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.remove} onPress={() => removeStop(item.id)} accessibilityLabel={`Remove ${item.name}`}>
        <Text style={styles.removeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headRow}>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.shareBtn, sharing && { opacity: 0.6 }]} onPress={shareTrip} disabled={sharing}>
            {sharing ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.shareText}>{trip.shareCode ? 'Update link' : 'Share'}</Text>}
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.titleInput}
          value={trip.title}
          onChangeText={(v) => update(t => ({ ...t, title: v.slice(0, 80) }))}
          placeholder="Trip name"
          placeholderTextColor="#64748b"
          maxLength={80}
        />
        {!!trip.shareCode && (
          <TouchableOpacity onPress={stopSharing} style={styles.sharedRow}>
            <Text style={styles.sharedText}>🔗 Shared. Anyone with the link sees your latest shared version. </Text>
            <Text style={styles.sharedLink}>Stop sharing</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabs}>
        {trip.days.map((d, i) => (
          <TouchableOpacity key={d.id} style={[styles.tab, i === safeIdx && styles.tabActive]} onPress={() => setDayIdx(i)}>
            <Text style={[styles.tabText, i === safeIdx && styles.tabTextActive]}>Day {i + 1}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.tab} onPress={addDay} accessibilityLabel="Add a day"><Text style={styles.tabText}>＋</Text></TouchableOpacity>
      </ScrollView>

      <ScrollView scrollEnabled={!dragging} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {day.stops.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No stops on Day {safeIdx + 1}</Text>
            <Text style={styles.emptyText}>Add places you want to visit, then drag them into order.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.hint}>Hold ☰ and drag to change the order</Text>
            <DraggableList
              data={day.stops}
              rowHeight={ROW_H}
              renderRow={renderRow}
              onReorder={reorder}
              onDragStateChange={setDragging}
            />
          </>
        )}

        <TouchableOpacity style={styles.addStop} onPress={() => setSearchOpen(true)}>
          <Text style={styles.addStopText}>＋ Add a stop</Text>
        </TouchableOpacity>

        <View style={styles.dayActions}>
          <TouchableOpacity style={[styles.ghost, !day.stops.length && { opacity: 0.4 }]} onPress={viewOnMap} disabled={!day.stops.length}>
            <Text style={styles.ghostText}>View day on map</Text>
          </TouchableOpacity>
          {trip.days.length > 1 && (
            <TouchableOpacity style={styles.ghost} onPress={removeDay}><Text style={styles.ghostText}>Remove day</Text></TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <PlaceSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} onPick={addStop} />

      {/* 編輯景點 */}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {editing && (
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Edit stop</Text>
              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.input} value={editing.name} onChangeText={v => setEditing({ ...editing, name: v })} maxLength={80} />
              <Text style={styles.label}>Time (optional)</Text>
              <TextInput
                style={styles.input}
                value={editing.time}
                onChangeText={v => setEditing({ ...editing, time: v })}
                placeholder="09:30"
                placeholderTextColor="#64748b"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <Text style={styles.label}>Note (optional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={editing.note}
                onChangeText={v => setEditing({ ...editing, note: v })}
                placeholder="Book ahead, meet at exit 3…"
                placeholderTextColor="#64748b"
                multiline
                maxLength={200}
              />
              {!!timeErr && <Text style={styles.err}>{timeErr}</Text>}
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.mBtn, styles.mGhost]} onPress={() => { setEditing(null); setTimeErr(''); }}><Text style={styles.mGhostText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.mBtn, styles.mPrimary]} onPress={saveEdit}><Text style={styles.mPrimaryText}>Save</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 14 },
  primary: { backgroundColor: '#3b82f6', borderRadius: 22, minHeight: 44, paddingHorizontal: 24, justifyContent: 'center' },
  primaryText: { color: 'white', fontWeight: 'bold' },

  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  back: { paddingVertical: 4 },
  backText: { color: '#3b82f6', fontSize: 16 },
  shareBtn: { minHeight: 40, minWidth: 92, paddingHorizontal: 18, borderRadius: 20, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  shareText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  titleInput: { color: 'white', fontSize: 28, fontWeight: 'bold', paddingVertical: 6 },
  sharedRow: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 2 },
  sharedText: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  sharedLink: { color: '#60a5fa', fontSize: 12, lineHeight: 18, fontWeight: '600' },

  tabScroll: { flexGrow: 0 },
  tabs: { paddingHorizontal: 20, gap: 8, paddingVertical: 10 },
  tab: { minHeight: 38, minWidth: 46, paddingHorizontal: 18, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { color: '#94a3b8', fontWeight: '600' },
  tabTextActive: { color: 'white' },

  list: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 4 },
  hint: { color: '#64748b', fontSize: 12, marginBottom: 8 },
  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyTitle: { color: 'white', fontSize: 17, fontWeight: '600', marginBottom: 4 },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },

  row: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 14, marginVertical: 4 },
  rowActive: { backgroundColor: '#1f2f57', borderWidth: 1, borderColor: '#3b82f6' },
  handle: { width: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  handleText: { color: '#94a3b8', fontSize: 22 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  badge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 13 },
  stopName: { color: 'white', fontSize: 16, fontWeight: '600' },
  stopMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  steps: { width: 34, alignSelf: 'stretch', justifyContent: 'center' },
  step: { height: 30, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#94a3b8', fontSize: 12 },
  stepOff: { opacity: 0.25 },
  remove: { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#94a3b8', fontSize: 16 },

  addStop: { marginTop: 14, minHeight: 50, borderRadius: 25, borderWidth: 1.5, borderColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  addStopText: { color: '#3b82f6', fontSize: 16, fontWeight: 'bold' },
  dayActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  ghost: { flex: 1, minHeight: 46, borderRadius: 23, borderWidth: 1.5, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  ghostText: { color: '#cbd5e0', fontWeight: '600', fontSize: 14 },

  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#16213e', borderRadius: 18, padding: 22 },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  label: { color: '#cbd5e0', fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.08)', color: 'white', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  err: { color: '#f87171', fontSize: 13, marginTop: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  mBtn: { flex: 1, minHeight: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  mPrimary: { backgroundColor: '#3b82f6' },
  mPrimaryText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  mGhost: { borderWidth: 1.5, borderColor: '#475569' },
  mGhostText: { color: '#cbd5e0', fontWeight: '600', fontSize: 15 },
});
