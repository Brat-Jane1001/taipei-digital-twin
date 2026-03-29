/**
 * VoiceGuide - 語音導覽顯示
 * Voice guide display component
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function VoiceGuide({ message }) {
  if (!message) return null;

  return (
    <View style={styles.voiceContainer}>
      <View style={styles.voiceIcon}>
        <Text style={styles.iconText}>🔊</Text>
      </View>
      <Text style={styles.voiceText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  voiceContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  voiceIcon: {
    marginRight: 10,
  },
  iconText: {
    fontSize: 24,
  },
  voiceText: {
    color: 'white',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});