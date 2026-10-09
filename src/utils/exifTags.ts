import * as Device from 'expo-device';
import type { ExifTags } from '@lodev09/react-native-exify';
import { CaptureJob } from '../types';
import {
  formatExifDateTime,
  formatExifGpsDate,
  formatExifGpsTime,
  formatZoom,
} from './format';

export const APP_SOFTWARE_TAG = 'Geo Field Camera 1.0.0';

// Settings the camera reported for the raw photo that are worth carrying
// into the final file, so it still says how it was shot, not just where.
const CAMERA_NUMBER_TAGS = [
  'ExposureTime',
  'FNumber',
  'FocalLength',
  'FocalLengthIn35mmFilm',
  'ApertureValue',
  'ShutterSpeedValue',
  'BrightnessValue',
  'ExposureBiasValue',
  'DigitalZoomRatio',
  'Flash',
  'WhiteBalance',
  'MeteringMode',
  'ExposureProgram',
  'ExposureMode',
  'SceneCaptureType',
] as const;
const CAMERA_STRING_TAGS = ['LensMake', 'LensModel'] as const;

function pickNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

// EXIF text fields are ASCII — a "°" or "±" can be mangled or rejected —
// so the human-readable summaries below deliberately use plain characters.
function describe(job: CaptureJob, device: string | undefined): string {
  const { fix } = job;
  const lat = `${Math.abs(fix.latitude).toFixed(6)} ${fix.latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(fix.longitude).toFixed(6)} ${fix.longitude >= 0 ? 'E' : 'W'}`;
  const parts = [`Lat ${lat}`, `Lon ${lon}`];
  if (fix.altitude !== null && Number.isFinite(fix.altitude)) {
    parts.push(`Alt ${fix.altitude.toFixed(1)} m`);
  }
  if (fix.accuracy !== null && Number.isFinite(fix.accuracy)) {
    parts.push(`Accuracy +/-${fix.accuracy.toFixed(1)} m`);
  }
  parts.push(`Zoom ${formatZoom(job.zoom)}`);
  if (device) parts.push(device);
  return parts.join(' | ');
}

/**
 * Builds the EXIF written into every saved photo.
 *
 * `essential` is the geotag itself plus time and device — the part that
 * must survive. `full` adds the camera-reported shooting settings on top.
 * They're separate so that if a camera-reported value is ever the wrong
 * type for the native writer and the whole write is rejected, the caller
 * can retry with `essential` alone instead of losing the geotag too.
 */
export function buildExifTags(job: CaptureJob): { essential: ExifTags; full: ExifTags } {
  const cam = job.cameraExif ?? {};
  const { fix } = job;

  const make = pickString(cam.Make) ?? pickString(Device.manufacturer);
  const model = pickString(cam.Model) ?? pickString(Device.modelName);
  const device = [make, model].filter(Boolean).join(' ') || undefined;

  const gpsMs = Number.isFinite(fix.timestamp) && fix.timestamp > 0 ? fix.timestamp : job.capturedAt;
  const localTime = formatExifDateTime(job.capturedAt);
  const summary = describe(job, device);

  // GPSLatitude/GPSLongitude are passed signed: the native writer derives
  // the N/S and E/W reference tags from the sign.
  const essential: ExifTags = {
    GPSLatitude: fix.latitude,
    GPSLongitude: fix.longitude,
    GPSMapDatum: 'WGS-84',
    GPSDateStamp: formatExifGpsDate(gpsMs),
    GPSTimeStamp: formatExifGpsTime(gpsMs),
    DateTimeOriginal: localTime,
    DateTimeDigitized: localTime,
    DateTime: localTime,
    Software: APP_SOFTWARE_TAG,
    ImageDescription: summary,
    UserComment: summary,
  };
  if (make) essential.Make = make;
  if (model) essential.Model = model;
  const os = [Device.osName, Device.osVersion].filter(Boolean).join(' ');
  if (os) essential.HostComputer = os;
  if (fix.altitude !== null && Number.isFinite(fix.altitude)) {
    essential.GPSAltitude = fix.altitude;
  }
  if (fix.accuracy !== null && Number.isFinite(fix.accuracy)) {
    essential.GPSHPositioningError = fix.accuracy;
  }

  const settings: ExifTags = {};
  for (const key of CAMERA_NUMBER_TAGS) {
    const value = pickNumber(cam[key]);
    if (value !== undefined) settings[key] = value;
  }
  for (const key of CAMERA_STRING_TAGS) {
    const value = pickString(cam[key]);
    if (value !== undefined) settings[key] = value;
  }
  const iso = pickNumber(cam.ISOSpeedRatings);
  if (iso !== undefined) settings.ISOSpeedRatings = [Math.round(iso)];

  return { essential, full: { ...essential, ...settings } };
}
