import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraRatio, CameraView, FlashMode, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import { ViewShotRef } from 'react-native-view-shot';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ExifTags } from '@lodev09/react-native-exify';

import GPSOverlay from './src/components/GPSOverlay';
import ShutterButton from './src/components/ShutterButton';
import PermissionScreen from './src/components/PermissionScreen';
import WatermarkCanvas from './src/components/WatermarkCanvas';
import ZoomSlider from './src/components/ZoomSlider';
import { useLocationTracker } from './src/hooks/useLocationTracker';
import { formatExifDateTime, gpsLockLevel } from './src/utils/format';
import { CaptureJob, GeoFix } from './src/types';

const ALBUM_NAME = 'GeoField Photos';
// Cap on the watermark compositor's on-screen render width — see
// WatermarkCanvas for why this needs to be close to the real photo
// resolution, not a tiny fixed size. Capped so an extremely
// high-resolution capture doesn't force rendering (and decoding the
// source photo into) an enormous off-screen view. Raised well above most
// phone cameras' native width (commonly 3000-4032px) so the vast majority
// of captures render at effectively full detail with no meaningful
// upscaling at all.
const MAX_WATERMARK_CANVAS_WIDTH = 3200;
const APP_SOFTWARE_TAG = 'Geo Field Camera 1.0.0';

// The `ratio` prop only affects Android (expo-camera has no iOS
// equivalent), so the control that changes it is hidden on iOS.
const RATIO_OPTIONS: CameraRatio[] = ['4:3', '16:9', '1:1'];

// Cycle order for the flash mode badge, starting with 'on': expo-camera
// exposes no manual exposure/brightness control on native platforms at
// all (only on web — see WebCameraSettings in Camera.types), so forcing
// flash to actually fire on every capture is the most effective lever
// available here for low-light brightness, more than leaving it on
// 'auto' (which can decide not to fire even in a dark room).
const FLASH_MODES: FlashMode[] = ['on', 'auto', 'off'];

