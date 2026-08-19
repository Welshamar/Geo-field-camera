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

export function gpsLockLevel(accuracy: number | null): 'none' | 'red' | 'yellow' | 'green' {
  if (accuracy === null || Number.isNaN(accuracy)) return 'none';
  if (accuracy < 10) return 'green';
  if (accuracy <= 30) return 'yellow';
  return 'red';
}
