import React, { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';
import { CaptureJob } from '../types';
import { formatCoordinate, formatTimestamp, formatZoom } from '../utils/format';

const logoSource = require('../../assets/watermark-logo.png');

interface Props {
  job: CaptureJob;
  canvasWidth: number;
  onImageLoad?: () => void;
  onImageError?: () => void;
}

/**
 * Off-screen composite used purely to burn a lat/lon/timestamp watermark
 * into the bottom-right corner of the captured photo, and the app logo
 * into the bottom-left. `canvasWidth` should be close to the actual photo's pixel
 * width (see CameraScreen, which caps it for very large photos to bound
 * memory use) — ViewShot's width/height capture options scale up whatever
 * was actually rendered, so rendering at a much smaller size than the
 * source photo and relying on that resize to reach full resolution just
 * produces a blurry, upscaled result rather than genuine detail.
 *
 * Output format is high-quality JPEG (0.97), not PNG: PNG was tried first
 * for maximum retained detail, but its encode time made hitting a ~2s
 * save target unrealistic at this resolution. JPEG at 0.97 is close to
 * visually lossless and encodes dramatically faster.
 */
const WatermarkCanvas = forwardRef<ViewShotRef, Props>(
  ({ job, canvasWidth, onImageLoad, onImageError }, ref) => {
    const canvasHeight = canvasWidth * (job.height / job.width);
    const fontSize = Math.max(canvasWidth * 0.032, 9);

    return (
      <ViewShot
        ref={ref}
        options={{
          format: 'jpg',
          quality: 0.97,
          result: 'tmpfile',
          width: job.width,
          height: job.height,
        }}
      >
        <View style={[styles.canvas, { width: canvasWidth, height: canvasHeight }]}>
          <Image
            source={{ uri: job.rawUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onLoad={onImageLoad}
            onError={onImageError}
          />
          <Image
            source={logoSource}
            style={[
              styles.logo,
              { width: canvasWidth * 0.12, height: canvasWidth * 0.12 },
            ]}
            resizeMode="contain"
          />
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { fontSize }]}>
              {formatCoordinate(job.fix.latitude, 'lat')}{' '}
              {formatCoordinate(job.fix.longitude, 'lon')}
            </Text>
            {job.fix.altitude !== null && (
              <Text style={[styles.badgeText, { fontSize: fontSize * 0.85 }]}>
                Alt {job.fix.altitude.toFixed(1)}m
              </Text>
            )}
            {job.fix.accuracy !== null && (
              <Text style={[styles.badgeText, { fontSize: fontSize * 0.85 }]}>
                ±{job.fix.accuracy.toFixed(1)}m accuracy
              </Text>
            )}
            <Text style={[styles.badgeText, { fontSize: fontSize * 0.85 }]}>
              Zoom {formatZoom(job.zoom)}
            </Text>
            <Text style={[styles.badgeText, { fontSize: fontSize * 0.85 }]}>
              {formatTimestamp(job.capturedAt)}
            </Text>
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
  logo: {
    position: 'absolute',
    left: '3%',
    bottom: '3%',
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: '3%',
    paddingVertical: '2%',
    alignItems: 'flex-end',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
