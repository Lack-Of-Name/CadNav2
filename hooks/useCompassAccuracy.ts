import { evaluateCompassRules, type CompassAccuracyInput, type CompassRuleResult, type HeadingSample } from '@/lib/compassRules';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGPS } from './gps';
import { computeTilt, useSensors } from './useSensors';
import { useSettings } from './settings';

function shortestDiff(a: number, b: number) {
  let d = ((b - a + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
}

export function useCompassAccuracy(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { lastLocation, magHeading, trueHeading, headingAccuracy, lastHeadingTimestamp, declinationError, lastDeclinationAt, lastDeclinationCoords } = useGPS();
  const { gpsMode, mapHeading } = useSettings();
  const { magnetometer, gyroscope, accelerometer } = useSensors({ enabled });

  const [now, setNow] = useState(() => Date.now());
  const historyRef = useRef<HeadingSample[]>([]);
  const gyroYawRef = useRef<number | null>(null);
  const lastGyroTsRef = useRef<number | null>(null);
  const gyroRateDegPerSecRef = useRef<number | null>(null);

  // Tick now every 800ms to re-evaluate staleness
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), 800);
    return () => clearInterval(id);
  }, [enabled]);

  // Push heading samples when heading changes
  useEffect(() => {
    const h = magHeading ?? trueHeading;
    if (h == null) return;
    const ts = lastHeadingTimestamp ?? Date.now();
    const arr = historyRef.current;
    // avoid duplicate timestamp
    if (arr.length > 0 && arr[arr.length - 1].timestamp === ts && arr[arr.length - 1].heading === h) return;
    arr.push({ heading: h, timestamp: ts });
    // keep last 80 (~ 8s at 10Hz, but our heading is ~ variable)
    if (arr.length > 80) arr.splice(0, arr.length - 80);
    // trim old > 10s
    const cutoff = Date.now() - 10000;
    while (arr.length > 0 && arr[0].timestamp < cutoff) arr.shift();
    // force re-render via now update (debounced)
    // we update now quickly after heading to reflect immediately
    setNow(Date.now());
  }, [magHeading, trueHeading, lastHeadingTimestamp]);

  // Integrate gyro Z around vertical to estimate yaw (very approximate)
  // We use gyroscope.z (rad/s) as yaw rate. Integrate dt.
  // Reset integration when mag heading available to avoid drift: complement.
  useEffect(() => {
    if (!gyroscope) return;
    const g = gyroscope;
    const ts = g.timestamp;
    if (lastGyroTsRef.current == null) {
      lastGyroTsRef.current = ts;
      if (gyroYawRef.current == null && magHeading != null) {
        gyroYawRef.current = magHeading;
      }
      return;
    }
    const dtSec = (ts - lastGyroTsRef.current!) / 1000;
    lastGyroTsRef.current = ts;
    if (dtSec <= 0 || dtSec > 0.5) {
      // gap too large - re-seed
      if (magHeading != null) gyroYawRef.current = magHeading;
      return;
    }
    const rateDegPerSec = g.z * (180 / Math.PI); // rad/s -> deg/s; z is yaw for portrait approx
    gyroRateDegPerSecRef.current = rateDegPerSec;
    if (gyroYawRef.current == null) {
      if (magHeading != null) gyroYawRef.current = magHeading;
      else gyroYawRef.current = 0;
    } else {
      gyroYawRef.current = (gyroYawRef.current + rateDegPerSec * dtSec) % 360;
      if (gyroYawRef.current < 0) gyroYawRef.current += 360;
      // gently nudge toward mag if available (complementary 2% weight) to prevent drift when stable
      if (magHeading != null && Math.abs(rateDegPerSec) < 2) {
        const diff = shortestDiff(gyroYawRef.current, magHeading);
        gyroYawRef.current = (gyroYawRef.current + diff * 0.02 + 360) % 360;
      }
    }
  }, [gyroscope, magHeading]);

  // When magHeading jumps after long stale, resync gyro yaw
  useEffect(() => {
    if (magHeading != null && gyroYawRef.current != null) {
      const diff = Math.abs(shortestDiff(gyroYawRef.current, magHeading));
      if (diff > 45) {
        // large divergence -> we keep divergence as R07 signal, but also slowly adapt?
        // Do not immediately resync, let R07 fire. Only resync if stationary long.
      }
    }
  }, [magHeading]);

  const results: CompassRuleResult[] = useMemo(() => {
    if (!enabled) return [];
    const input: CompassAccuracyInput = {
      magHeading,
      trueHeading,
      headingAccuracy: headingAccuracy ?? null,
      lastHeadingAt: lastHeadingTimestamp ?? null,
      lastLocation: lastLocation ?? null,
      gpsMode,
      mapHeadingPreference: mapHeading,
      declinationError: declinationError ?? null,
      lastDeclinationAt: lastDeclinationAt ?? null,
      lastDeclinationCoords: lastDeclinationCoords ?? null,
      history: [...historyRef.current],
      magnetometer: magnetometer ?? null,
      gyroscope: gyroscope ?? null,
      accelerometer: accelerometer ?? null,
      gyroYawDeg: gyroYawRef.current,
      gyroLastRateDegPerSec: gyroRateDegPerSecRef.current,
      now,
    };
    return evaluateCompassRules(input);
  }, [
    enabled,
    magHeading,
    trueHeading,
    headingAccuracy,
    lastHeadingTimestamp,
    lastLocation,
    gpsMode,
    mapHeading,
    declinationError,
    lastDeclinationAt,
    lastDeclinationCoords,
    magnetometer,
    gyroscope,
    accelerometer,
    now,
  ]);

  const activeRules = useMemo(() => results.filter((r) => r.active), [results]);
  // R16 is 'info' severity - we do NOT want the orange dot for info alone.
  // Only warn/critical should drive the visible indicator. This avoids permanent dot in powerSave.
  const rawWarningRules = useMemo(() => activeRules.filter((r) => r.severity !== 'info'), [activeRules]);

  // --- Smoothing: debounce rapid toggling to avoid jarring pop in/out ---
  // Warnings must be continuously active for ACTIVATION_DELAY before they appear,
  // and continuously inactive for DEACTIVATION_DELAY before they disappear.
  const ACTIVATION_DELAY = 1400; // ms - slightly longer to filter brief jitter/drift spikes
  const DEACTIVATION_DELAY = 2200;
  const [smoothedWarnings, setSmoothedWarnings] = useState<CompassRuleResult[]>([]);
  const pendingRef = useRef<Map<string, { targetActive: boolean; since: number; timeout: ReturnType<typeof setTimeout> | null }>>(new Map<string, { targetActive: boolean; since: number; timeout: ReturnType<typeof setTimeout> | null }>());
  const displayedRef = useRef<Map<string, CompassRuleResult>>(new Map<string, CompassRuleResult>());

  // sync displayedRef from smoothedWarnings
  useEffect(() => {
    displayedRef.current = new Map<string, CompassRuleResult>(smoothedWarnings.map((r) => [r.id, r]));
  }, [smoothedWarnings]);

  useEffect(() => {
    const rawMap = new Map<string, CompassRuleResult>(rawWarningRules.map((r) => [r.id, r]));
    const displayed = displayedRef.current as Map<string, CompassRuleResult>;
    const pending = pendingRef.current;

    // For each possible rule id (union), decide
    const allIds = new Set<string>([...Array.from(rawMap.keys()), ...Array.from(displayed.keys()), ...Array.from(pending.keys())]);

    allIds.forEach((id) => {
      const rawActive = rawMap.has(id);
      const displayedActive = displayed.has(id);
      const pendingEntry = pending.get(id);

      if (rawActive === displayedActive) {
        // No transition needed - cancel any pending
        if (pendingEntry) {
          if (pendingEntry.timeout) clearTimeout(pendingEntry.timeout);
          pending.delete(id);
        }
        // Keep displayed detail fresh without forcing a re-render debounce - update map silently
        if (rawActive && displayedActive) {
          const prev = displayed.get(id);
          const next = rawMap.get(id)!;
          // Only update if detail changed to avoid render loops from 800ms ticks
          if (prev?.detail !== next.detail || prev?.severity !== next.severity || prev?.message !== next.message) {
            displayed.set(id, next);
            // Trigger a lightweight state sync without debounce
            setSmoothedWarnings(Array.from(displayed.values()));
          }
        }
        return;
      }

      // Transition needed (rawActive != displayedActive)
      const targetActive = rawActive;
      // If pending already matches target, keep waiting
      if (pendingEntry && pendingEntry.targetActive === targetActive) {
        return;
      }
      // Otherwise start/restart pending
      if (pendingEntry && pendingEntry.timeout) clearTimeout(pendingEntry.timeout);

      const delay = targetActive ? ACTIVATION_DELAY : DEACTIVATION_DELAY;
      const timeout = setTimeout(() => {
        const curDisplayed = displayedRef.current;
        if (targetActive) {
          const rule = rawMap.get(id) ?? pendingRef.current.get(id) as any;
          // Re-check raw still matches target at fire time (effect will re-run, but double-check)
          // Use latest rawMap captured in closure? Need to fetch fresh - use timeout closure stale; instead rely on effect re-evaluation,
          // but we will just apply and let next effect correct if stale.
          const latestRaw = rawMap.has(id);
          if (latestRaw) {
            curDisplayed.set(id, rawMap.get(id)!);
          }
        } else {
          curDisplayed.delete(id);
        }
        pending.delete(id);
        setSmoothedWarnings(Array.from(curDisplayed.values()));
      }, delay);

      pending.set(id, { targetActive, since: Date.now(), timeout });
    });

    // cleanup on unmount
    return () => {
      // don't clear pending here - they are ongoing transitions; they will be cleared on next effect or unmount
    };
  }, [rawWarningRules]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((e) => {
        if (e.timeout) clearTimeout(e.timeout);
      });
      pendingRef.current.clear();
    };
  }, []);

  const warningRules = smoothedWarnings;
  const hasWarning = warningRules.length > 0;
  const hasCritical = warningRules.some((r) => r.severity === 'critical');
  const count = warningRules.length;

  // tilt helper for display
  const tilt = useMemo(() => computeTilt(accelerometer ?? null), [accelerometer]);

  return {
    results,
    activeRules,
    warningRules,
    rawWarningRules,
    hasWarning,
    hasCritical,
    count,
    totalActive: activeRules.length,
    history: historyRef.current,
    sensor: { magnetometer, gyroscope, accelerometer, tilt, gyroYaw: gyroYawRef.current, gyroRate: gyroRateDegPerSecRef.current },
  } as const;
}
