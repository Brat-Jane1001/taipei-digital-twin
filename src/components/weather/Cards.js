/**
 * Cards - 天氣畫面的各個資訊區塊（全部 memo，資料沒變就不重畫）
 */
import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  describeCode, fmtTemp, fmtWind, compass, uvLevel, aqiLevel, AQI_BANDS,
} from '../../utils/weather';

// ───────── 共用外框 ─────────
export const Card = memo(function Card({ title, icon, children, style }) {
  return (
    <View style={[styles.card, style]}>
      {!!title && <Text style={styles.cardTitle}>{icon ? `${icon}  ` : ''}{title}</Text>}
      {children}
    </View>
  );
});

// ───────── 提醒（由預報數值推算，不是官方警報）─────────
const LEVEL_BG = { low: 'rgba(110,193,255,0.22)', mid: 'rgba(255,209,102,0.24)', high: 'rgba(255,107,107,0.28)' };

export const NoticeList = memo(function NoticeList({ notices }) {
  if (!notices.length) return null;
  return (
    <View style={styles.notices}>
      {notices.map(n => (
        <View key={n.id} style={[styles.notice, { backgroundColor: LEVEL_BG[n.level] }]}>
          <Text style={styles.noticeIcon}>{n.icon}</Text>
          <Text style={styles.noticeText}>{n.text}</Text>
        </View>
      ))}
      <Text style={styles.disclaimer}>Based on forecast numbers, not an official warning. Check the Central Weather Administration for official alerts.</Text>
    </View>
  );
});

// ───────── 降雨 ─────────
export const RainCard = memo(function RainCard({ summary, next }) {
  const max = Math.max(1, ...next);
  return (
    <Card title="Rain" icon="☔">
      <Text style={styles.big}>{summary}</Text>
      {next.length > 0 && (
        <>
          <View style={styles.rainBars}>
            {next.map((v, i) => (
              <View key={i} style={styles.rainCol}>
                <View style={[styles.rainBar, { height: Math.max(3, (v / max) * 40), opacity: v > 0 ? 1 : 0.3 }]} />
              </View>
            ))}
          </View>
          <View style={styles.rainAxis}>
            <Text style={styles.small}>Now</Text>
            <Text style={styles.small}>+1h</Text>
            <Text style={styles.small}>+2h</Text>
          </View>
        </>
      )}
    </Card>
  );
});

// ───────── 逐日 ─────────
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dayLabel(iso, i) {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  const [y, m, d] = iso.split('-').map(Number);
  return `${WEEKDAY[new Date(y, m - 1, d).getDay()]} ${m}/${d}`;
}

export const DailyList = memo(function DailyList({ days, units, currentTemp }) {
  const { lo, hi } = useMemo(() => ({
    lo: Math.min(...days.map(d => d.min)),
    hi: Math.max(...days.map(d => d.max)),
  }), [days]);
  const span = Math.max(hi - lo, 1);

  return (
    <Card title={`${days.length}-day forecast`} icon="📅">
      {days.map((d, i) => {
        const left = ((d.min - lo) / span) * 100;
        const width = Math.max(((d.max - d.min) / span) * 100, 6);
        const dot = i === 0 && currentTemp != null ? Math.min(Math.max(((currentTemp - d.min) / Math.max(d.max - d.min, 1)) * 100, 0), 100) : null;
        return (
          <View key={d.date} style={styles.dayRow}>
            <Text style={styles.dayName}>{dayLabel(d.date, i)}</Text>
            <Text style={styles.dayIcon}>{describeCode(d.code, true).icon}</Text>
            <Text style={styles.dayPop}>{d.pop != null && d.pop >= 10 ? `${d.pop}%` : ''}</Text>
            <Text style={styles.dayMin}>{fmtTemp(d.min, units.temp)}</Text>
            <View style={styles.track}>
              <View style={[styles.range, { left: `${left}%`, width: `${width}%` }]}>
                {dot != null && <View style={[styles.nowDot, { left: `${dot}%` }]} />}
              </View>
            </View>
            <Text style={styles.dayMax}>{fmtTemp(d.max, units.temp)}</Text>
          </View>
        );
      })}
    </Card>
  );
});

// ───────── 細節格 ─────────
function Tile({ icon, label, value, sub, color }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{icon}  {label}</Text>
      <Text style={[styles.tileValue, color && { color }]}>{value}</Text>
      {!!sub && <Text style={styles.small}>{sub}</Text>}
    </View>
  );
}

export const DetailGrid = memo(function DetailGrid({ current, units }) {
  const uv = uvLevel(current.uv);
  return (
    <View style={styles.grid}>
      <Tile icon="🌡️" label="Feels like" value={fmtTemp(current.feels, units.temp, true)} />
      <Tile icon="💧" label="Humidity" value={`${Math.round(current.humidity)}%`} sub={`Dew point ${fmtTemp(current.dew, units.temp)}`} />
      <Tile icon="🧭" label="Wind" value={fmtWind(current.wind, units.wind)} sub={`From ${compass(current.windDir)} · gusts ${fmtWind(current.gust, units.wind)}`} />
      <Tile icon="🕶️" label="UV index" value={current.uv != null ? String(Math.round(current.uv)) : '–'} sub={uv.label} color={uv.color} />
      <Tile icon="🌀" label="Pressure" value={`${Math.round(current.pressure)} hPa`} />
      <Tile icon="👁️" label="Visibility" value={current.visibility != null ? `${(current.visibility / 1000).toFixed(current.visibility >= 10000 ? 0 : 1)} km` : '–'} />
      <Tile icon="☁️" label="Cloud cover" value={`${Math.round(current.cloud)}%`} />
      <Tile icon="🌧️" label="Precipitation" value={`${(current.precip ?? 0).toFixed(1)} mm`} sub="last hour" />
    </View>
  );
});

