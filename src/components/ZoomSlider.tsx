import React, { useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

interface Props {
  value: number; // 0-1
  onChange: (value: number) => void;
  height?: number;
}

const TRACK_WIDTH = 36;
const THUMB_SIZE = 28;

/**
 * A continuous vertical zoom control — drag anywhere on the track and the
 * thumb follows your finger, the way a phone camera's zoom rocker works.
 * Top of the track is max zoom, bottom is 1x, matching that convention.
 */
export default function ZoomSlider({ value, onChange, height = 180 }: Props) {
  const trackRef = useRef<View>(null);
  // measure() gives page-absolute coordinates, which stay correct even if
  // the finger drags outside the track's own bounds mid-gesture — using
  // the touch event's local coordinates instead can drift on Android once
  // that happens.
  const layout = useRef({ pageY: 0, height });

  const updateFromPageY = (pageY: number) => {
    const { pageY: trackY, height: trackHeight } = layout.current;
    const relative = pageY - trackY;
    const clamped = Math.max(0, Math.min(trackHeight, relative));
    const fraction = 1 - clamped / trackHeight;
    onChange(Math.max(0, Math.min(1, fraction)));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => updateFromPageY(evt.nativeEvent.pageY),
      onPanResponderMove: (evt) => updateFromPageY(evt.nativeEvent.pageY),
    })
  ).current;

  const thumbTop = Math.max(0, Math.min(height - THUMB_SIZE, (1 - value) * height - THUMB_SIZE / 2));

  return (
    <View
      ref={trackRef}
      style={[styles.track, { height }]}
      onLayout={() => {
        trackRef.current?.measure((_x, _y, _w, h, _pageX, pageY) => {
          layout.current = { pageY, height: h };
        });
      }}
      {...panResponder.panHandlers}
    >
      <View style={[styles.thumb, { top: thumbTop }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    borderRadius: TRACK_WIDTH / 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  thumb: {
    position: 'absolute',
    left: (TRACK_WIDTH - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#34C759',
  },
});
