import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GeoFix, GpsLockLevel } from '../types';
import { formatAccuracy, formatCoordinate } from '../utils/format';

const LOCK_COLOR: Record<GpsLockLevel, string> = {
  none: '#666666',
  red: '#FF3B30',
  yellow: '#FFCC00',
  green: '#34C759',
};

const LOCK_LABEL: Record<GpsLockLevel, string> = {
  none: 'ACQUIRING',
  red: 'WEAK',
  yellow: 'FAIR',
  green: 'STRONG',
};

interface Props {
  fix: GeoFix | null;
  lockLevel: GpsLockLevel;
  errorMsg: string | null;
}

export default function GPSOverlay({ fix, lockLevel, errorMsg }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={[styles.dot, { backgroundColor: LOCK_COLOR[lockLevel] }]} />
        <Text style={[styles.lockLabel, { color: LOCK_COLOR[lockLevel] }]}>
          GPS {LOCK_LABEL[lockLevel]}
        </Text>
      </View>

      {errorMsg ? (
        <Text style={styles.errorText}>{errorMsg}</Text>
      ) : fix ? (
        <>
          <Text style={styles.coordText}>{formatCoordinate(fix.latitude, 'lat')}</Text>
          <Text style={styles.coordText}>{formatCoordinate(fix.longitude, 'lon')}</Text>
          <Text style={styles.accuracyText}>Accuracy {formatAccuracy(fix.accuracy)}</Text>
        </>
      ) : (
        <Text style={styles.coordText}>Waiting for GPS fix…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  lockLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  coordText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  accuracyText: {
    color: '#DDDDDD',
    fontSize: 12,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    maxWidth: 220,
  },
});
