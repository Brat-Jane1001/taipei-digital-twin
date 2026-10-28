/**
 * CreateMeetupScreen - 發起組隊
 *
 * 送出後狀態是「等待審核」，管理員核准後才會出現在大家的列表和地圖上。
 * 日期 / 時間用選項按鈕，不需要額外安裝日期選擇套件。
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';

import MeetupService from '../services/MeetupService';
import EventService from '../services/EventService';
import { getDisplayName, setDisplayName } from '../services/DeviceService';
import { notify } from '../utils/notify';

const TAG_OPTIONS = ['food', 'culture', 'music', 'art', 'nightlife', 'sports', 'history'];
const MAX_TAGS = 3;
const MIN_LEAD_MS = 30 * 60 * 1000;   // 開始時間至少 30 分鐘後（後端也會檢查）

const TIME_SLOTS = (() => {
  const out = [];
  for (let h = 8; h <= 23; h++) {
    for (const m of [0, 30]) out.push({ h, m, label: `${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}` });
  }
  return out;
})();

function buildDays() {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    days.push({ date: d, label });
  }
  return days;
}

const Chip = ({ label, active, disabled, onPress }) => (
  <TouchableOpacity
    style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive, disabled && styles.chipTextDisabled]}>{label}</Text>
  </TouchableOpacity>
);

export default function CreateMeetupScreen({ navigation }) {
  const days = useMemo(buildDays, []);

  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [hostName, setHostName]       = useState('');
  const [placeName, setPlaceName]     = useState('');
  const [coords, setCoords]           = useState(null);   // { lat, lng }
  const [coordsFrom, setCoordsFrom]   = useState('');     // 'spot' | 'gps'
  const [spots, setSpots]             = useState([]);
  const [locating, setLocating]       = useState(false);
  const [tags, setTags]               = useState([]);
  const [dayIdx, setDayIdx]           = useState(0);
  const [slot, setSlot]               = useState(null);   // TIME_SLOTS 的其中一個
  const [maxPeople, setMaxPeople]     = useState(6);
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    getDisplayName().then(n => { if (n) setHostName(n); });
    EventService.getAllEvents().then(setSpots).catch(() => {});
  }, []);

  const startsAt = useMemo(() => {
    if (!slot) return null;
    const d = days[dayIdx].date;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), slot.h, slot.m);
  }, [slot, dayIdx, days]);

  const slotIsPast = (s) => {
    const d = days[dayIdx].date;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), s.h, s.m).getTime() < Date.now() + MIN_LEAD_MS;
  };

  // 換日期後，原本選的時間如果已經過了就清掉
  useEffect(() => {
    if (slot && slotIsPast(slot)) setSlot(null);
  }, [dayIdx]);

  const toggleTag = (t) => {
    setTags(prev => prev.includes(t)
      ? prev.filter(x => x !== t)
      : prev.length >= MAX_TAGS ? prev : [...prev, t]);
  };

  const pickSpot = (ev) => {
    setCoords({ lat: ev.lat, lng: ev.lng });
    setCoordsFrom('spot');
    setPlaceName(ev.location || ev.title || '');
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        notify('Location is off', 'Allow location access, or pick one of the spots below.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setCoordsFrom('gps');
    } catch (e) {
      notify('Could not get your location', 'Try again, or pick one of the spots below.');
    } finally {
      setLocating(false);
    }
  };

  const validate = () => {
    if (title.trim().length < 3) return 'Give your meetup a title (at least 3 characters).';
    if (!hostName.trim())        return 'Add your name so people know who is hosting.';
    if (!coords)                 return 'Choose where to meet: use your location or pick a spot.';
    if (!placeName.trim())       return 'Describe the meeting point, for example "Exit 3 of Ximen station".';
    if (!startsAt)               return 'Choose a day and a start time.';
    if (startsAt.getTime() < Date.now() + MIN_LEAD_MS) return 'Pick a start time at least 30 minutes from now.';
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) { notify('Almost there', problem); return; }

    setSubmitting(true);
    try {
      await setDisplayName(hostName);
      await MeetupService.create({
        title: title.trim(),
        description: description.trim(),
        host_name: hostName.trim(),
        location: placeName.trim(),
        lat: coords.lat,
        lng: coords.lng,
        starts_at: startsAt.toISOString(),
        max_people: maxPeople,
        tags,
      });
      notify('Sent for review', 'You can follow its status under My meetups. Once it is approved, others can join.');
      if (typeof navigation.popTo === 'function') navigation.popTo('Meetups', { tab: 'mine' });
      else navigation.goBack();
    } catch (e) {
      notify('Could not send your meetup', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Host a meetup</Text>
        <Text style={styles.lead}>We review every meetup before it goes live. After that, anyone can join until it is full.</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Night market food crawl"
          placeholderTextColor="#64748b"
          maxLength={80}
        />

        <Text style={styles.label}>Details (optional)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="What will you do, what should people bring, how will they find you?"
          placeholderTextColor="#64748b"
          multiline
          maxLength={1000}
        />

        <Text style={styles.label}>Where to meet</Text>
        <TouchableOpacity style={[styles.btnOutline, locating && { opacity: 0.6 }]} onPress={useMyLocation} disabled={locating}>
          {locating ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text style={styles.btnOutlineText}>Use my current location</Text>}
        </TouchableOpacity>

        {spots.length > 0 && (
          <>
            <Text style={styles.sub}>or pick a spot</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {spots.map(ev => (
                <Chip
                  key={ev.id}
                  label={ev.title}
                  active={coordsFrom === 'spot' && coords?.lat === ev.lat && coords?.lng === ev.lng}
                  onPress={() => pickSpot(ev)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {coords && (
          <Text style={styles.okLine}>
            {coordsFrom === 'gps' ? 'Using your current location.' : 'Spot selected.'} Name the meeting point:
          </Text>
        )}
        <TextInput
          style={styles.input}
          value={placeName}
          onChangeText={setPlaceName}
          placeholder="Exit 3 of Ximen station"
          placeholderTextColor="#64748b"
          maxLength={120}
        />

        <Text style={styles.label}>Day</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {days.map((d, i) => (
            <Chip key={d.label} label={d.label} active={dayIdx === i} onPress={() => setDayIdx(i)} />
          ))}
        </ScrollView>

        <Text style={styles.label}>Start time</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {TIME_SLOTS.map(s => (
            <Chip
              key={s.label}
              label={s.label}
              active={slot?.label === s.label}
              disabled={slotIsPast(s)}
              onPress={() => setSlot(s)}
            />
          ))}
        </ScrollView>

        <Text style={styles.label}>Group size (including you)</Text>
        <View style={styles.stepper}>
          <TouchableOpacity style={styles.stepBtn} onPress={() => setMaxPeople(n => Math.max(2, n - 1))}>
            <Text style={styles.stepText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepValue}>{maxPeople}</Text>
          <TouchableOpacity style={styles.stepBtn} onPress={() => setMaxPeople(n => Math.min(20, n + 1))}>
            <Text style={styles.stepText}>＋</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Topics (up to {MAX_TAGS})</Text>
        <View style={styles.chipWrap}>
          {TAG_OPTIONS.map(t => (
            <Chip key={t} label={`#${t}`} active={tags.includes(t)} onPress={() => toggleTag(t)} />
          ))}
        </View>

        <Text style={styles.label}>Your name</Text>
        <TextInput
          style={styles.input}
          value={hostName}
          onChangeText={setHostName}
          placeholder="Shown to people who join"
          placeholderTextColor="#64748b"
          maxLength={30}
        />

        <TouchableOpacity style={[styles.submit, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.submitText}>Send for review</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  scroll: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 50 },

  backButton: { marginBottom: 12, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#3b82f6', fontSize: 16 },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  lead: { color: '#94a3b8', fontSize: 14, lineHeight: 21, marginBottom: 8 },

  label: { color: 'white', fontSize: 15, fontWeight: '600', marginTop: 22, marginBottom: 8 },
  sub: { color: '#94a3b8', fontSize: 13, marginTop: 12, marginBottom: 8 },
  okLine: { color: '#34d399', fontSize: 13, marginTop: 12, marginBottom: 8 },

  input: {
    backgroundColor: '#16213e', color: 'white', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
  },
  textarea: { minHeight: 100, textAlignVertical: 'top' },

  btnOutline: {
    minHeight: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  btnOutlineText: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },

  chipRow: { gap: 8, paddingRight: 20 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  chipActive: { backgroundColor: '#3b82f6' },
  chipDisabled: { opacity: 0.3 },
  chipText: { color: '#cbd5e0', fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: 'white' },
  chipTextDisabled: { color: '#64748b' },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stepBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepText: { color: 'white', fontSize: 22, fontWeight: '600' },
  stepValue: { color: 'white', fontSize: 24, fontWeight: 'bold', minWidth: 36, textAlign: 'center' },

  submit: {
    marginTop: 32, minHeight: 54, borderRadius: 27, backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
});
