/**
 * BusKeypadScreen - 公車路線鍵盤
 *
 * 鍵盤上的鍵全部由 API 的路線清單算出來：
 *   按「綠」再按「5」= 綠5；按 9、0、5 = 905。
 * 接在目前輸入後面不存在的數字會變灰，所以不會輸入出不存在的路線。
 * 選好路線後回到地圖，地圖會開始追蹤這條路線上所有在跑的公車。
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import BusService from '../services/BusService';
import { analyze, backspace, CITY_LABEL } from '../utils/busKeypad';

const DIGIT_ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];
const ROW_HEIGHT = 64;
const MAX_RESULTS = 60;

const Key = memo(function Key({ label, onPress, disabled, wide, accent }) {
  return (
    <TouchableOpacity
      style={[styles.key, wide && styles.keyWide, accent && styles.keyAccent, disabled && styles.keyOff]}
      onPress={() => onPress(label)}
      disabled={disabled}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.keyText, disabled && styles.keyTextOff]}>{label}</Text>
    </TouchableOpacity>
  );
});

const Chip = memo(function Chip({ text, onPress }) {
  return (
    <TouchableOpacity style={styles.chip} onPress={() => onPress(text)} activeOpacity={0.6}>
      <Text style={styles.chipText}>{text}</Text>
    </TouchableOpacity>
  );
});

const ResultRow = memo(function ResultRow({ item, onPick }) {
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPick(item)} activeOpacity={0.7}>
      <View style={styles.rowName}>
        <Text style={styles.rowNameText} numberOfLines={1}>{item.n}</Text>
        <Text style={styles.rowCity}>{CITY_LABEL[item.c] || item.c}</Text>
      </View>
      <Text style={styles.rowPath} numberOfLines={1}>
        {item.f && item.t ? `${item.f} ⇄ ${item.t}` : ''}
      </Text>
    </TouchableOpacity>
  );
});

export default function BusKeypadScreen({ navigation }) {
  const [routes, setRoutes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [input, setInput]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { routes: list } = await BusService.getRoutes();
      setRoutes(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { digits, chunks, matches } = useMemo(() => analyze(routes, input), [routes, input]);

  const exact = useMemo(() => matches.filter(m => m.n === input), [matches, input]);
  const canGo = exact.length === 1;

  const onDigit = useCallback((d) => setInput(prev => prev + d), []);
  const onChunk = useCallback((t) => setInput(prev => prev + t), []);
  const onBack  = useCallback(() => setInput(prev => backspace(prev)), []);
  const onClear = useCallback(() => setInput(''), []);

  const openOnMap = useCallback((route) => {
    const busRoute = { city: route.c, name: route.n, from: route.f, to: route.t, ts: Date.now() };
    const hasMap = navigation.getState().routes.some(r => r.name === 'Map');
    if (hasMap && typeof navigation.popTo === 'function') navigation.popTo('Map', { busRoute });
    else navigation.navigate('Map', { busRoute });
  }, [navigation]);

  const results = useMemo(() => matches.slice(0, MAX_RESULTS), [matches]);

  const renderItem = useCallback(({ item }) => <ResultRow item={item} onPick={openOnMap} />, [openOnMap]);
  const keyExtractor = useCallback((item) => `${item.c}:${item.n}`, []);
  const getItemLayout = useCallback((_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index }), []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Bus route</Text>
        <View style={styles.display}>
          <Text style={[styles.displayText, !input && styles.displayHint]} numberOfLines={1}>
            {input || 'Tap a line color or a number'}
          </Text>
          {input.length > 0 && (
            <Text style={styles.displayCount}>{matches.length} route{matches.length === 1 ? '' : 's'}</Text>
          )}
        </View>
      </View>

      {/* 路線結果 */}
      <View style={styles.list}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color="#3b82f6" /></View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Could not load bus routes</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity style={styles.retry} onPress={load}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No route starts with "{input}"</Text>
            <Text style={styles.emptyText}>Use the backspace key to go back one step.</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={matches.length > MAX_RESULTS
              ? <Text style={styles.more}>+{matches.length - MAX_RESULTS} more. Keep typing to narrow it down.</Text>
              : null}
          />
        )}
      </View>

      {/* 鍵盤 */}
      <View style={styles.pad}>
        {chunks.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipRow}>
            {chunks.map(c => <Chip key={c.text} text={c.text} onPress={onChunk} />)}
          </ScrollView>
        )}

        {DIGIT_ROWS.map((row, i) => (
          <View key={i} style={styles.keyRow}>
            {row.map(d => <Key key={d} label={d} onPress={onDigit} disabled={loading || !digits.has(d)} />)}
          </View>
        ))}
        <View style={styles.keyRow}>
          <Key label="⌫" onPress={onBack} disabled={!input} />
          <Key label="0" onPress={onDigit} disabled={loading || !digits.has('0')} />
          <Key label="Clear" onPress={onClear} disabled={!input} />
        </View>

        <TouchableOpacity
          style={[styles.go, !canGo && styles.goOff]}
          disabled={!canGo}
          onPress={() => openOnMap(exact[0])}
        >
          <Text style={[styles.goText, !canGo && styles.goTextOff]}>
            {canGo
              ? `Show ${input} on the map`
              : exact.length > 1 ? `Pick ${input} from the list` : 'Pick a route'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },

  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10 },
  backButton: { marginBottom: 8, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#3b82f6', fontSize: 16 },
  title: { color: 'white', fontSize: 30, fontWeight: 'bold', marginBottom: 12 },
  display: {
    backgroundColor: '#16213e', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 62,
  },
  displayText: { color: 'white', fontSize: 30, fontWeight: '700', flexShrink: 1 },
  displayHint: { color: '#64748b', fontSize: 16, fontWeight: '400' },
  displayCount: { color: '#94a3b8', fontSize: 13, marginLeft: 10 },

  list: { flex: 1, paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { color: 'white', fontSize: 17, fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  retry: { marginTop: 14, backgroundColor: '#3b82f6', borderRadius: 22, paddingHorizontal: 22, minHeight: 44, justifyContent: 'center' },
  retryText: { color: 'white', fontWeight: 'bold' },
  more: { color: '#64748b', fontSize: 13, textAlign: 'center', paddingVertical: 12 },

  row: { height: ROW_HEIGHT, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  rowName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowNameText: { color: 'white', fontSize: 20, fontWeight: '700' },
  rowCity: {
    color: '#94a3b8', fontSize: 11, backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden',
  },
  rowPath: { color: '#94a3b8', fontSize: 13, marginTop: 2 },

  pad: { backgroundColor: '#12182e', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 26 },
  chipRow: { gap: 8, paddingHorizontal: 4, paddingBottom: 10 },
  chip: { minHeight: 42, minWidth: 52, borderRadius: 21, paddingHorizontal: 16, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  chipText: { color: 'white', fontSize: 18, fontWeight: '700' },

  keyRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  key: { flex: 1, height: 52, borderRadius: 12, backgroundColor: '#243056', alignItems: 'center', justifyContent: 'center' },
  keyWide: { flex: 2 },
  keyAccent: { backgroundColor: '#3b82f6' },
  keyOff: { backgroundColor: '#161d38' },
  keyText: { color: 'white', fontSize: 22, fontWeight: '600' },
  keyTextOff: { color: '#3b4668' },

  go: { marginTop: 2, minHeight: 52, borderRadius: 26, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  goOff: { backgroundColor: '#161d38' },
  goText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  goTextOff: { color: '#64748b', fontWeight: '600' },
});
