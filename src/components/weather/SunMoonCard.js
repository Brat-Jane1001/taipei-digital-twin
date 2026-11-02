/**
 * SunMoonCard - 日出日落弧線與月相
 */
import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { moonPhase, sunProgress, daylight, hhmm } from '../../utils/weather';

const W = 260, CX = 130, CY = 100, R = 100;

function SunMoonCard({ day, localNow }) {
  const { p, x, y, up, moon, len } = useMemo(() => {
    const prog = sunProgress(localNow, day.sunrise, day.sunset);
    const c = Math.min(Math.max(prog, 0), 1);
    return {
      p: prog,
      x: CX - R * Math.cos(Math.PI * c),
      y: CY - R * Math.sin(Math.PI * c),
      up: prog >= 0 && prog <= 1,
      moon: moonPhase(new Date()),
      len: daylight(day.sunrise, day.sunset),
    };
  }, [day, localNow]);

  const arc = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  const doneArc = up ? `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${x} ${y}` : null;

  return (
    <View>
      <View style={styles.arcWrap}>
        <Svg width={W} height={CY + 14}>
          <Line x1="10" y1={CY} x2={W - 10} y2={CY} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          <Path d={arc} stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeDasharray="4 5" fill="none" />
          {doneArc && <Path d={doneArc} stroke="#ffd166" strokeWidth="3" fill="none" strokeLinecap="round" />}
          {up && <Circle cx={x} cy={y} r="9" fill="#ffd166" />}
        </Svg>
        <View style={styles.times}>
          <Text style={styles.t}>↑ {hhmm(day.sunrise)}</Text>
          <Text style={styles.t}>↓ {hhmm(day.sunset)}</Text>
        </View>
      </View>
      <Text style={styles.sub}>{up ? `Daylight ${len}` : p < 0 ? `Sunrise at ${hhmm(day.sunrise)}` : 'The sun has set'}{up ? '' : ` · ${len} of daylight today`}</Text>

      <View style={styles.moon}>
        <Text style={styles.moonIcon}>{moon.icon}</Text>
        <View>
          <Text style={styles.moonName}>{moon.label}</Text>
          <Text style={styles.sub}>{Math.round(moon.illumination * 100)}% lit</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  arcWrap: { alignItems: 'center' },
  times: { width: W, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 2 },
  t: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sub: { color: '#cfdbe8', fontSize: 13, textAlign: 'center', marginTop: 6 },
  moon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.2)' },
  moonIcon: { fontSize: 40 },
  moonName: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default memo(SunMoonCard);
