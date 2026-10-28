/**
 * MeetupsScreen - 組隊列表
 *
 * 兩個分頁：
 * - Discover：已核准、還沒開始的組隊，點「Join」就是 +1
 * - My meetups：我發起的（含審核中 / 被拒絕）和我加入的
 *
 * 路由參數（選填）：
 * - tab:     'discover' | 'mine'
 * - focusId: 展開指定的組隊（從地圖點 👥 圖釘進來時使用）
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import MeetupService from '../services/MeetupService';
import { getDisplayName, setDisplayName } from '../services/DeviceService';
import { notify, confirmAction } from '../utils/notify';

const STATUS_STYLE = {
  pending:   { label: 'Waiting for review', bg: 'rgba(250, 173, 20, 0.18)', fg: '#fbbf24' },
  approved:  { label: 'Approved',           bg: 'rgba(16, 185, 129, 0.18)', fg: '#34d399' },
  rejected:  { label: 'Not approved',       bg: 'rgba(239, 68, 68, 0.18)',  fg: '#f87171' },
  cancelled: { label: 'Cancelled',          bg: 'rgba(148, 163, 184, 0.18)', fg: '#94a3b8' },
};

function formatWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function MeetupsScreen({ navigation, route }) {
  const [tab, setTab]               = useState(route?.params?.tab || 'discover');
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [expandedId, setExpandedId] = useState(route?.params?.focusId || null);
  const [members, setMembers]       = useState({});   // meetupId -> [{display_name}]
  const [busyId, setBusyId]         = useState(null);

  // 第一次 +1 時問暱稱
  const [namePromptFor, setNamePromptFor] = useState(null);
  const [nameInput, setNameInput]         = useState('');

  // 從別的畫面帶參數進來時同步
  useEffect(() => {
    if (route?.params?.tab) setTab(route.params.tab);
    if (route?.params?.focusId) {
      setTab('discover');
      setExpandedId(route.params.focusId);
    }
  }, [route?.params?.tab, route?.params?.focusId]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = tab === 'mine' ? await MeetupService.mine() : await MeetupService.list();
      setItems(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  // 每次回到這個畫面或切換分頁都重新讀取
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loadMembers = async (id) => {
    try {
      const detail = await MeetupService.get(id);
      setMembers(prev => ({ ...prev, [id]: detail.members || [] }));
    } catch (_) { /* 名單讀不到就不顯示 */ }
  };

  // 展開的卡片（含從地圖帶進來的）讀取參加者
  useEffect(() => {
    if (expandedId) loadMembers(expandedId);
  }, [expandedId]);

  const toggleExpand = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  // ── +1 ──────────────────────────────────────────────
  const startJoin = async (m) => {
    const saved = await getDisplayName();
    if (!saved) {
      setNameInput('');
      setNamePromptFor(m);
      return;
    }
    doJoin(m, saved);
  };

  const doJoin = async (m, name) => {
    setBusyId(m.id);
    try {
      await MeetupService.join(m.id, name);
      await load(true);
      if (expandedId === m.id) loadMembers(m.id);
    } catch (e) {
      notify('Could not join', e.message);
      load(true);
    } finally {
      setBusyId(null);
    }
  };

  const submitName = async () => {
    const name = nameInput.trim();
    if (!name || !namePromptFor) return;
    await setDisplayName(name);
    const target = namePromptFor;
    setNamePromptFor(null);
    doJoin(target, name);
  };

  // ── 退出 / 取消 ─────────────────────────────────────
  const leave = async (m) => {
    const ok = await confirmAction('Leave this meetup?', `You'll give up your spot in "${m.title}".`, 'Leave');
    if (!ok) return;
    setBusyId(m.id);
    try {
      await MeetupService.leave(m.id);
      await load(true);
      if (expandedId === m.id) loadMembers(m.id);
    } catch (e) {
      notify('Could not leave', e.message);
    } finally {
      setBusyId(null);
    }
  };

  const cancelMeetup = async (m) => {
    const ok = await confirmAction(
      m.status === 'pending' ? 'Withdraw this request?' : 'Cancel this meetup?',
      m.status === 'pending'
        ? `"${m.title}" won't be reviewed.`
        : `"${m.title}" will be closed and people who joined will no longer see it.`,
      m.status === 'pending' ? 'Withdraw' : 'Cancel meetup'
    );
    if (!ok) return;
    setBusyId(m.id);
    try {
      await MeetupService.cancel(m.id);
      await load(true);
    } catch (e) {
      notify('Could not cancel', e.message);
    } finally {
      setBusyId(null);
    }
  };

  const viewOnMap = (m) => {
    const focus = { lat: m.lat, lng: m.lng, ts: Date.now() };
    const hasMap = navigation.getState().routes.some(r => r.name === 'Map');
    if (hasMap && typeof navigation.popTo === 'function') {
      navigation.popTo('Map', { focus });
    } else {
      navigation.navigate('Map', { focus });
    }
  };

  // ── 卡片 ────────────────────────────────────────────
  const renderAction = (m) => {
    const busy = busyId === m.id;
    const spinner = <ActivityIndicator size="small" color="white" />;

    if (m.status === 'pending' && m.is_host) {
      return (
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => cancelMeetup(m)} disabled={busy}>
          {busy ? spinner : <Text style={styles.btnGhostText}>Withdraw request</Text>}
        </TouchableOpacity>
      );
    }
    if (m.status !== 'approved') return null;

    if (m.is_host) {
      return (
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => cancelMeetup(m)} disabled={busy}>
          {busy ? spinner : <Text style={styles.btnGhostText}>Cancel meetup</Text>}
        </TouchableOpacity>
      );
    }
    if (m.joined) {
      return (
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => leave(m)} disabled={busy}>
          {busy ? spinner : <Text style={styles.btnGhostText}>Joined · Leave</Text>}
        </TouchableOpacity>
      );
    }
    if (m.member_count >= m.max_people) {
      return (
        <View style={[styles.btn, styles.btnDisabled]}>
          <Text style={styles.btnDisabledText}>Full</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => startJoin(m)} disabled={busy}>
        {busy ? spinner : <Text style={styles.btnPrimaryText}>Join (+1)</Text>}
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item: m }) => {
    const expanded = expandedId === m.id;
    const status = STATUS_STYLE[m.status] || STATUS_STYLE.pending;
    const fill = Math.min(m.member_count / m.max_people, 1);
    const names = members[m.id];

    return (
      <View style={styles.card}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => toggleExpand(m.id)}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle} numberOfLines={expanded ? undefined : 2}>{m.title}</Text>
            {(tab === 'mine' || m.status !== 'approved') && (
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.fg }]}>{status.label}</Text>
              </View>
            )}
          </View>

          <Text style={styles.meta}>⏰ {formatWhen(m.starts_at)}</Text>
          {!!m.location && <Text style={styles.meta} numberOfLines={expanded ? undefined : 1}>📍 {m.location}</Text>}
          <Text style={styles.meta}>Hosted by {m.host_name}{m.is_host ? ' (you)' : ''}</Text>

          <View style={styles.countRow}>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${fill * 100}%` }, fill >= 1 && styles.barFull]} />
            </View>
            <Text style={styles.countText}>{m.member_count} of {m.max_people} going</Text>
          </View>

          {m.status === 'rejected' && !!m.reject_reason && (
            <Text style={styles.rejectReason}>Reason: {m.reject_reason}</Text>
          )}
        </TouchableOpacity>

        {expanded && (
          <View style={styles.detail}>
            {!!m.description && <Text style={styles.description}>{m.description}</Text>}

            {m.tags?.length > 0 && (
              <View style={styles.tags}>
                {m.tags.map(t => (
                  <View key={t} style={styles.tag}><Text style={styles.tagText}>#{t}</Text></View>
                ))}
              </View>
            )}

            {names && names.length > 0 && (
              <Text style={styles.going}>
                Going: {names.map((n, i) => (i === 0 ? `${n.display_name} (host)` : n.display_name)).join(', ')}
              </Text>
            )}

            <TouchableOpacity onPress={() => viewOnMap(m)} style={styles.mapLink}>
              <Text style={styles.mapLinkText}>View on map</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionRow}>{renderAction(m)}</View>
      </View>
    );
  };

  const empty = () => {
    if (loading) return null;
    if (error) {
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Could not load meetups</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary, { marginTop: 14 }]} onPress={() => load()}>
            <Text style={styles.btnPrimaryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>
          {tab === 'mine' ? 'Nothing here yet' : 'No meetups coming up'}
        </Text>
        <Text style={styles.emptyText}>
          {tab === 'mine'
            ? "Meetups you host or join will show up here."
            : 'Host one and others can join once it is approved.'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meetups</Text>

        <View style={styles.tabs}>
          {[['discover', 'Discover'], ['mine', 'My meetups']].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator color="#3b82f6" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={m => m.id}
          renderItem={renderItem}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor="#94a3b8"
            />
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateMeetup')}>
        <Text style={styles.fabText}>＋ Host a meetup</Text>
      </TouchableOpacity>

      {/* 第一次 +1 要填暱稱 */}
      <Modal visible={!!namePromptFor} transparent animationType="fade" onRequestClose={() => setNamePromptFor(null)}>
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>What should we call you?</Text>
            <Text style={styles.modalText}>The host and other people in the group will see this name.</Text>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your name"
              placeholderTextColor="#64748b"
              maxLength={30}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost, { flex: 1 }]} onPress={() => setNamePromptFor(null)}>
                <Text style={styles.btnGhostText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { flex: 1 }, !nameInput.trim() && { opacity: 0.5 }]}
                onPress={submitName}
                disabled={!nameInput.trim()}
              >
                <Text style={styles.btnPrimaryText}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },

  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  backButton: { marginBottom: 12, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#3b82f6', fontSize: 16 },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginBottom: 16 },

  tabs: { flexDirection: 'row', gap: 10 },
  tabBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabBtnActive: { backgroundColor: '#3b82f6' },
  tabText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: 'white' },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 },

  card: { backgroundColor: '#16213e', borderRadius: 15, padding: 16, marginBottom: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  cardTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  meta: { color: '#94a3b8', fontSize: 14, marginBottom: 4 },

  countRow: { marginTop: 10 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: '#3b82f6' },
  barFull: { backgroundColor: '#10b981' },
  countText: { color: '#cbd5e0', fontSize: 13, marginTop: 6 },

  rejectReason: { color: '#f87171', fontSize: 13, marginTop: 8 },

  detail: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' },
  description: { color: '#cbd5e0', fontSize: 14, lineHeight: 21, marginBottom: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag: { backgroundColor: 'rgba(59, 130, 246, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { color: '#60a5fa', fontSize: 12 },
  going: { color: '#cbd5e0', fontSize: 13, lineHeight: 19, marginBottom: 6 },
  mapLink: { alignSelf: 'flex-start', paddingVertical: 8 },
  mapLinkText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },

  actionRow: { marginTop: 12 },
  btn: { minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnPrimary: { backgroundColor: '#3b82f6' },
  btnPrimaryText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  btnGhost: { borderWidth: 1.5, borderColor: '#475569' },
  btnGhostText: { color: '#cbd5e0', fontSize: 15, fontWeight: '600' },
  btnDisabled: { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  btnDisabledText: { color: '#64748b', fontSize: 15, fontWeight: '600' },

  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyTitle: { color: 'white', fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  fab: {
    position: 'absolute', bottom: 30, alignSelf: 'center',
    backgroundColor: '#3b82f6', paddingHorizontal: 26, paddingVertical: 15, borderRadius: 30,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 5,
  },
  fabText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  modalWrap: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#16213e', borderRadius: 18, padding: 22 },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  modalText: { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)', color: 'white', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
