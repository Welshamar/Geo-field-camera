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
}
