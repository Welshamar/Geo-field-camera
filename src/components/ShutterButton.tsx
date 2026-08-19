import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

interface Props {
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
}

export default function ShutterButton({ disabled, busy, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Capture photo"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.outerRing,
        disabled && styles.outerRingDisabled,
        pressed && !disabled && !busy && styles.outerRingPressed,
      ]}
    >
      <View style={styles.innerCircle}>
        {busy ? <ActivityIndicator color="#0A0A0A" size="small" /> : null}
      </View>
    </Pressable>
  );
}

const SIZE = 84;

const styles = StyleSheet.create({
  outerRing: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRingPressed: {
    borderColor: '#34C759',
  },
  outerRingDisabled: {
    borderColor: '#555555',
  },
  innerCircle: {
    width: SIZE - 16,
    height: SIZE - 16,
    borderRadius: (SIZE - 16) / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
