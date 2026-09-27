// NOTE: Do NOT statically import 'expo-sensors' (barrel or subpaths).
// Every expo-sensors native wrapper calls requireNativeModule() at module load,
// so any static import crashes the whole route tree on runtimes without that
// native module (e.g. ExponentPedometer / ExponentAccelerometer missing on some
// emulators or stale dev builds). All sensors are loaded lazily below with
// requireOptionalNativeModule() guards and degrade to "unavailable".
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

const sensorCache: Record<string, any> = {};

// Metro only allows require() with a static string literal, so each sensor has
// its own loader. Modules stay unevaluated until first call, and the
// requireOptionalNativeModule() guard runs first so missing natives bail to
// null instead of throwing from the wrapper's top-level requireNativeModule().
function loadSensorModule(nativeName: string, key: string, loader: () => any): any | null {
  if (sensorCache[key] !== undefined) return sensorCache[key];
  try {
    if (!requireOptionalNativeModule(nativeName)) {
      sensorCache[key] = null;
      return null;
    }
    const mod = loader();
    const sensor = mod?.default ?? mod ?? null;
    sensorCache[key] = sensor;
    return sensor;
  } catch {
    sensorCache[key] = null;
    return null;
  }
}

/* eslint-disable @typescript-eslint/no-require-imports */
const getAccelerometer = () =>
  loadSensorModule('ExponentAccelerometer', 'accelerometer', () => require('expo-sensors/build/Accelerometer'));
const getBarometer = () =>
  loadSensorModule('ExpoBarometer', 'barometer', () => require('expo-sensors/build/Barometer'));
const getDeviceMotion = () =>
  loadSensorModule('ExponentDeviceMotion', 'deviceMotion', () => require('expo-sensors/build/DeviceMotion'));
const getGyroscope = () =>
  loadSensorModule('ExponentGyroscope', 'gyroscope', () => require('expo-sensors/build/Gyroscope'));
const getLightSensor = () =>
  loadSensorModule('ExpoLightSensor', 'lightSensor', () => require('expo-sensors/build/LightSensor'));
const getMagnetometer = () =>
  loadSensorModule('ExponentMagnetometer', 'magnetometer', () => require('expo-sensors/build/Magnetometer'));
const getMagnetometerUncalibrated = () =>
  loadSensorModule(
    'ExponentMagnetometerUncalibrated',
    'magnetometerUncalibrated',
    () => require('expo-sensors/build/MagnetometerUncalibrated'),
  );
/* eslint-enable @typescript-eslint/no-require-imports */

export type MagnetometerData = {
  x: number;
  y: number;
  z: number;
  magnitude: number;
  timestamp: number;
};

export type GyroscopeData = {
  x: number;
  y: number;
  z: number;
  timestamp: number;
};

export type AccelerometerData = {
  x: number;
  y: number;
  z: number;
  timestamp: number;
};

export type BarometerData = {
  pressure: number; // hPa
  relativeAltitude?: number | null; // m, iOS only
  timestamp: number;
};

export type LightSensorData = {
  illuminance: number; // lux
  timestamp: number;
};

export type DeviceMotionData = {
  acceleration: { x: number; y: number; z: number } | null;
  accelerationIncludingGravity: { x: number; y: number; z: number };
  rotation: { alpha: number; beta: number; gamma: number }; // deg
  rotationRate: { alpha: number; beta: number; gamma: number } | null; // deg/s
  orientation: number; // 0, 90, 180, -90
  interval: number; // ms
  timestamp: number;
};

export type MagnetometerUncalibratedData = {
  x: number;
  y: number;
  z: number;
  timestamp: number;
};

