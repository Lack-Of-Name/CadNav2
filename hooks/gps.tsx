import * as Location from 'expo-location';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { getMagneticDeclination } from '../components/map/converter';
import { SettingsContext, type GpsMode } from './settings';

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

export type GPSOptions = {
  gpsMode?: GpsMode;
};

/**
 * Resolve the authoritative heading to display, honouring the user's
 * true/magnetic preference but falling back to whichever the device actually
 * provides. Android returns no native trueHeading, so a "true" preference must
 * still yield *something* (magnetic) until a true heading can be computed —
 * otherwise the compass appears frozen on every power setting.
 *
 * Returns { value, reference } where reference reflects what we actually used.
 */
export function resolveDisplayHeading(
  preference: 'true' | 'magnetic',
  mag: number | null,
  trueH: number | null,
): { value: number; reference: 'true' | 'magnetic' } | null {
  if (preference === 'magnetic') {
    if (typeof mag === 'number') return { value: mag, reference: 'magnetic' };
    if (typeof trueH === 'number') return { value: trueH, reference: 'true' };
    return null;
  }
  // preference === 'true'
  if (typeof trueH === 'number') return { value: trueH, reference: 'true' };
  if (typeof mag === 'number') return { value: mag, reference: 'magnetic' };
  return null;
}

const GPS_MODE_CONFIG: Record<GpsMode, {
  accuracy: Location.Accuracy;
  distanceInterval: number;
  timeInterval: number;
  useFreshFix: boolean;
  maxAccuracy?: number;
}> = {
  highAccuracy: {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 1,
    timeInterval: 1000,
    useFreshFix: false,
  },
  gpsOnly: {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 0,
    timeInterval: 500,
    useFreshFix: true,
    maxAccuracy: 50,
  },
  powerSave: {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 10,
    timeInterval: 10000,
    useFreshFix: false,
  },
  super: {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 50,
    timeInterval: 30000,
    useFreshFix: false,
  },
};

