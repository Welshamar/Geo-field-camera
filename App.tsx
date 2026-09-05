import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraRatio, CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import { ViewShotRef } from 'react-native-view-shot';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ExifTags } from '@lodev09/react-native-exify';

import GPSOverlay from './src/components/GPSOverlay';
import ShutterButton from './src/components/ShutterButton';
import PermissionScreen from './src/components/PermissionScreen';
import WatermarkCanvas from './src/components/WatermarkCanvas';
import { useLocationTracker } from './src/hooks/useLocationTracker';
import { formatExifDateTime, gpsLockLevel } from './src/utils/format';
import { CaptureJob, GeoFix } from './src/types';

const ALBUM_NAME = 'GeoField Photos';
const WATERMARK_CANVAS_WIDTH = 420;
const APP_SOFTWARE_TAG = 'Geo Field Camera 1.0.0';

// expo-camera's `zoom` prop is a 0-1 fraction of the device's max optical
// zoom range, not a "2x/3x" multiplier — these are just evenly spaced
// presets across that range, labeled the way a camera app's UI
// conventionally does.
const ZOOM_PRESETS: Array<{ label: string; value: number }> = [
  { label: '1x', value: 0 },
  { label: '2x', value: 0.35 },
  { label: '3x', value: 0.7 },
];

// The `ratio` prop only affects Android (expo-camera has no iOS
// equivalent), so the control that changes it is hidden on iOS.
const RATIO_OPTIONS: CameraRatio[] = ['4:3', '16:9', '1:1'];

// expo-media-library runs native-module setup as soon as its module code
// executes, which throws immediately on web (no OS photo gallery exists in
// a browser). A static `import` always executes that code, even if every
// call site is Platform-guarded, so it's required lazily here instead —
// this require() only ever runs when Platform.OS !== 'web'.
//
// The '/legacy' subpath (not the package root) is required deliberately:
// SDK 57 moved createAssetAsync/getAlbumAsync/createAlbumAsync/
// addAssetsToAlbumAsync/usePermissions to a new class-based API on the
// root import, and the old function names now throw at call time instead
// of just warning.
const MediaLibrary: typeof import('expo-media-library/legacy') | null =
  Platform.OS === 'web' ? null : require('expo-media-library/legacy');

// @lodev09/react-native-exify is a Turbo Module: importing it calls
// TurboModuleRegistry.getEnforcing('Exify') at the top of the file, which
// throws synchronously if the native module isn't linked — true on web,
// and also true in plain Expo Go (this isn't one of Expo Go's bundled
// modules, so it only works in a custom dev build). Deferred behind a
// try/catch at the point of use so a missing native module just skips EXIF
// writing instead of crashing the whole app.
function getExify(): typeof import('@lodev09/react-native-exify') | null {
  if (Platform.OS === 'web') return null;
  try {
    return require('@lodev09/react-native-exify');
  } catch {
    return null;
  }
}

type PermissionState = 'checking' | 'granted' | 'denied';

// Stand-in used on web, where there is no OS photo gallery to grant
// permission to (Platform.OS never changes for a running app instance, so
// this conditional hook call is safe in practice).
const WEB_MEDIA_PERMISSION_STUB: [
  { granted: boolean },
  () => Promise<{ granted: boolean }>,
] = [{ granted: true }, async () => ({ granted: true })];

function useStartupPermissions() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] =
    Platform.OS === 'web' ? WEB_MEDIA_PERMISSION_STUB : MediaLibrary!.usePermissions();
  const [state, setState] = useState<PermissionState>('checking');
  const [locationDenied, setLocationDenied] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);

  const requestAll = useCallback(async () => {
    setState('checking');

    const cam = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();

    const loc = await Location.requestForegroundPermissionsAsync();

    const media = mediaPermission?.granted ? mediaPermission : await requestMediaPermission();

    const camOk = !!cam?.granted;
    const locOk = loc.status === 'granted';
    const mediaOk = !!media?.granted;

    setCameraDenied(!camOk);
    setLocationDenied(!locOk);
    setState(camOk && locOk && mediaOk ? 'granted' : 'denied');
  }, [cameraPermission, mediaPermission, requestCameraPermission, requestMediaPermission]);

  useEffect(() => {
    requestAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, cameraDenied, locationDenied, retry: requestAll };
}

function CameraScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const viewShotRef = useRef<ViewShotRef>(null);

  const { fix, errorMsg } = useLocationTracker(true);
  const lockLevel = gpsLockLevel(fix?.accuracy ?? null);

  const [pendingJob, setPendingJob] = useState<CaptureJob | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const [ratioIndex, setRatioIndex] = useState(0);
  const ratio = RATIO_OPTIONS[ratioIndex];

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    if (!fix) {
      Alert.alert(
        'No GPS fix yet',
        'Wait for the GPS indicator to acquire a location before capturing a photo.'
      );
      return;
    }

    setIsCapturing(true);
    try {
      // Fire the shutter and grab a brand-new GPS reading in parallel, so the
      // embedded coordinate is the one at the instant of capture rather than
      // the last background tick (which can be up to ~1s stale).
      const [photo, freshPosition] = await Promise.all([
        cameraRef.current.takePictureAsync({ quality: 1 }),
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }).catch(
          () => null
        ),
      ]);

      if (!photo?.uri || !photo.width || !photo.height) {
        throw new Error('Camera did not return a valid photo.');
      }

      const capturedAt = Date.now();
      const capturedFix: GeoFix = freshPosition
        ? {
            latitude: freshPosition.coords.latitude,
            longitude: freshPosition.coords.longitude,
            accuracy: freshPosition.coords.accuracy,
            altitude: freshPosition.coords.altitude,
            heading: freshPosition.coords.heading,
            timestamp: freshPosition.timestamp,
          }
        : fix;

      setPendingJob({
        rawUri: photo.uri,
        width: photo.width,
        height: photo.height,
        fix: capturedFix,
        capturedAt,
      });
    } catch (err) {
      Alert.alert('Capture failed', err instanceof Error ? err.message : 'Unknown error.');
      setIsCapturing(false);
    }
  }, [fix, isCapturing]);

  // Once the hidden WatermarkCanvas has laid out the freshly captured photo,
  // rasterize it (burning in the lat/lon/timestamp badge) and save it.
  useEffect(() => {
    if (!pendingJob || !viewShotRef.current?.capture) return;
    let cancelled = false;

    (async () => {
      try {
        const outputUri = await viewShotRef.current!.capture();

        if (cancelled) return;

        // Write real EXIF GPS + device metadata into the watermarked file
        // itself (the ViewShot rasterization above produces a fresh JPEG
        // with no EXIF of its own, so this has to happen after capture).
        // Best-effort: falls through silently if the native module isn't
        // available (web, or Expo Go without a custom dev build).
        const exify = getExify();
        if (exify) {
          try {
            const exifUri = outputUri.startsWith('file://') ? outputUri : `file://${outputUri}`;
            const tags: ExifTags = {
              GPSLatitude: pendingJob.fix.latitude,
              GPSLongitude: pendingJob.fix.longitude,
              DateTimeOriginal: formatExifDateTime(pendingJob.capturedAt),
              DateTime: formatExifDateTime(pendingJob.capturedAt),
              Make: Device.manufacturer ?? undefined,
              Model: Device.modelName ?? undefined,
              Software: APP_SOFTWARE_TAG,
              HostComputer: [Device.osName, Device.osVersion].filter(Boolean).join(' ') || undefined,
            };
            if (pendingJob.fix.altitude !== null) {
              tags.GPSAltitude = pendingJob.fix.altitude;
            }
            await exify.write(exifUri, tags);
          } catch (exifErr) {
            console.warn('EXIF write failed, continuing without it:', exifErr);
          }
        }

        // expo-media-library has no web implementation — there is no OS
        // photo gallery to save into from a browser.
        if (MediaLibrary) {
          const asset = await MediaLibrary.createAssetAsync(outputUri);
          const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
          if (album) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          } else {
            await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
          }
        }

        if (!cancelled) {
          setPreviewUri(outputUri);
          setLastSavedAt(Date.now());
        }
      } catch (err) {
        if (!cancelled) {
          Alert.alert(
            'Save failed',
            err instanceof Error ? err.message : 'Could not save the geotagged photo.'
          );
        }
      } finally {
        if (!cancelled) {
          setPendingJob(null);
          setIsCapturing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingJob]);

  useEffect(() => {
    if (lastSavedAt === null) return;
    const timer = setTimeout(() => {
      setLastSavedAt(null);
      setPreviewUri(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [lastSavedAt]);

  return (
    <View style={styles.flex}>
      <StatusBar barStyle="light-content" />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        zoom={zoom}
        ratio={Platform.OS === 'android' ? ratio : undefined}
      />

      <View style={[styles.topOverlay, { top: insets.top + 12 }]} pointerEvents="none">
        <GPSOverlay fix={fix} lockLevel={lockLevel} errorMsg={errorMsg} />
      </View>

      {Platform.OS === 'android' && (
        <View style={[styles.ratioBadge, { bottom: insets.bottom + 110 }]}>
          <Pressable
            style={styles.ratioButton}
            onPress={() => setRatioIndex((i) => (i + 1) % RATIO_OPTIONS.length)}
          >
            <Text style={styles.ratioButtonText}>{ratio}</Text>
          </Pressable>
        </View>
      )}

      {lastSavedAt !== null && (
        <View style={[styles.savedToast, { top: insets.top + 12 }]} pointerEvents="none">
          <Text style={styles.savedToastText}>
            {Platform.OS === 'web' ? 'Captured ✓ (no gallery on web)' : 'Saved ✓'}
          </Text>
          {previewUri && <Image source={{ uri: previewUri }} style={styles.previewThumb} />}
        </View>
      )}

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.zoomRow}>
          {ZOOM_PRESETS.map((preset) => {
            const active = zoom === preset.value;
            return (
              <Pressable
                key={preset.label}
                style={[styles.zoomButton, active && styles.zoomButtonActive]}
                onPress={() => setZoom(preset.value)}
              >
                <Text style={[styles.zoomButtonText, active && styles.zoomButtonTextActive]}>
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <ShutterButton disabled={!fix} busy={isCapturing} onPress={handleCapture} />
        <Text style={styles.hint}>
          {fix ? 'Coordinates locked to next photo' : 'Waiting for GPS before shutter unlocks'}
        </Text>
      </View>

      {/* Off-screen compositor: never visible, used only to burn the watermark in. */}
      {pendingJob && (
        <View style={styles.hiddenCanvasHost} pointerEvents="none">
          <WatermarkCanvas ref={viewShotRef} job={pendingJob} canvasWidth={WATERMARK_CANVAS_WIDTH} />
        </View>
      )}
    </View>
  );
}

export default function App() {
  const { state, cameraDenied, locationDenied, retry } = useStartupPermissions();

  return (
    <SafeAreaProvider>
      {state === 'checking' && (
        <View style={styles.centerDark}>
          <ActivityIndicator color="#FFFFFF" size="large" />
          <Text style={styles.checkingText}>Requesting camera &amp; GPS permissions…</Text>
        </View>
      )}
      {state === 'denied' && (
        <PermissionScreen cameraDenied={cameraDenied} locationDenied={locationDenied} onRetry={retry} />
      )}
      {state === 'granted' && <CameraScreen />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerDark: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkingText: {
    color: '#CCCCCC',
    marginTop: 16,
    fontSize: 13,
  },
  topOverlay: {
    position: 'absolute',
    left: 16,
  },
  savedToast: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(52,199,89,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  savedToastText: {
    color: '#0A0A0A',
    fontWeight: '700',
    fontSize: 13,
  },
  previewThumb: {
    width: 140,
    height: 187,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 16,
  },
  zoomRow: {
    flexDirection: 'row',
    marginBottom: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
  },
  zoomButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  zoomButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  zoomButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  zoomButtonTextActive: {
    color: '#0A0A0A',
  },
  ratioBadge: {
    position: 'absolute',
    right: 16,
  },
  ratioButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ratioButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: '#EEEEEE',
    fontSize: 12,
    marginTop: 10,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
  hiddenCanvasHost: {
    position: 'absolute',
    top: 0,
    left: Dimensions.get('window').width + 50,
  },
});
