import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

export type GPSLocation = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  };
  timestamp: number;
};

export function useGPS() {
  const [lastLocation, setLastLocation] = useState<GPSLocation | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;

    const toGPSLocation = (loc: Location.LocationObject): GPSLocation => {
      return {
        coords: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? null,
        },
        timestamp: loc.timestamp ?? Date.now(),
      };
    };

    const start = async () => {
      try {
        setError(null);

        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (cancelled) return;
        if (!servicesEnabled) {
          setError('Location services are disabled.');
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;

        setPermissionStatus(status);
        if (status !== Location.PermissionStatus.GRANTED) {
          setError('Location permission not granted.');
          return;
        }

        // Prime with a current position so UI updates quickly.
        try {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });
          if (!cancelled) setLastLocation(toGPSLocation(current));
        } catch {
          // Ignore: watchPositionAsync below will still update.
        }

        subscriptionRef.current?.remove();
        subscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 1,
            timeInterval: 1000,
            mayShowUserSettingsDialog: true,
          },
          (loc) => {
            if (cancelled) return;
            setLastLocation(toGPSLocation(loc));
          }
        );
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to start location tracking.');
      }
    };

    start();
    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, []);

  return { lastLocation, setLastLocation, permissionStatus, error } as const;
}