export function useGPS(options?: GPSOptions) {
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

  const settingsCtx = useContext(SettingsContext);
  const settingsGpsMode = settingsCtx?.settings.gpsMode ?? 'highAccuracy';
  const gpsMode = options?.gpsMode ?? settingsGpsMode;
  const config = GPS_MODE_CONFIG[gpsMode];

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

              const mag = typeof h.magHeading === 'number' && h.magHeading >= 0 ? h.magHeading : null;
              const nativeTrue = typeof h.trueHeading === 'number' && h.trueHeading >= 0 ? h.trueHeading : null;

              const prevMag = magHeadingRef.current;
              const prevTrue = trueHeadingRef.current;

              if (mag != null) {
                magHeadingRef.current = mag;
                setMagHeading(mag);
              }
              if (nativeTrue != null) {
                trueHeadingRef.current = nativeTrue;
                setTrueHeading(nativeTrue);
              }

              const loc = lastLocationRef.current;
              if (nativeTrue == null && mag != null && loc) {
                // Background compute true heading (Android returns no native trueHeading).
                void computeAndSetTrueHeading(mag, loc.coords.latitude, loc.coords.longitude, loc.coords.altitude ?? null);
              }

              // Push heading-only updates into lastLocation so the compass UI
              // re-renders immediately, regardless of the position watch interval.
              // Trigger when EITHER mag or true changed so a true-only update still
              // propagates (e.g. computed-true resolving after a location fix).
              const headingChanged = mag !== prevMag || trueHeadingRef.current !== prevTrue;
              if (headingChanged && lastLocationRef.current) {
                setLastLocation((prev) =>
                  prev
                    ? {
                        ...prev,
                        coords: {
                          ...prev.coords,
                          magHeading: magHeadingRef.current,
                          trueHeading: trueHeadingRef.current,
                        },
                      }
                    : prev
                );
              }
            });
          } catch {
            // Ignore heading errors; location tracking can still work.
          }
        }

        // Prime with a current position so UI updates quickly.
        if (config.useFreshFix) {
          // gpsOnly: skip cached positions, wait for a fresh GPS fix
          try {
            const current = await Location.getCurrentPositionAsync({
              accuracy: config.accuracy,
              mayShowUserSettingsDialog: true,
            });
            if (!cancelled && current) {
              const next = toGPSLocation(current);
              setLastLocation(next);
              if (magHeadingRef.current != null && trueHeadingRef.current == null) {
                void computeAndSetTrueHeading(magHeadingRef.current as number, next.coords.latitude, next.coords.longitude, next.coords.altitude ?? null);
              }
            }
          } catch {
            // If fresh fix fails, watcher will still provide updates
          }
        } else {
          // highAccuracy / powerSave: use last known for fast initial position
          try {
            const current = await Location.getLastKnownPositionAsync();
            if (!cancelled && current) {
              const next = toGPSLocation(current);
              setLastLocation(next);
              if (magHeadingRef.current != null && trueHeadingRef.current == null) {
                void computeAndSetTrueHeading(magHeadingRef.current as number, next.coords.latitude, next.coords.longitude, next.coords.altitude ?? null);
              }
            }
          } catch {
            // Ignore: watchPositionAsync below will still update.
          }
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
            accuracy: config.accuracy,
            distanceInterval: config.distanceInterval,
            timeInterval: config.timeInterval,
            mayShowUserSettingsDialog: true,
          },
          async (loc) => {
            if (cancelled) return;
            const next = toGPSLocation(loc);
            // In gpsOnly mode, skip low-accuracy fixes when we already have a better one
            if (gpsMode === 'gpsOnly' && config.maxAccuracy != null && loc.coords.accuracy != null) {
              const bestAccuracy = lastLocationRef.current?.coords?.accuracy;
              if (bestAccuracy != null && loc.coords.accuracy > bestAccuracy && loc.coords.accuracy > config.maxAccuracy) {
                return;
              }
            }
            setLastLocation(next);
            // Convert any existing magnetic heading to true using updated location
            if (magHeadingRef.current != null && trueHeadingRef.current == null) {
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
  }, [computeAndSetTrueHeading, restartToken, gpsMode, config.accuracy, config.distanceInterval, config.timeInterval, config.useFreshFix, config.maxAccuracy]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;

    let lastUpdate = 0;

    const handler = (ev: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const now = Date.now();
      if (gpsMode === 'powerSave' && now - lastUpdate < 500) return;
      if (gpsMode !== 'powerSave' && now - lastUpdate < 100) return;
      lastUpdate = now;

      const mag = (ev as any).webkitCompassHeading ?? ev.alpha;
      if (mag == null) return;
      
      const prevMag = magHeadingRef.current;
      if (prevMag != null && Math.abs(mag - prevMag) < 1) return;
      
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
  }, [computeAndSetTrueHeading, gpsMode]);

  const requestLocation = useCallback(() => {
    // Force the startup effect to run again; useful when permission/services change
    // or when the user taps a UI control to request location.
    setRestartToken((t) => t + 1);
  }, []);

  const requestFreshFix = useCallback(async () => {
    // Get a fresh one-shot position fix, bypassing the watcher interval.
    // Useful in low-power modes when the user wants an immediate update.
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        mayShowUserSettingsDialog: false,
      });
      if (!loc) return;
      const next: GPSLocation = {
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
      lastLocationRef.current = next;
      setLastLocation(next);
      // Re-compute true heading with fresh coords
      if (magHeadingRef.current != null && trueHeadingRef.current == null) {
        void computeAndSetTrueHeading(magHeadingRef.current, next.coords.latitude, next.coords.longitude, next.coords.altitude ?? null);
      }
    } catch {
      // If fresh fix fails, user can try again
    }
  }, [computeAndSetTrueHeading]);

  return { lastLocation, setLastLocation, permissionStatus, error, magHeading, trueHeading, requestLocation, requestFreshFix } as const;
}
