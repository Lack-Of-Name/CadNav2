import {
  Accelerometer,
  Barometer,
  DeviceMotion,
  Gyroscope,
  LightSensor,
  Magnetometer,
  MagnetometerUncalibrated,
} from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

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
        const checks: Promise<boolean>[] = [];
        if (enableMag) checks.push(Magnetometer.isAvailableAsync().catch(() => false)); else { setIsMagnetometerAvailable(null); checks.push(Promise.resolve(false)); }
        if (enableGyro) checks.push(Gyroscope.isAvailableAsync().catch(() => false)); else { setIsGyroscopeAvailable(null); checks.push(Promise.resolve(false)); }
        if (enableAccel) checks.push(Accelerometer.isAvailableAsync().catch(() => false)); else { setIsAccelerometerAvailable(null); checks.push(Promise.resolve(false)); }
        if (enableBaro) checks.push(Barometer.isAvailableAsync().catch(() => false)); else { setIsBarometerAvailable(null); checks.push(Promise.resolve(false)); }
        if (enableLight) checks.push(LightSensor.isAvailableAsync().catch(() => false)); else { setIsLightSensorAvailable(null); checks.push(Promise.resolve(false)); }
        if (enableMotion) checks.push(DeviceMotion.isAvailableAsync().catch(() => false)); else { setIsDeviceMotionAvailable(null); checks.push(Promise.resolve(false)); }
        if (enableMagUncal) checks.push(MagnetometerUncalibrated.isAvailableAsync().catch(() => false)); else { setIsMagnetometerUncalibratedAvailable(null); checks.push(Promise.resolve(false)); }

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

    try {
      Magnetometer.setUpdateInterval(magInterval);
    } catch {}
    const sub = Magnetometer.addListener((data) => {
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
    magSub.current = sub;
    return () => {
      try { sub.remove(); } catch { try { Magnetometer.removeAllListeners(); } catch {} }
      magSub.current = null;
    };
  }, [enabled, enableMag, isMagnetometerAvailable, magInterval]);

  useEffect(() => {
    if (!enabled || !enableGyro || Platform.OS === 'web') return;
    if (isGyroscopeAvailable === false) return;

    try { Gyroscope.setUpdateInterval(gyroInterval); } catch {}
    const sub = Gyroscope.addListener((data) => {
      const ts = typeof data.timestamp === 'number' ? (data.timestamp > 1e12 ? data.timestamp : data.timestamp * 1000) : Date.now();
      setGyroscope({ x: data.x, y: data.y, z: data.z, timestamp: ts });
    });
    gyroSub.current = sub;
    return () => {
      try { sub.remove(); } catch { try { Gyroscope.removeAllListeners(); } catch {} }
      gyroSub.current = null;
    };
  }, [enabled, enableGyro, isGyroscopeAvailable, gyroInterval]);

  useEffect(() => {
    if (!enabled || !enableAccel || Platform.OS === 'web') return;
    if (isAccelerometerAvailable === false) return;

    try { Accelerometer.setUpdateInterval(accelInterval); } catch {}
    const sub = Accelerometer.addListener((data) => {
      const ts = typeof data.timestamp === 'number' ? (data.timestamp > 1e12 ? data.timestamp : data.timestamp * 1000) : Date.now();
      setAccelerometer({ x: data.x, y: data.y, z: data.z, timestamp: ts });
    });
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
    try { Barometer.setUpdateInterval(baroInterval); } catch {}
    const sub = Barometer.addListener((data) => {
      const ts = typeof data.timestamp === 'number' ? (data.timestamp > 1e12 ? data.timestamp : data.timestamp * 1000) : Date.now();
      setBarometer({ pressure: data.pressure, relativeAltitude: (data as any).relativeAltitude ?? null, timestamp: ts });
    });
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
    try { (LightSensor as any).setUpdateInterval?.(lightInterval); } catch {}
    let sub: any = null;
    try { sub = LightSensor.addListener((data) => {
      const ts = typeof (data as any).timestamp === 'number' ? ((data as any).timestamp > 1e12 ? (data as any).timestamp : (data as any).timestamp * 1000) : Date.now();
      setLightSensor({ illuminance: (data as any).illuminance, timestamp: ts });
    }); } catch {}
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
    try { DeviceMotion.setUpdateInterval(motionInterval); } catch {}
    const sub = DeviceMotion.addListener((data: any) => {
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
    try { MagnetometerUncalibrated.setUpdateInterval(magUncalInterval); } catch {}
    const sub = MagnetometerUncalibrated.addListener((data: any) => {
      const ts = typeof data.timestamp === 'number' ? (data.timestamp > 1e12 ? data.timestamp : data.timestamp * 1000) : Date.now();
      setMagnetometerUncalibrated({ x: data.x, y: data.y, z: data.z, timestamp: ts });
    });
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
  // Range -180..180.
  const pitch = Math.atan2(y, Math.sqrt(x * x + z * z)) * (180 / Math.PI);
  const roll = Math.atan2(-x, z) * (180 / Math.PI);
  return { pitch, roll, magnitude: mag };
}
