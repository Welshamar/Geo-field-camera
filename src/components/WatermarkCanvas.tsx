import React, { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';
import * as Device from 'expo-device';
import { CaptureJob } from '../types';
import { BRIGHTNESS_PRESETS } from '../utils/brightness';
import { formatAltitude, formatCoordinate, formatTimestamp, formatZoom } from '../utils/format';

const logoSource = require('../../assets/watermark-logo.png');

// Accent colours taken from the app logo so the panel reads as part of it.
const PANEL_BG = 'rgba(10,22,40,0.8)';
const ACCENT = '#E8453C';
const LABEL_COLOR = '#8FA8C4';

interface Props {
  job: CaptureJob;
  canvasWidth: number;
  onImageLoad?: () => void;
  onImageError?: () => void;
}

/**
 * Off-screen composite that produces the saved photo: the captured image
 * (with the brightness boost applied to it alone), the app logo bottom-left
 * and an organised geotag panel bottom-right.
 *
 * `canvasWidth` should be close to the actual photo's pixel width — see
 * MAX_WATERMARK_CANVAS_WIDTH in App.tsx. It controls internal render
 * detail only; ViewShot always outputs at job.width x job.height.
 *
 * Everything on the panel and logo is sized from the SHORTER side of the
 * canvas, so the stamp covers the same share of the picture whether the
 * photo is portrait, landscape or a wide panorama.
 *
 * Output is JPEG at 0.92 rather than PNG: PNG's encode time made a fast
 * save unrealistic at this resolution, and this has no effect on the
 * saved photo's pixel dimensions, only its compression.
 */
const WatermarkCanvas = forwardRef<ViewShotRef, Props>(
  ({ job, canvasWidth, onImageLoad, onImageError }, ref) => {
    const canvasHeight = canvasWidth * (job.height / job.width);
    const unit = Math.min(canvasWidth, canvasHeight);
    const fontSize = Math.max(unit * 0.017, 9);
    const margin = unit * 0.02;

    const preset = BRIGHTNESS_PRESETS[job.brightnessIndex] ?? BRIGHTNESS_PRESETS[0];
    const boosted = preset.gain !== 1 || preset.saturate !== 1;

    const { fix } = job;
    const device = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ');
    const rows: Array<[string, string]> = [
      ['LAT', formatCoordinate(fix.latitude, 'lat')],
      ['LON', formatCoordinate(fix.longitude, 'lon')],
    ];
    if (fix.altitude !== null) rows.push(['ALT', formatAltitude(fix.altitude)]);
    if (fix.accuracy !== null) rows.push(['ACC', `±${fix.accuracy.toFixed(1)} m`]);
    rows.push(['ZOOM', formatZoom(job.zoom)]);
    rows.push(['TIME', formatTimestamp(job.capturedAt)]);
    if (device) rows.push(['DEVICE', device]);

    return (
      <ViewShot
        ref={ref}
        options={{
          format: 'jpg',
          quality: 0.92,
          result: 'tmpfile',
          width: job.width,
          height: job.height,
        }}
      >
        <View style={[styles.canvas, { width: canvasWidth, height: canvasHeight }]}>
          {/* Brightness is applied to the photo only: a linear gain via the
              `filter` style, then a translucent white 'screen' blend that
              lifts shadows more than highlights. Neither touches the logo
              or panel, which are drawn afterwards. See utils/brightness. */}
          <View
            collapsable={false}
            style={[
              StyleSheet.absoluteFill,
              boosted
                ? { filter: [{ brightness: preset.gain }, { saturate: preset.saturate }] }
                : null,
            ]}
          >
            <Image
              source={{ uri: job.rawUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onLoad={onImageLoad}
              onError={onImageError}
            />
          </View>
          {preset.lift > 0 && (
            <View
              collapsable={false}
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: `rgba(255,255,255,${preset.lift})`, mixBlendMode: 'screen' },
              ]}
            />
          )}

          <Image
            source={logoSource}
            style={{
              position: 'absolute',
              left: margin,
              bottom: margin,
              width: unit * 0.13,
              height: unit * 0.13,
            }}
            resizeMode="contain"
          />

          <View
            style={[
              styles.panel,
              {
                right: margin,
                bottom: margin,
                padding: fontSize * 0.75,
                borderRadius: fontSize * 0.6,
                borderLeftWidth: fontSize * 0.28,
              },
            ]}
          >
            <Text style={[styles.title, { fontSize: fontSize * 0.8, marginBottom: fontSize * 0.4 }]}>
              GEOTAG
            </Text>
            {rows.map(([label, value]) => (
              <View key={label} style={[styles.row, { marginTop: fontSize * 0.22 }]}>
                <Text style={[styles.label, { fontSize: fontSize * 0.78, width: fontSize * 4.4 }]}>
                  {label}
                </Text>
                <Text style={[styles.value, { fontSize }]}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
      </ViewShot>
    );
  }
);

WatermarkCanvas.displayName = 'WatermarkCanvas';
export default WatermarkCanvas;

const styles = StyleSheet.create({
  canvas: {
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  panel: {
    position: 'absolute',
    backgroundColor: PANEL_BG,
    borderLeftColor: ACCENT,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  label: {
    color: LABEL_COLOR,
    fontWeight: '700',
    letterSpacing: 1,
  },
  value: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
