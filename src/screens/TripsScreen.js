/**
 * TripsScreen - 我的行程列表
 * 新增行程、開啟、刪除；也可以貼上別人分享的連結或代碼來查看。
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import TripService, { parseShareCode } from '../services/TripService';
import { notify, confirmAction } from '../utils/notify';

export default function TripsScreen({ navigation }) {
  const [trips, setTrips]     = useState([]);
  const [loaded, setLoaded]   = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle]     = useState('');
  const [code, setCode]       = useState('');

  const load = useCallback(async () => {
    setTrips(await TripService.list());
    setLoaded(true);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const createTrip = async () => {
    const trip = await TripService.create(title);
    setCreating(false);
    setTitle('');
    navigation.navigate('TripEditor', { tripId: trip.id });
  };

  const removeTrip = async (t) => {
    const ok = await confirmAction(
      'Delete this trip?',
      t.shareCode ? `"${t.title}" will be deleted from this phone. Its share link keeps working until you stop sharing it inside the trip.` : `"${t.title}" will be deleted.`,
      'Delete'
    );
    if (!ok) return;
    await TripService.remove(t.id);
    load();
  };

  const openCode = () => {
    const c = parseShareCode(code);
    if (!c) { notify('That does not look like a trip link', 'Paste the full link or the 8-character code.'); return; }
    setCode('');
    navigation.navigate('TripViewer', { code: c });
  };

  const stopCount = (t) => t.days.reduce((n, d) => n + d.stops.length, 0);

  const renderItem = ({ item: t }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => navigation.navigate('TripEditor', { tripId: t.id })}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>{t.title}</Text>
        <Text style={styles.meta}>
          {t.days.length} day{t.days.length === 1 ? '' : 's'} · {stopCount(t)} stop{stopCount(t) === 1 ? '' : 's'}
          {t.shareCode ? '  ·  🔗 Shared' : ''}
        </Text>
      </View>
      <TouchableOpacity style={styles.del} onPress={() => removeTrip(t)} accessibilityLabel={`Delete ${t.title}`}>
        <Text style={styles.delText}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>My trips</Text>
      </View>

      <FlatList
        data={trips}
        keyExtractor={t => t.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={loaded ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptyText}>Plan your days, drag stops into the order you want, and share the plan with friends.</Text>
          </View>
        ) : null}
        ListFooterComponent={
          <View style={styles.codeBox}>
            <Text style={styles.codeTitle}>Got a link from a friend?</Text>
            <View style={styles.codeRow}>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={setCode}
                placeholder="Paste the link or code"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={openCode}
              />
              <TouchableOpacity style={styles.codeBtn} onPress={openCode}><Text style={styles.codeBtnText}>Open</Text></TouchableOpacity>
            </View>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setCreating(true)}>
        <Text style={styles.fabText}>＋ New trip</Text>
      </TouchableOpacity>

      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Name your trip</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Weekend in Taipei"
              placeholderTextColor="#64748b"
              maxLength={80}
              autoFocus
              onSubmitEditing={createTrip}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setCreating(false)}><Text style={styles.btnGhostText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={createTrip}><Text style={styles.btnPrimaryText}>Create</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10 },
  back: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 10 },
  backText: { color: '#3b82f6', fontSize: 16 },
  title: { color: 'white', fontSize: 32, fontWeight: 'bold' },

  list: { paddingHorizontal: 20, paddingBottom: 110, paddingTop: 8 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 15, paddingLeft: 16, marginBottom: 12, minHeight: 74 },
  cardTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  meta: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  del: { width: 52, height: 74, alignItems: 'center', justifyContent: 'center' },
  delText: { color: '#94a3b8', fontSize: 18 },

  empty: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 24 },
  emptyTitle: { color: 'white', fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  codeBox: { marginTop: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, padding: 14 },
  codeTitle: { color: '#cbd5e0', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  codeRow: { flexDirection: 'row', gap: 8 },
  codeInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', color: 'white', borderRadius: 12, paddingHorizontal: 14, minHeight: 46, fontSize: 15 },
  codeBtn: { minHeight: 46, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  codeBtnText: { color: 'white', fontWeight: 'bold' },

  fab: { position: 'absolute', bottom: 30, alignSelf: 'center', backgroundColor: '#3b82f6', paddingHorizontal: 28, paddingVertical: 15, borderRadius: 30, elevation: 6 },
  fabText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#16213e', borderRadius: 18, padding: 22 },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 14 },
  input: { backgroundColor: 'rgba(255,255,255,0.08)', color: 'white', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  btn: { flex: 1, minHeight: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#3b82f6' },
  btnPrimaryText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  btnGhost: { borderWidth: 1.5, borderColor: '#475569' },
  btnGhostText: { color: '#cbd5e0', fontWeight: '600', fontSize: 15 },
});
