import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type GPSLocation = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    altitude?: number | null;
    heading?: number | null;
  };
  timestamp: number;
};

export function useGPS() {
  const [lastLocation, setLastLocation] = useState<GPSLocation | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const headingRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const toGPSLocation = (loc: Location.LocationObject): GPSLocation => {
      return {
        coords: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? null,
          altitude: loc.coords.altitude ?? null,
          heading: headingRef.current,
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

        // Magnetic heading
        if (Platform.OS !== 'web') {
          try {
            headingSubscriptionRef.current?.remove();
            headingSubscriptionRef.current = await Location.watchHeadingAsync((h) => {
              if (cancelled) return;
              const next = Number.isFinite(h.trueHeading) ? h.trueHeading : null;
              headingRef.current = next;
              setHeading(next);
              setLastLocation((prev) =>
                prev
                  ? {
                      ...prev,
                      coords: {
                        ...prev.coords,
                        heading: next,
                      },
                    }
                  : prev
              );
            });
          } catch {
            // Ignore heading errors; location tracking can still work.
          }
        }

        // Prime with a current position so UI updates quickly.
        try {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });
          if (!cancelled) {
            const next = toGPSLocation(current);
            setLastLocation(next);
          }
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
            const next = toGPSLocation(loc);
            setLastLocation(next);
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
      headingSubscriptionRef.current?.remove();
      headingSubscriptionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;

    const handler = (ev: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const next = (ev as any).webkitCompassHeading ?? ev.alpha;
      if (next == null) return;
      headingRef.current = next;
      setHeading(next);
      setLastLocation((prev) =>
        prev
          ? {
              ...prev,
              coords: {
                ...prev.coords,
                heading: next,
              },
            }
          : prev
      );
    };

    window.addEventListener('deviceorientation', handler as EventListener);
    return () => window.removeEventListener('deviceorientation', handler as EventListener);
  }, []);

  return { lastLocation, setLastLocation, permissionStatus, error } as const;
}
