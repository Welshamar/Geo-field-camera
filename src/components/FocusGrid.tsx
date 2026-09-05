import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Rule-of-thirds composition grid overlaid on the live camera preview —
 * purely visual, doesn't affect autofocus itself (expo-camera doesn't
 * expose tap-to-focus point selection), but gives the standard framing
 * guide most camera apps show.
 */
export default function FocusGrid() {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={[styles.vLine, { left: '33.333%' }]} />
      <View style={[styles.vLine, { left: '66.666%' }]} />
      <View style={[styles.hLine, { top: '33.333%' }]} />
      <View style={[styles.hLine, { top: '66.666%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: StyleSheet.absoluteFill,
  vLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  hLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});
