import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { GeoFix } from '../types';

interface UseLocationTracker {
  fix: GeoFix | null;
  errorMsg: string | null;
}

/**
 * Continuously watches device position at the highest hardware GPS accuracy.
 * Assumes foreground location permission has already been granted by the
 * caller (see App.tsx permission gate) — this hook does not request it.
 */
export function useLocationTracker(enabled: boolean): UseLocationTracker {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) setErrorMsg('Location permission is not granted.');
          return;
        }

        subscriptionRef.current = await Location.watchPositionAsync(
          {
            // BestForNavigation forces the device to use the raw GPS/GNSS
            // chipset rather than network/wifi assisted positioning, so
            // fixes keep working with no SIM/cellular/wifi connection.
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 0,
          },
          (loc) => {
            if (!isMounted) return;
            setErrorMsg(null);
            setFix({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy,
              altitude: loc.coords.altitude,
              heading: loc.coords.heading,
              timestamp: loc.timestamp,
            });
          }
        );
      } catch (err) {
        if (isMounted) {
          setErrorMsg(err instanceof Error ? err.message : 'Unable to start GPS tracking.');
        }
      }
    })();

    return () => {
      isMounted = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [enabled]);

  return { fix, errorMsg };
}
