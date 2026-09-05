export interface GeoFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  timestamp: number;
}

export type GpsLockLevel = 'none' | 'red' | 'yellow' | 'green';

export interface CaptureJob {
  rawUri: string;
  width: number;
  height: number;
  fix: GeoFix;
  capturedAt: number;
  // The 0-1 zoom fraction active at the moment of capture — expo-camera's
  // own units. Use zoomFractionToMultiplier/formatZoom (utils/format) to
  // turn this into a display "Xx" value; that's an approximation, not a
  // real optical factor.
  zoom: number;
}