// ───────── 空氣品質 ─────────
const POLLUTANTS = [['PM2.5', 'pm25'], ['PM10', 'pm10'], ['O₃', 'o3'], ['NO₂', 'no2'], ['SO₂', 'so2'], ['CO', 'co']];

export const AirCard = memo(function AirCard({ air }) {
  if (!air || air.aqi == null) {
    return <Card title="Air quality" icon="😷"><Text style={styles.small}>Air quality data is not available for this location.</Text></Card>;
  }
  const lvl = aqiLevel(air.aqi);
  const pos = Math.min(air.aqi / 300, 1) * 100;
  return (
    <Card title="Air quality" icon="😷">
      <View style={styles.aqiTop}>
        <Text style={[styles.aqiNum, { color: lvl.color }]}>{Math.round(air.aqi)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.big}>{lvl.label}</Text>
          <Text style={styles.small}>US AQI</Text>
        </View>
      </View>

      <View style={styles.scale}>
        {AQI_BANDS.slice(0, 5).map((b, i) => (
          <View key={b.label} style={{ flex: i === 4 ? 2 : 1, backgroundColor: b.color, height: 8 }} />
        ))}
        <View style={[styles.marker, { left: `${pos}%` }]} />
      </View>

      <View style={styles.pollGrid}>
        {POLLUTANTS.map(([name, key]) => (
          <View key={key} style={styles.poll}>
            <Text style={styles.small}>{name}</Text>
            <Text style={styles.pollVal}>{air[key] != null ? Math.round(air[key]) : '–'}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.small}>µg/m³</Text>

      {air.hourly.length > 0 && (
        <View style={styles.airBars}>
          {air.hourly.map(h => (
            <View key={h.time} style={[styles.airBar, { height: 6 + Math.min((h.aqi ?? 0) / 150, 1) * 26, backgroundColor: aqiLevel(h.aqi).color }]} />
          ))}
        </View>
      )}
      <Text style={styles.small}>Next 24 hours</Text>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: 16, marginBottom: 14 },
  cardTitle: { color: '#dbe6f2', fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 12 },
  big: { color: '#fff', fontSize: 18, fontWeight: '600' },
  small: { color: '#cfdbe8', fontSize: 12 },

  notices: { marginBottom: 14, gap: 8 },
  notice: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
  noticeIcon: { fontSize: 20 },
  noticeText: { color: '#fff', fontSize: 14, flex: 1, lineHeight: 19 },
  disclaimer: { color: '#bccbdb', fontSize: 11, lineHeight: 15, paddingHorizontal: 4 },

  rainBars: { flexDirection: 'row', alignItems: 'flex-end', height: 44, marginTop: 14, gap: 4 },
  rainCol: { flex: 1, justifyContent: 'flex-end' },
  rainBar: { backgroundColor: '#6ec1ff', borderRadius: 4 },
  rainAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },

  dayRow: { flexDirection: 'row', alignItems: 'center', height: 44 },
  dayName: { width: 78, color: '#fff', fontSize: 14, fontWeight: '600' },
  dayIcon: { width: 28, fontSize: 18 },
  dayPop: { width: 36, color: '#8fd0ff', fontSize: 11, fontWeight: '600' },
  dayMin: { width: 34, color: '#cfdbe8', fontSize: 14, textAlign: 'right' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 8, overflow: 'hidden' },
  range: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3, backgroundColor: '#ffd166' },
  nowDot: { position: 'absolute', top: -1, width: 8, height: 8, marginLeft: -4, borderRadius: 4, backgroundColor: '#fff' },
  dayMax: { width: 34, color: '#fff', fontSize: 14, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48.5%', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: 14, marginBottom: 14, minHeight: 96 },
  tileLabel: { color: '#dbe6f2', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  tileValue: { color: '#fff', fontSize: 24, fontWeight: '600', marginBottom: 2 },

  aqiTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  aqiNum: { fontSize: 48, fontWeight: '300', minWidth: 76 },
  scale: { flexDirection: 'row', borderRadius: 4, overflow: 'visible', marginBottom: 16 },
  marker: { position: 'absolute', top: -4, width: 4, height: 16, marginLeft: -2, borderRadius: 2, backgroundColor: '#fff' },
  pollGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  poll: { width: '33.33%', marginBottom: 10 },
  pollVal: { color: '#fff', fontSize: 17, fontWeight: '600' },
  airBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 34, marginTop: 14, marginBottom: 4 },
  airBar: { flex: 1, borderRadius: 2 },
});
