import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { getMagneticDeclination } from '../components/map/converter';

export type GPSLocation = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    altitude?: number | null;
    magHeading?: number | null;
    trueHeading?: number | null;
  };
  timestamp: number;
};

export function useGPS() {
  const [lastLocation, setLastLocation] = useState<GPSLocation | null>(null);
  const lastLocationRef = useRef<GPSLocation | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const [magHeading, setMagHeading] = useState<number | null>(null);
  const [trueHeading, setTrueHeading] = useState<number | null>(null);
  const magHeadingRef = useRef<number | null>(null);
  const trueHeadingRef = useRef<number | null>(null);

  useEffect(() => {
    lastLocationRef.current = lastLocation;
  }, [lastLocation]);

  const normalizeDeg = useCallback((deg: number) => {
    let v = deg % 360;
    if (v < 0) v += 360;
    return v;
  }, []);

  // Compute declination and convert a magnetic heading to true heading.
  const computeAndSetTrueHeading = useCallback(
    async (magHeading: number | null, lat: number, lon: number, altitudeMeters?: number | null) => {
      if (magHeading == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
      try {
        const altKm = (altitudeMeters ?? 0) / 1000;
        const decl = await getMagneticDeclination(lat, lon, new Date(), { altitudeKm: altKm });
        const trueH = normalizeDeg(magHeading + decl);
        trueHeadingRef.current = trueH;
        setTrueHeading(trueH);
        setLastLocation((prev) =>
          prev
            ? {
                ...prev,
                coords: {
                  ...prev.coords,
                  trueHeading: trueH,
                },
              }
            : prev
        );
      } catch {
        // ignore declination errors; keep magnetic heading if conversion fails
      }
    },
    [normalizeDeg]
  );

  useEffect(() => {
    let cancelled = false;

    const toGPSLocation = (loc: Location.LocationObject): GPSLocation => {
      return {
        coords: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? null,
          altitude: loc.coords.altitude ?? null,
          magHeading: magHeadingRef.current,
          trueHeading: trueHeadingRef.current,
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
              const mag = Number.isFinite(h.magHeading) ? h.magHeading : null;
              // temporarily set magnetic heading; convert to true if we have a location
              magHeadingRef.current = mag;
              setMagHeading(mag);
              setLastLocation((prev) =>
                prev
                  ? {
                      ...prev,
                      coords: {
                        ...prev.coords,
                        magHeading: mag,
                      },
                    }
                  : prev
              );

              const loc = lastLocationRef.current;
              if (mag != null && loc) {
                void computeAndSetTrueHeading(mag, loc.coords.latitude, loc.coords.longitude, loc.coords.altitude ?? null);
              }
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
            // If we already have a magnetic heading, convert it to true now that we have coordinates
            if (magHeadingRef.current != null) {
              void computeAndSetTrueHeading(magHeadingRef.current as number, next.coords.latitude, next.coords.longitude, next.coords.altitude ?? null);
            }
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
          async (loc) => {
            if (cancelled) return;
            const next = toGPSLocation(loc);
            setLastLocation(next);
            // Convert any existing magnetic heading to true using updated location
            if (magHeadingRef.current != null) {
              await computeAndSetTrueHeading(magHeadingRef.current as number, next.coords.latitude, next.coords.longitude, next.coords.altitude ?? null);
            }
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
  }, [computeAndSetTrueHeading]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;

    const handler = (ev: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const mag = (ev as any).webkitCompassHeading ?? ev.alpha;
      if (mag == null) return;
      // set magnetic value first, then convert if we have a location
      magHeadingRef.current = mag;
      setMagHeading(mag);
      setLastLocation((prev) =>
        prev
          ? {
              ...prev,
              coords: {
                ...prev.coords,
                magHeading: mag,
              },
            }
          : prev
      );

      const loc = lastLocationRef.current;
      if (mag != null && loc) {
        void computeAndSetTrueHeading(mag, loc.coords.latitude, loc.coords.longitude, loc.coords.altitude ?? null);
      }
    };

    window.addEventListener('deviceorientation', handler as EventListener);
    return () => window.removeEventListener('deviceorientation', handler as EventListener);
  }, [computeAndSetTrueHeading]);

  return { lastLocation, setLastLocation, permissionStatus, error, magHeading, trueHeading } as const;
}
