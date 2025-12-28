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
  const [restartToken, setRestartToken] = useState(0);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
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

        // On web, hasServicesEnabledAsync can prevent the permission prompt from ever
        // showing (browser-controlled). Prefer requesting permission first.
        if (Platform.OS !== 'web') {
          const servicesEnabled = await Location.hasServicesEnabledAsync();
          if (cancelled) return;
          if (!servicesEnabled) {
            setError('Location services are disabled.');
            // One retry: some devices report disabled briefly during startup/resume.
            if (retryCountRef.current < 1) {
              retryCountRef.current += 1;
              retryTimerRef.current = setTimeout(() => {
                if (!cancelled) void start();
              }, 2000) as unknown as number;
            }
            return;
          }
        }

        const existing = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        setPermissionStatus(existing.status);

        let status = existing.status;
        if (status !== Location.PermissionStatus.GRANTED) {
          const requested = await Location.requestForegroundPermissionsAsync();
          if (cancelled) return;
          status = requested.status;
          setPermissionStatus(status);
        }

        if (status !== Location.PermissionStatus.GRANTED) {
          setError('Location permission not granted.');
          return;
        }

        retryCountRef.current = 0;

        // Magnetic heading
        if (Platform.OS !== 'web') {
          try {
            try {
              const old = headingSubscriptionRef.current as any;
              if (old) {
                if (typeof old.remove === 'function') old.remove();
                else if (typeof old.removeSubscription === 'function') old.removeSubscription();
                else if (typeof old.unsubscribe === 'function') old.unsubscribe();
              }
            } catch {}
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

        try {
          const old = subscriptionRef.current as any;
          if (old) {
            try {
              if (typeof old.remove === 'function') old.remove();
              else if (typeof old.removeSubscription === 'function') old.removeSubscription();
              else if (typeof old.unsubscribe === 'function') old.unsubscribe();
            } catch {}
          }
        } catch {}
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
      if (retryTimerRef.current != null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      try {
        const s = subscriptionRef.current as any;
        if (s) {
          if (typeof s.remove === 'function') s.remove();
          else if (typeof s.removeSubscription === 'function') s.removeSubscription();
          else if (typeof s.unsubscribe === 'function') s.unsubscribe();
        }
      } catch {}
      subscriptionRef.current = null;
      try {
        const h = headingSubscriptionRef.current as any;
        if (h) {
          if (typeof h.remove === 'function') h.remove();
          else if (typeof h.removeSubscription === 'function') h.removeSubscription();
          else if (typeof h.unsubscribe === 'function') h.unsubscribe();
        }
      } catch {}
      headingSubscriptionRef.current = null;
    };
  }, [computeAndSetTrueHeading, restartToken]);

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

  const requestLocation = useCallback(() => {
    // Force the startup effect to run again; useful when permission/services change
    // or when the user taps a UI control to request location.
    setRestartToken((t) => t + 1);
  }, []);

  return { lastLocation, setLastLocation, permissionStatus, error, magHeading, trueHeading, requestLocation } as const;
}
