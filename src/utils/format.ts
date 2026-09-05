export function formatCoordinate(value: number, kind: 'lat' | 'lon'): string {
  const hemisphere = kind === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${Math.abs(value).toFixed(6)}°${hemisphere}`;
}

export function formatAccuracy(accuracy: number | null): string {
  if (accuracy === null || Number.isNaN(accuracy)) return '—';
  return `±${accuracy.toFixed(1)}m`;
}

export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// EXIF DateTime fields use a colon-separated date per spec (not ISO 8601).
export function formatExifDateTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// expo-camera's `zoom` prop is a 0-1 fraction of the device's zoom range,
// not a real optical "Xx" factor — there's no API to read the device's
// actual max zoom multiplier. This is a fixed, approximate mapping used
// consistently everywhere zoom is displayed, not a measured value.
export function zoomFractionToMultiplier(zoomFraction: number): number {
  return 1 + zoomFraction * 9;
}

export function formatZoom(zoomFraction: number): string {
  return `${zoomFractionToMultiplier(zoomFraction).toFixed(1)}x`;
}

export function gpsLockLevel(accuracy: number | null): 'none' | 'red' | 'yellow' | 'green' {
  if (accuracy === null || Number.isNaN(accuracy)) return 'none';
  if (accuracy < 10) return 'green';
  if (accuracy <= 30) return 'yellow';
  return 'red';
}