function parseSizeArea(size: string): number {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return 0;
  return Number(match[1]) * Number(match[2]);
}

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
  const [imageReady, setImageReady] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [ratioIndex, setRatioIndex] = useState(0);
  const ratio = RATIO_OPTIONS[ratioIndex];
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const [sizePickerOpen, setSizePickerOpen] = useState(false);
  const userPickedSizeRef = useRef(false);
  const [flashIndex, setFlashIndex] = useState(0); // starts at 'on'
  const flash = FLASH_MODES[flashIndex];
  const [torchOn, setTorchOn] = useState(false);

  const handleCameraReady = useCallback(async () => {
    try {
      const sizes = await cameraRef.current?.getAvailablePictureSizesAsync();
      if (sizes && sizes.length > 0) {
        setAvailableSizes(sizes);
        // Default to the device's highest resolution rather than leaving
        // pictureSize unset — "device default" is not reliably the max
        // available size, it's whatever the platform happens to pick.
        if (!userPickedSizeRef.current) {
          const largest = sizes.reduce((best, s) =>
            parseSizeArea(s) > parseSizeArea(best) ? s : best
          );
          if (parseSizeArea(largest) > 0) setPictureSize(largest);
        }
      }
    } catch {
      // Some devices/platforms don't support querying this — the resolution
      // picker just won't have any options to show, no crash either way.
    }
  }, []);

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

      setImageReady(false);
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

  // Safety net: local file:// images should fire onLoad almost instantly,
  // but if it never fires for some reason, don't leave the shutter stuck
  // disabled forever — proceed with the capture anyway after a timeout.
  useEffect(() => {
    if (!pendingJob) return;
    const timer = setTimeout(() => setImageReady(true), 5000);
    return () => clearTimeout(timer);
  }, [pendingJob]);

  // Once the hidden WatermarkCanvas has actually finished loading and
  // painting the freshly captured photo, rasterize it (burning in the
  // lat/lon/timestamp badge) and save it. Waiting for imageReady matters:
  // capturing before the Image has painted produces a solid black photo.
  useEffect(() => {
    if (!pendingJob || !imageReady || !viewShotRef.current?.capture) return;
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
  }, [pendingJob, imageReady]);

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
        pictureSize={pictureSize}
        flash={flash}
        enableTorch={torchOn}
        onCameraReady={handleCameraReady}
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

      {availableSizes.length > 0 && (
        <View style={[styles.resolutionBadge, { bottom: insets.bottom + 158 }]}>
          <Pressable style={styles.ratioButton} onPress={() => setSizePickerOpen(true)}>
            <Text style={styles.ratioButtonText}>{pictureSize ?? 'Auto res'}</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.flashBadge, { bottom: insets.bottom + 206 }]}>
        <Pressable
          style={styles.ratioButton}
          onPress={() => setFlashIndex((i) => (i + 1) % FLASH_MODES.length)}
        >
          <Text style={styles.ratioButtonText}>Flash: {flash}</Text>
        </Pressable>
      </View>

      <View style={[styles.torchBadge, { bottom: insets.bottom + 254 }]}>
        <Pressable
          style={[styles.ratioButton, torchOn && styles.torchButtonActive]}
          onPress={() => setTorchOn((t) => !t)}
        >
          <Text style={[styles.ratioButtonText, torchOn && styles.torchButtonTextActive]}>
            Torch {torchOn ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.zoomSliderHost, { top: '32%' }]} pointerEvents="box-none">
        <ZoomSlider value={zoom} onChange={setZoom} />
      </View>

      <Modal
        visible={sizePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSizePickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSizePickerOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Photo resolution</Text>
            <FlatList
              data={['Max (auto)', ...availableSizes]}
              keyExtractor={(item) => item}
              style={styles.modalList}
              renderItem={({ item }) => {
                const isAutoMax = item === 'Max (auto)';
                const largestSize = isAutoMax
                  ? availableSizes.reduce((best, s) =>
                      parseSizeArea(s) > parseSizeArea(best) ? s : best
                    )
                  : null;
                const active = isAutoMax ? pictureSize === largestSize : pictureSize === item;
                return (
                  <Pressable
                    style={[styles.modalRow, active && styles.modalRowActive]}
                    onPress={() => {
                      userPickedSizeRef.current = !isAutoMax;
                      setPictureSize(isAutoMax ? largestSize ?? undefined : item);
                      setSizePickerOpen(false);
                    }}
                  >
                    <Text style={[styles.modalRowText, active && styles.modalRowTextActive]}>
                      {item}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>

      {lastSavedAt !== null && (
        <View style={[styles.savedToast, { top: insets.top + 12 }]} pointerEvents="none">
          <Text style={styles.savedToastText}>
            {Platform.OS === 'web' ? 'Captured ✓ (no gallery on web)' : 'Saved ✓'}
          </Text>
          {previewUri && <Image source={{ uri: previewUri }} style={styles.previewThumb} />}
        </View>
      )}

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        <ShutterButton disabled={!fix} busy={isCapturing} onPress={handleCapture} />
        <Text style={styles.hint}>
          {fix ? 'Coordinates locked to next photo' : 'Waiting for GPS before shutter unlocks'}
        </Text>
      </View>

      {/* Invisible (opacity 0) compositor: still fully rendered on-screen so
          it actually paints, used only to burn the watermark in. */}
      {pendingJob && (
        <View style={styles.hiddenCanvasHost} pointerEvents="none">
          <WatermarkCanvas
            ref={viewShotRef}
            job={pendingJob}
            canvasWidth={Math.min(pendingJob.width, MAX_WATERMARK_CANVAS_WIDTH)}
            onImageLoad={() => setImageReady(true)}
            onImageError={() => setImageReady(true)}
          />
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
  zoomSliderHost: {
    position: 'absolute',
    left: 16,
  },
  ratioBadge: {
    position: 'absolute',
    right: 16,
  },
  resolutionBadge: {
    position: 'absolute',
    right: 16,
  },
  flashBadge: {
    position: 'absolute',
    right: 16,
  },
  torchBadge: {
    position: 'absolute',
    right: 16,
  },
  torchButtonActive: {
    backgroundColor: '#FFCC00',
  },
  torchButtonTextActive: {
    color: '#0A0A0A',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    width: '80%',
    maxHeight: '60%',
    paddingVertical: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  modalList: {
    flexGrow: 0,
  },
  modalRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalRowActive: {
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  modalRowText: {
    color: '#EEEEEE',
    fontSize: 14,
  },
  modalRowTextActive: {
    color: '#34C759',
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
    // Positioned on-screen (not translated off-screen) with opacity 0: a
    // view placed far outside the viewport can end up never actually
    // drawn by the OS compositor, since it's an optimization target for
    // being off-screen — and an undrawn view captures as solid black.
    // Keeping it within the viewport but invisible guarantees it's
    // actually rendered before ViewShot captures it.
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
  },
});
