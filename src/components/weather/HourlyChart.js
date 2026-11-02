/**
 * HourlyChart - 未來 24 小時圖表（溫度 / 降雨 / 風 / UV 四種）
 * 整張圖只是一個 SVG + 一排文字欄，切換指標才重算，捲動時不會重繪。
 */
import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { describeCode, hhmm, toTemp, windValue } from '../../utils/weather';

const COL = 54;
const H = 104;
const TOP = 22;
const BOTTOM = 8;

const METRICS = {
  temp: { label: 'Temp',  color: '#ffd166' },
  rain: { label: 'Rain',  color: '#6ec1ff' },
  wind: { label: 'Wind',  color: '#9ee6c3' },
  uv:   { label: 'UV',    color: '#ff9f6e' },
};
export const METRIC_KEYS = Object.keys(METRICS);

function valueOf(h, metric, units) {
  switch (metric) {
    case 'temp': return toTemp(h.temp, units.temp);
    case 'rain': return h.precip;
    case 'wind': return windValue(h.wind, units.wind);
    default:     return h.uv ?? 0;
  }
}

function labelOf(v, metric) {
  if (v == null) return '';
  if (metric === 'rain') return v >= 0.1 ? v.toFixed(1) : '';
  return String(Math.round(v));
}

function HourlyChart({ hours, metric, units }) {
  const color = METRICS[metric].color;
  const width = hours.length * COL;

  const { line, area, points, bars } = useMemo(() => {
    const vals = hours.map(h => valueOf(h, metric, units));
    const isLine = metric === 'temp';
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (!isLine) { lo = 0; hi = Math.max(hi, metric === 'rain' ? 2 : metric === 'uv' ? 6 : 10); }
    if (hi - lo < 1) hi = lo + 1;
    const plotH = H - TOP - BOTTOM;
    const y = (v) => TOP + plotH - ((v - lo) / (hi - lo)) * plotH;
    const x = (i) => i * COL + COL / 2;

    const pts = vals.map((v, i) => ({ x: x(i), y: y(v), v }));
    let d = '', a = '';
    if (isLine && pts.length) {
      d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1].x + pts[i].x) / 2;
        d += ` C ${mx} ${pts[i - 1].y}, ${mx} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
      }
      a = `${d} L ${pts[pts.length - 1].x} ${H - BOTTOM} L ${pts[0].x} ${H - BOTTOM} Z`;
    }
    const b = !isLine ? pts.map(p => ({ x: p.x - 13, y: p.y, h: Math.max(H - BOTTOM - p.y, p.v > 0 ? 2 : 0), v: p.v })) : [];
    return { line: d, area: a, points: pts, bars: b };
  }, [hours, metric, units]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ width }}>
      <View>
        <Svg width={width} height={H}>
          <Defs>
            <LinearGradient id="fillg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.35" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {metric === 'temp' ? (
            <>
              <Path d={area} fill="url(#fillg)" />
              <Path d={line} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
              {points.map((p, i) => (
                <React.Fragment key={i}>
                  <Circle cx={p.x} cy={p.y} r="3.5" fill={color} />
                  {i % 2 === 0 && (
                    <SvgText x={p.x} y={p.y - 9} fill="#fff" fontSize="12" fontWeight="600" textAnchor="middle">
                      {labelOf(p.v, metric)}°
                    </SvgText>
                  )}
                </React.Fragment>
              ))}
            </>
          ) : (
            bars.map((b, i) => (
              <React.Fragment key={i}>
                <Rect x={b.x} y={b.y} width="26" height={b.h} rx="5" fill={color} opacity="0.85" />
                {labelOf(b.v, metric) !== '' && (
                  <SvgText x={b.x + 13} y={b.y - 5} fill="#fff" fontSize="11" fontWeight="600" textAnchor="middle">
                    {labelOf(b.v, metric)}
                  </SvgText>
                )}
              </React.Fragment>
            ))
          )}
        </Svg>

        <View style={styles.row}>
          {hours.map((h, i) => (
            <View key={h.time} style={styles.col}>
              <Text style={styles.time}>{i === 0 ? 'Now' : hhmm(h.time)}</Text>
              <Text style={styles.icon}>{describeCode(h.code, h.isDay).icon}</Text>
              <Text style={styles.pop}>{h.pop != null && h.pop >= 10 ? `${h.pop}%` : ' '}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: 4 },
  col: { width: COL, alignItems: 'center' },
  time: { color: '#dbe6f2', fontSize: 12 },
  icon: { fontSize: 20, marginVertical: 3 },
  pop: { color: '#8fd0ff', fontSize: 11, fontWeight: '600' },
});

export default memo(HourlyChart);
