import { Gyroscope } from 'expo-sensors';
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

export type GPSOptions = {
  lowPowerMode?: boolean;
};

export function useGPS(options?: GPSOptions) {
  const [lastLocation, setLastLocation] = useState<GPSLocation | null>(null);
  const lastLocationRef = useRef<GPSLocation | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restartToken, setRestartToken] = useState(0);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const gyroSubscriptionRef = useRef<any>(null);
  const retryTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const lowPowerMode = options?.lowPowerMode ?? false;
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
            // Clean up gyroscope subscription
            try {
              const old = gyroSubscriptionRef.current as any;
              if (old && typeof old.remove === 'function') old.remove();
            } catch {}

            let lastHeadingUpdate = 0;
            
            // Fused heading variables
            let fusedMagHeading: number | null = null;
            let lastGyroTime = Date.now();

            Gyroscope.setUpdateInterval(lowPowerMode ? 200 : 32); // ~30 fps or 5 fps
            gyroSubscriptionRef.current = Gyroscope.addListener((gyroData) => {
              if (cancelled) return;
              const now = Date.now();
              const dt = (now - lastGyroTime) / 1000;
              lastGyroTime = now;

              // If we don't have a base heading yet, wait
              if (magHeadingRef.current == null) return;

              // Initialize fused if needed
              if (fusedMagHeading == null) {
                fusedMagHeading = magHeadingRef.current;
              }

              // gyroData.z is rotation rate around Z axis in rad/s.
              // We need to convert it to degrees/sec. 
              // Positive Z rotation on most devices means counter-clockwise (left turn)
              // Heading increases clockwise, so we subtract the Z rotation multiplied by dt
              // Wait, iOS/Android axes might differ slightly, but typically z is the same.
              // Let's assume right-hand rule: turning right (clockwise) -> negative Z rotation rate.
              // Meaning heading (which goes 0 to 360 clockwise) increases as Z goes negative.
              // So delta heading = - (gyroData.z * 180 / Math.PI) * dt
              // Or simply checking typical device: Z is positive when anti-clockwise.
              const gyroDeltaDeg = -(gyroData.z * 180 / Math.PI) * dt;

              // Apply Complementary Filter: 
              // 95% gyroscope (fast, smooth) + 5% magnetometer (absolute, slow)
              const mag = magHeadingRef.current;
              
              // Handle wrap-around for the difference
              let diff = mag - fusedMagHeading;
              if (diff > 180) diff -= 360;
              if (diff < -180) diff += 360;

              // Fuse
              fusedMagHeading = fusedMagHeading + gyroDeltaDeg + 0.05 * diff;
              fusedMagHeading = (fusedMagHeading % 360 + 360) % 360;

              // Update state roughly 15 times a second (66ms) to avoid spamming React too heavily
              if (now - lastHeadingUpdate > (lowPowerMode ? 200 : 66)) {
                lastHeadingUpdate = now;
                setMagHeading(fusedMagHeading);
                
                // If we also track true heading, update it by applying the declination offset
                if (trueHeadingRef.current != null && magHeadingRef.current != null) {
                   const decl = trueHeadingRef.current - magHeadingRef.current;
                   const fTrue = (fusedMagHeading + decl % 360 + 360) % 360;
                   setTrueHeading(fTrue);
                }

                setLastLocation((prev) =>
                  prev
                    ? {
                        ...prev,
                        coords: {
                          ...prev.coords,
                          magHeading: fusedMagHeading,
                          trueHeading: trueHeadingRef.current != null ? (fusedMagHeading + (trueHeadingRef.current - magHeadingRef.current) % 360 + 360) % 360 : prev.coords.trueHeading,
                        },
                      }
                    : prev
                );
              }
            });

            headingSubscriptionRef.current = await Location.watchHeadingAsync((h) => {
              if (cancelled) return;

              const mag = typeof h.magHeading === 'number' && h.magHeading >= 0 ? h.magHeading : null;
              const nativeTrue = typeof h.trueHeading === 'number' && h.trueHeading >= 0 ? h.trueHeading : null;
              
              if (mag != null) magHeadingRef.current = mag;
              if (nativeTrue != null) trueHeadingRef.current = nativeTrue;

              const loc = lastLocationRef.current;
              if (nativeTrue == null && mag != null && loc) {
                // Background compute true heading
                void computeAndSetTrueHeading(mag, loc.coords.latitude, loc.coords.longitude, loc.coords.altitude ?? null);
              }
            });
          } catch {
            // Ignore heading errors; location tracking can still work.
          }
        }

        // Prime with a current position so UI updates quickly.
        try {
          // Use getLastKnownPositionAsync instead of getCurrentPositionAsync 
          // because getCurrentPositionAsync blocks for 5-10 seconds waiting 
          // for a perfect navigation lock before watchPositionAsync can even start!
          const current = await Location.getLastKnownPositionAsync();
          if (!cancelled && current) {
            const next = toGPSLocation(current);
            setLastLocation(next);
            // If we already have a magnetic heading, convert it to true now that we have coordinates
            if (magHeadingRef.current != null && trueHeadingRef.current == null) {
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
            accuracy: lowPowerMode ? Location.Accuracy.Balanced : Location.Accuracy.BestForNavigation,
            distanceInterval: lowPowerMode ? 5 : 1,
            timeInterval: lowPowerMode ? 5000 : 1000,
            mayShowUserSettingsDialog: true,
          },
          async (loc) => {
            if (cancelled) return;
            const next = toGPSLocation(loc);
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
        const sg = gyroSubscriptionRef.current as any;
        if (sg && typeof sg.remove === 'function') sg.remove();
      } catch {}
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
  }, [computeAndSetTrueHeading, restartToken, lowPowerMode]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;

    let lastUpdate = 0;

    const handler = (ev: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const now = Date.now();
      if (lowPowerMode && now - lastUpdate < 500) return;
      if (!lowPowerMode && now - lastUpdate < 100) return;
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
  }, [computeAndSetTrueHeading, lowPowerMode]);

  const requestLocation = useCallback(() => {
    // Force the startup effect to run again; useful when permission/services change
    // or when the user taps a UI control to request location.
    setRestartToken((t) => t + 1);
  }, []);

  return { lastLocation, setLastLocation, permissionStatus, error, magHeading, trueHeading, requestLocation } as const;
}