export type SensorState = {
  magnetometer: MagnetometerData | null;
  gyroscope: GyroscopeData | null;
  accelerometer: AccelerometerData | null;
  barometer: BarometerData | null;
  lightSensor: LightSensorData | null;
  deviceMotion: DeviceMotionData | null;
  magnetometerUncalibrated: MagnetometerUncalibratedData | null;
  isMagnetometerAvailable: boolean | null;
  isGyroscopeAvailable: boolean | null;
  isAccelerometerAvailable: boolean | null;
  isBarometerAvailable: boolean | null;
  isLightSensorAvailable: boolean | null;
  isDeviceMotionAvailable: boolean | null;
  isMagnetometerUncalibratedAvailable: boolean | null;
};

function magnitude(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Subscribes to device sensors via expo-sensors.
 * Battery aware: only magnetometer / accelerometer / gyroscope are active by default.
 * Barometer, LightSensor, DeviceMotion and MagnetometerUncalibrated are off unless
 * explicitly enabled. This keeps idle battery use near zero.
 * Safe on web / when sensors are unavailable - simply reports null data.
 */
export function useSensors(options?: {
  enabled?: boolean;
  enableMagnetometer?: boolean;
  enableGyroscope?: boolean;
  enableAccelerometer?: boolean;
  enableBarometer?: boolean;
  enableLightSensor?: boolean;
  enableDeviceMotion?: boolean;
  enableMagnetometerUncalibrated?: boolean;
  magnetometerInterval?: number;
  gyroscopeInterval?: number;
  accelerometerInterval?: number;
  barometerInterval?: number;
  lightSensorInterval?: number;
  deviceMotionInterval?: number;
  magnetometerUncalibratedInterval?: number;
}) {
  const enabled = options?.enabled ?? true;
  const enableMag = options?.enableMagnetometer ?? true;
  const enableGyro = options?.enableGyroscope ?? true;
  const enableAccel = options?.enableAccelerometer ?? true;
  const enableBaro = options?.enableBarometer ?? false;
  const enableLight = options?.enableLightSensor ?? false;
  const enableMotion = options?.enableDeviceMotion ?? false;
  const enableMagUncal = options?.enableMagnetometerUncalibrated ?? false;
  const magInterval = options?.magnetometerInterval ?? 200;
  const gyroInterval = options?.gyroscopeInterval ?? 200;
  const accelInterval = options?.accelerometerInterval ?? 200;
  const baroInterval = options?.barometerInterval ?? 1000;
  const lightInterval = options?.lightSensorInterval ?? 1000;
  const motionInterval = options?.deviceMotionInterval ?? 200;
  const magUncalInterval = options?.magnetometerUncalibratedInterval ?? 200;

  const [magnetometer, setMagnetometer] = useState<MagnetometerData | null>(null);
  const [gyroscope, setGyroscope] = useState<GyroscopeData | null>(null);
  const [accelerometer, setAccelerometer] = useState<AccelerometerData | null>(null);
  const [barometer, setBarometer] = useState<BarometerData | null>(null);
  const [lightSensor, setLightSensor] = useState<LightSensorData | null>(null);
  const [deviceMotion, setDeviceMotion] = useState<DeviceMotionData | null>(null);
  const [magnetometerUncalibrated, setMagnetometerUncalibrated] = useState<MagnetometerUncalibratedData | null>(null);
  const [isMagnetometerAvailable, setIsMagnetometerAvailable] = useState<boolean | null>(null);
  const [isGyroscopeAvailable, setIsGyroscopeAvailable] = useState<boolean | null>(null);
  const [isAccelerometerAvailable, setIsAccelerometerAvailable] = useState<boolean | null>(null);
  const [isBarometerAvailable, setIsBarometerAvailable] = useState<boolean | null>(null);
  const [isLightSensorAvailable, setIsLightSensorAvailable] = useState<boolean | null>(null);
  const [isDeviceMotionAvailable, setIsDeviceMotionAvailable] = useState<boolean | null>(null);
  const [isMagnetometerUncalibratedAvailable, setIsMagnetometerUncalibratedAvailable] = useState<boolean | null>(null);

  const magSub = useRef<any>(null);
  const gyroSub = useRef<any>(null);
  const accelSub = useRef<any>(null);
  const baroSub = useRef<any>(null);
  const lightSub = useRef<any>(null);
  const motionSub = useRef<any>(null);
  const magUncalSub = useRef<any>(null);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;

    let cancelled = false;

    void (async () => {
      try {
        const safeCheck = (loader: () => any | null): Promise<boolean> => {
          try {
            const sensor = loader();
            if (!sensor?.isAvailableAsync) return Promise.resolve(false);
            return sensor.isAvailableAsync().catch(() => false);
          } catch {
            return Promise.resolve(false);
          }
        };
        const checks: Promise<boolean>[] = [];
        if (enableMag) checks.push(safeCheck(getMagnetometer)); else { setIsMagnetometerAvailable(null); checks.push(Promise.resolve(false)); }
        if (enableGyro) checks.push(safeCheck(getGyroscope)); else { setIsGyroscopeAvailable(null); checks.push(Promise.resolve(false)); }
        if (enableAccel) checks.push(safeCheck(getAccelerometer)); else { setIsAccelerometerAvailable(null); checks.push(Promise.resolve(false)); }
        if (enableBaro) checks.push(safeCheck(getBarometer)); else { setIsBarometerAvailable(null); checks.push(Promise.resolve(false)); }
        if (enableLight) checks.push(safeCheck(getLightSensor)); else { setIsLightSensorAvailable(null); checks.push(Promise.resolve(false)); }
        if (enableMotion) checks.push(safeCheck(getDeviceMotion)); else { setIsDeviceMotionAvailable(null); checks.push(Promise.resolve(false)); }
        if (enableMagUncal) checks.push(safeCheck(getMagnetometerUncalibrated)); else { setIsMagnetometerUncalibratedAvailable(null); checks.push(Promise.resolve(false)); }

        const [m, g, a, b, l, dm, mu] = await Promise.all(checks);
        if (cancelled) return;
        if (enableMag) setIsMagnetometerAvailable(m);
        if (enableGyro) setIsGyroscopeAvailable(g);
        if (enableAccel) setIsAccelerometerAvailable(a);
        if (enableBaro) setIsBarometerAvailable(b);
        if (enableLight) setIsLightSensorAvailable(l);
        if (enableMotion) setIsDeviceMotionAvailable(dm);
        if (enableMagUncal) setIsMagnetometerUncalibratedAvailable(mu);
      } catch {
        // ignore availability errors
      }
    })();

    return () => { cancelled = true; };
  }, [enabled, enableMag, enableGyro, enableAccel, enableBaro, enableLight, enableMotion, enableMagUncal]);

  useEffect(() => {
    if (!enabled || !enableMag || Platform.OS === 'web') return;
    if (isMagnetometerAvailable === false) return;
    const Magnetometer = getMagnetometer();
    if (!Magnetometer) { setIsMagnetometerAvailable(false); return; }

    try {
      Magnetometer.setUpdateInterval(magInterval);
    } catch {}
    let sub: any = null;
    try {
      sub = Magnetometer.addListener((data: any) => {
        // data.timestamp is seconds (expo), convert to ms
        const ts = typeof data.timestamp === 'number' ? (data.timestamp > 1e12 ? data.timestamp : data.timestamp * 1000) : Date.now();
        setMagnetometer({
          x: data.x,
          y: data.y,
          z: data.z,
          magnitude: magnitude(data.x, data.y, data.z),
          timestamp: ts,
        });
      });
    } catch { return; }
    magSub.current = sub;
    return () => {
      try { sub.remove(); } catch { try { Magnetometer.removeAllListeners(); } catch {} }
      magSub.current = null;
    };
  }, [enabled, enableMag, isMagnetometerAvailable, magInterval]);

  useEffect(() => {
    if (!enabled || !enableGyro || Platform.OS === 'web') return;
    if (isGyroscopeAvailable === false) return;
    const Gyroscope = getGyroscope();
    if (!Gyroscope) { setIsGyroscopeAvailable(false); return; }

    try { Gyroscope.setUpdateInterval(gyroInterval); } catch {}
    let sub: any = null;
    try {
      sub = Gyroscope.addListener((data: any) => {
        const ts = typeof data.timestamp === 'number' ? (data.timestamp > 1e12 ? data.timestamp : data.timestamp * 1000) : Date.now();
        setGyroscope({ x: data.x, y: data.y, z: data.z, timestamp: ts });
      });
    } catch { return; }
    gyroSub.current = sub;
    return () => {
      try { sub.remove(); } catch { try { Gyroscope.removeAllListeners(); } catch {} }
      gyroSub.current = null;
    };
  }, [enabled, enableGyro, isGyroscopeAvailable, gyroInterval]);

  useEffect(() => {
    if (!enabled || !enableAccel || Platform.OS === 'web') return;
    if (isAccelerometerAvailable === false) return;
    const Accelerometer = getAccelerometer();
    if (!Accelerometer) { setIsAccelerometerAvailable(false); return; }

    try { Accelerometer.setUpdateInterval(accelInterval); } catch {}
    let sub: any = null;
    try {
      sub = Accelerometer.addListener((data: any) => {
        const ts = typeof data.timestamp === 'number' ? (data.timestamp > 1e12 ? data.timestamp : data.timestamp * 1000) : Date.now();
        setAccelerometer({ x: data.x, y: data.y, z: data.z, timestamp: ts });
      });
    } catch { return; }
    accelSub.current = sub;
    return () => {
      try { sub.remove(); } catch { try { Accelerometer.removeAllListeners(); } catch {} }
      accelSub.current = null;
    };
  }, [enabled, enableAccel, isAccelerometerAvailable, accelInterval]);

  // Barometer: pressure in hPa; relativeAltitude (iOS only) - off by default
  useEffect(() => {
    if (!enabled || !enableBaro || Platform.OS === 'web') return;
    if (isBarometerAvailable === false) return;
    const Barometer = getBarometer();
    if (!Barometer) { setIsBarometerAvailable(false); return; }
    try { Barometer.setUpdateInterval(baroInterval); } catch {}
    let sub: any = null;
    try {
      sub = Barometer.addListener((data: any) => {
        const ts = typeof data.timestamp === 'number' ? (data.timestamp > 1e12 ? data.timestamp : data.timestamp * 1000) : Date.now();
        setBarometer({ pressure: data.pressure, relativeAltitude: (data as any).relativeAltitude ?? null, timestamp: ts });
      });
    } catch { return; }
    baroSub.current = sub;
    return () => {
      try { sub.remove(); } catch { try { Barometer.removeAllListeners(); } catch {} }
      baroSub.current = null;
    };
  }, [enabled, enableBaro, isBarometerAvailable, baroInterval]);

  // LightSensor: Android only, lux - off by default
  useEffect(() => {
    if (!enabled || !enableLight || Platform.OS === 'web') return;
    if (isLightSensorAvailable === false) return;
    const LightSensor = getLightSensor();
    if (!LightSensor) { setIsLightSensorAvailable(false); return; }
    try { (LightSensor as any).setUpdateInterval?.(lightInterval); } catch {}
    let sub: any = null;
    try { sub = LightSensor.addListener((data: any) => {
      const ts = typeof (data as any).timestamp === 'number' ? ((data as any).timestamp > 1e12 ? (data as any).timestamp : (data as any).timestamp * 1000) : Date.now();
      setLightSensor({ illuminance: (data as any).illuminance, timestamp: ts });
    }); } catch { return; }
    lightSub.current = sub;
    return () => {
      try { sub?.remove(); } catch { try { LightSensor.removeAllListeners(); } catch {} }
      lightSub.current = null;
    };
  }, [enabled, enableLight, isLightSensorAvailable, lightInterval]);

  // DeviceMotion: fused motion (accel + gyro + orientation) - off by default
  useEffect(() => {
    if (!enabled || !enableMotion || Platform.OS === 'web') return;
    if (isDeviceMotionAvailable === false) return;
    const DeviceMotion = getDeviceMotion();
    if (!DeviceMotion) { setIsDeviceMotionAvailable(false); return; }
    try { DeviceMotion.setUpdateInterval(motionInterval); } catch {}
    let sub: any = null;
    try {
      sub = DeviceMotion.addListener((data: any) => {
        const ts = Date.now(); // DeviceMotion often lacks top-level timestamp
        setDeviceMotion({
          acceleration: data.acceleration ?? null,
          accelerationIncludingGravity: data.accelerationIncludingGravity,
          rotation: data.rotation ?? { alpha: 0, beta: 0, gamma: 0 },
          rotationRate: data.rotationRate ?? null,
          orientation: data.orientation ?? 0,
          interval: data.interval ?? motionInterval,
          timestamp: ts,
        });
      });
    } catch { return; }
    motionSub.current = sub;
    return () => {
      try { sub.remove(); } catch { try { DeviceMotion.removeAllListeners(); } catch {} }
      motionSub.current = null;
    };
  }, [enabled, enableMotion, isDeviceMotionAvailable, motionInterval]);

  // MagnetometerUncalibrated: raw without hard-iron calibration - off by default
  useEffect(() => {
    if (!enabled || !enableMagUncal || Platform.OS === 'web') return;
    if (isMagnetometerUncalibratedAvailable === false) return;
    const MagnetometerUncalibrated = getMagnetometerUncalibrated();
    if (!MagnetometerUncalibrated) { setIsMagnetometerUncalibratedAvailable(false); return; }
    try { MagnetometerUncalibrated.setUpdateInterval(magUncalInterval); } catch {}
    let sub: any = null;
    try {
      sub = MagnetometerUncalibrated.addListener((data: any) => {
        const ts = typeof data.timestamp === 'number' ? (data.timestamp > 1e12 ? data.timestamp : data.timestamp * 1000) : Date.now();
        setMagnetometerUncalibrated({ x: data.x, y: data.y, z: data.z, timestamp: ts });
      });
    } catch { return; }
    magUncalSub.current = sub;
    return () => {
      try { sub.remove(); } catch { try { MagnetometerUncalibrated.removeAllListeners(); } catch {} }
      magUncalSub.current = null;
    };
  }, [enabled, enableMagUncal, isMagnetometerUncalibratedAvailable, magUncalInterval]);

  return {
    magnetometer,
    gyroscope,
    accelerometer,
    barometer,
    lightSensor,
    deviceMotion,
    magnetometerUncalibrated,
    isMagnetometerAvailable,
    isGyroscopeAvailable,
    isAccelerometerAvailable,
    isBarometerAvailable,
    isLightSensorAvailable,
    isDeviceMotionAvailable,
    isMagnetometerUncalibratedAvailable,
  } as SensorState;
}

/** Compute pitch / roll in degrees from accelerometer (gravity vector). Returns null if accel unavailable. */
export function computeTilt(accel: AccelerometerData | null): { pitch: number; roll: number; magnitude: number } | null {
  if (!accel) return null;
  const { x, y, z } = accel;
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (mag < 0.1) return null;
  // Pitch = rotation around X, Roll around Y. Using standard accel formula.
  // Level = camera (back) facing ground (screen facing sky). Previous formula had it inverted
  // (level when camera faced sky); rotate 180 by inverting Z/Y so flat screen-up is level.
  const pitch = Math.atan2(-y, Math.sqrt(x * x + z * z)) * (180 / Math.PI);
  const roll = Math.atan2(-x, -z) * (180 / Math.PI);
  return { pitch, roll, magnitude: mag };
}
