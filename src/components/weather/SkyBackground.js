/**
 * SkyBackground - 依天氣與日夜變化的漸層背景（用 SVG 畫，不需要額外套件）
 */
import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

function SkyBackground({ colors }) {
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="1" stopColor={colors[1]} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#sky)" />
    </Svg>
  );
}

export default memo(SkyBackground);
