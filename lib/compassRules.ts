import type { GPSLocation } from '@/hooks/gps';
import type { AccelerometerData, GyroscopeData, MagnetometerData } from '@/hooks/useSensors';

export type RuleSeverity = 'critical' | 'warn' | 'info';

export type RuleId =
  | 'R01' | 'R02' | 'R03' | 'R04' | 'R05' | 'R06'
  | 'R07' | 'R08' | 'R09' | 'R10' | 'R11' | 'R12'
  | 'R13' | 'R14' | 'R15' | 'R16';

export type CompassRuleResult = {
  id: RuleId;
  name: string;
  category: string;
  severity: RuleSeverity;
  active: boolean;
  message: string;
  detail: string;
  remediation?: string;
};

export type HeadingSample = { heading: number; timestamp: number };

export type CompassAccuracyInput = {
  magHeading: number | null;
  trueHeading: number | null;
  headingAccuracy: number | null;
  lastHeadingAt: number | null;
  lastLocation: GPSLocation | null;
  gpsMode: 'highAccuracy' | 'gpsOnly' | 'powerSave' | 'super';
  mapHeadingPreference: 'true' | 'magnetic';
  declinationError: string | null;
  lastDeclinationAt: number | null;
  lastDeclinationCoords: { lat: number; lon: number } | null;
  history: HeadingSample[];
  magnetometer: MagnetometerData | null;
  gyroscope: GyroscopeData | null;
  accelerometer: AccelerometerData | null;
  gyroYawDeg: number | null; // integrated yaw since last reset (approx)
  gyroLastRateDegPerSec: number | null;
  now: number;
};

// ---------- helpers ----------
function shortestDiff(a: number, b: number): number {
  // signed shortest: b - a in -180..180
  let d = ((b - a + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
}
function absShortest(a: number, b: number) {
  return Math.abs(shortestDiff(a, b));
}
function stddevDeg(samples: number[]): number {
  if (samples.length < 2) return 0;
  // circular stddev? approximate as linear if cluster not wrapping.
  // If wrap suspected, we shift to avoid 0/360 discontinuity by centering on first sample.
  const base = samples[0];
  const shifted = samples.map((v) => base + shortestDiff(base, v));
  const mean = shifted.reduce((s, v) => s + v, 0) / shifted.length;
  const variance = shifted.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (shifted.length - 1);
  return Math.sqrt(variance);
}
function computeTiltAngles(accel: AccelerometerData | null) {
  if (!accel) return null;
  const { x, y, z } = accel;
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (mag < 0.1) return null;
  const pitch = Math.atan2(y, Math.sqrt(x * x + z * z)) * (180 / Math.PI);
  const roll = Math.atan2(-x, z) * (180 / Math.PI);
  return { pitch: Math.abs(pitch), roll: Math.abs(roll), max: Math.max(Math.abs(pitch), Math.abs(roll)) };
}

// Thresholds (tunable)
const THRESH = {
  headingStale: { highAccuracy: 5000, gpsOnly: 5000, powerSave: 15000, super: 30000 } as Record<string, number>,
  locationStale: { highAccuracy: 30000, gpsOnly: 60000, powerSave: 120000, super: 180000 } as Record<string, number>,
  poorAccuracyM: 50,
  poorAccuracyCriticalM: 100,
  headingAccuracyWarn: 20,
  headingAccuracyCritical: 30,
  jitterStddev: 12,
  jitterReversals: 4,
  jitterWindowMs: 3000,
  plausibleRateDegPerSec: 180,
  spikeDegPer100ms: 90,
  tiltDeg: 45,
  stationarySpeedMps: 0.5,
  gyroBufferDeg: 15,
  gyroBufferCriticalDeg: 30,
  magExpectedMinUT: 20,
  magExpectedMaxUT: 70,
  magDeviationUT: 15,
  magDeviationPct: 0.30,
};

function evalR01(input: CompassAccuracyInput): CompassRuleResult {
  const active = input.magHeading == null && input.trueHeading == null;
  return {
    id: 'R01',
    name: 'No Heading Fix',
    category: 'Initialization',
    severity: 'critical',
    active,
    message: 'No heading fix',
    detail: active ? 'Compass has no heading yet. Move device in a figure-8 and wait for sensor lock.' : 'Heading available',
    remediation: 'Wave device in figure-8, hold level away from metal.',
  };
}
function evalR02(input: CompassAccuracyInput): CompassRuleResult {
  const staleMs = input.lastHeadingAt == null ? Infinity : input.now - input.lastHeadingAt;
  const threshold = THRESH.headingStale[input.gpsMode] ?? 5000;
  const active = input.magHeading != null && staleMs > threshold;
  const secs = Math.round(staleMs / 1000);
  return {
    id: 'R02',
    name: 'Heading Stale',
    category: 'Initialization',
    severity: staleMs > 15000 ? 'critical' : 'warn',
    active,
    message: 'Heading stale',
    detail: active ? `No heading update for ${secs}s (limit ${Math.round(threshold / 1000)}s).` : 'Heading updating normally',
  };
}
function evalR03(input: CompassAccuracyInput): CompassRuleResult {
  if (!input.lastLocation) {
    return {
      id: 'R03',
      name: 'No GPS Fix',
      category: 'Initialization',
      severity: 'critical',
      active: true,
      message: 'No GPS fix',
      detail: 'Waiting for GPS. True-north conversion not possible on Android without location.',
    };
  }
  const ageMs = input.now - (input.lastLocation.timestamp ?? input.now);
  const threshold = THRESH.locationStale[input.gpsMode] ?? 30000;
  const active = ageMs > threshold;
  return {
    id: 'R03',
    name: 'Location Stale',
    category: 'Initialization',
    severity: active && ageMs > threshold * 2 ? 'critical' : 'warn',
    active,
    message: 'Location stale',
    detail: active ? `Last GPS fix ${Math.round(ageMs / 1000)}s ago (limit ${Math.round(threshold / 1000)}s).` : `GPS age ${Math.round(ageMs / 1000)}s`,
  };
}
function evalR04(input: CompassAccuracyInput): CompassRuleResult {
  const active = input.mapHeadingPreference === 'true' && input.magHeading != null && input.trueHeading == null;
  return {
    id: 'R04',
    name: 'True North Unavailable',
    category: 'Conversion',
    severity: 'warn',
    active,
    message: 'Falling back to magnetic north',
    detail: active ? 'Showing magnetic north - true heading not yet computed (awaiting declination). Error equals local declination.' : 'True heading available or preference is magnetic',
  };
}
function evalR05(input: CompassAccuracyInput): CompassRuleResult {
  const acc = input.lastLocation?.coords.accuracy ?? null;
  const active = acc != null && acc > THRESH.poorAccuracyM;
  const critical = acc != null && acc > THRESH.poorAccuracyCriticalM;
  return {
    id: 'R05',
    name: 'Poor GPS Accuracy',
    category: 'GPS Quality',
    severity: critical ? 'critical' : 'warn',
    active,
    message: 'Poor GPS accuracy',
    detail: acc == null ? 'Accuracy unknown' : `GPS +/- ${Math.round(acc)}m${acc > THRESH.poorAccuracyM ? ' - declination/grid may be off' : ''}`,
  };
}
function evalR06(input: CompassAccuracyInput): CompassRuleResult {
  if (input.declinationError != null) {
    return {
      id: 'R06',
      name: 'Declination Failed',
      category: 'Conversion',
      severity: 'warn',
      active: true,
      message: 'Declination lookup failed',
      detail: `WMMHR model error: ${input.declinationError}`,
    };
  }
  if (input.lastDeclinationAt == null && input.lastLocation) {
    // never computed declination but we have location -> stale
    return {
      id: 'R06',
      name: 'Declination Stale',
      category: 'Conversion',
      severity: 'warn',
      active: true,
      message: 'Declination not yet computed',
      detail: 'Awaiting first declination conversion for true-north.',
    };
  }
  if (input.lastDeclinationAt != null && input.lastDeclinationCoords && input.lastLocation) {
    const movedKm = haversineKm(input.lastDeclinationCoords.lat, input.lastDeclinationCoords.lon, input.lastLocation.coords.latitude, input.lastLocation.coords.longitude);
    const ageHrs = (input.now - input.lastDeclinationAt) / 3600000;
    const active = movedKm > 50 || ageHrs > 12;
    return {
      id: 'R06',
      name: 'Declination Stale',
      category: 'Conversion',
      severity: 'warn',
      active,
      message: 'Declination stale',
      detail: active ? `Moved ${movedKm.toFixed(1)} km or ${ageHrs.toFixed(1)}h since last declination` : 'Declination fresh',
    };
  }
  return { id: 'R06', name: 'Declination Stale', category: 'Conversion', severity: 'warn', active: false, message: 'Declination stale', detail: 'No declination issue' };
}
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function evalR07(input: CompassAccuracyInput): CompassRuleResult {
  // Requires gyro + mag. Integrated yaw vs mag divergence outside buffer.
  if (input.gyroYawDeg == null || input.magHeading == null || input.gyroscope == null) {
    return { id: 'R07', name: 'Gyro/Compass Divergence', category: 'Sensor Fusion', severity: 'warn', active: false, message: 'Gyro/compass divergence', detail: 'Gyro not available - cannot compare' };
  }
  // If stationary and gyro noisy, gate off (R15 will handle)
  const speed = input.lastLocation?.coords.speed ?? null;
  if (speed != null && speed < THRESH.stationarySpeedMps) {
    // require larger divergence when stationary
    const diff = absShortest(input.gyroYawDeg, input.magHeading);
    const active = diff > THRESH.gyroBufferCriticalDeg;
    return {
      id: 'R07',
      name: 'Gyro/Compass Divergence',
      category: 'Sensor Fusion',
      severity: diff > THRESH.gyroBufferCriticalDeg ? 'critical' : 'warn',
      active,
      message: 'Gyro/compass divergence',
      detail: `Gyro yaw ${Math.round(input.gyroYawDeg)} deg vs mag ${Math.round(input.magHeading)} deg (diff ${Math.round(diff)} deg) - stationary, threshold higher`,
    };
  }
  const diff = absShortest(input.gyroYawDeg!, input.magHeading!);
  const active = diff > THRESH.gyroBufferDeg;
  return {
    id: 'R07',
    name: 'Gyro/Compass Divergence',
    category: 'Sensor Fusion',
    severity: diff > THRESH.gyroBufferCriticalDeg ? 'critical' : 'warn',
    active,
    message: 'Gyro/compass divergence',
    detail: `Gyro disagrees by ${Math.round(diff)} deg (limit ${THRESH.gyroBufferDeg} deg)`,
    remediation: 'Possible interference. Move away from metal.',
  };
}

function evalR08(input: CompassAccuracyInput): CompassRuleResult {
  const m = input.magnetometer;
  // (a) field strength check
  if (m) {
    const mag = m.magnitude;
    const outsideAbsolute = mag < THRESH.magExpectedMinUT || mag > THRESH.magExpectedMaxUT;
    // expected ~25-65 typical but allow 20-70. Also check deviation if we had expected.
    // Without expectedWMM, use absolute window + jitter.
    if (outsideAbsolute) {
      return {
        id: 'R08',
        name: 'Magnetic Interference',
        category: 'Environment',
        severity: 'critical',
        active: true,
        message: 'Magnetic interference',
        detail: `Field ${mag.toFixed(1)} uT outside expected ${THRESH.magExpectedMinUT}-${THRESH.magExpectedMaxUT} uT - near metal/electronics`,
        remediation: 'Move 2-3m away from metal, speakers, vehicles. Hold level.',
      };
    }
  }
  // (b) jitter while gyro indicates no rotation
  const hist = input.history;
  if (hist.length >= 6) {
    // look at last 3s
    const cutoff = input.now - 3000;
    const recent = hist.filter((s) => s.timestamp >= cutoff);
    if (recent.length >= 4) {
      let jumps = 0;
      for (let i = 1; i < recent.length; i++) {
        if (absShortest(recent[i - 1].heading, recent[i].heading) > 10) jumps++;
      }
      const gyroRate = input.gyroLastRateDegPerSec != null ? Math.abs(input.gyroLastRateDegPerSec) : null;
      const gyroStill = gyroRate == null || gyroRate < 5;
      if (jumps >= 3 && gyroStill) {
        return {
          id: 'R08',
          name: 'Magnetic Interference',
          category: 'Environment',
          severity: 'critical',
          active: true,
          message: 'Magnetic interference',
          detail: `Heading jitter ${jumps} jumps >10 deg in 3s while gyro still - local distortion`,
          remediation: 'Move away from metal/rebar.',
        };
      }
    }
  }
  return { id: 'R08', name: 'Magnetic Interference', category: 'Environment', severity: 'critical', active: false, message: 'Magnetic interference', detail: 'No interference detected' };
}

function evalR09(input: CompassAccuracyInput): CompassRuleResult {
  const speed = input.lastLocation?.coords.speed ?? null;
  // If speed available, heuristic: fast movement + magnetic jitter = maybe vehicle
  // Without speed, cannot auto-detect - stay inactive but inform user could be in vehicle if they flag.
  // We use speed threshold 5 m/s as "possibly in vehicle"
  const maybeVehicle = speed != null && speed > 5;
  if (!maybeVehicle) {
    return { id: 'R09', name: 'Inside Vehicle', category: 'Environment', severity: 'warn', active: false, message: 'Inside vehicle', detail: 'No vehicle signature' };
  }
  // If moving fast AND we have magnetic anomaly (R08) or poor GPS, flag as vehicle
  const acc = input.lastLocation?.coords.accuracy ?? null;
  const accPoor = acc != null && acc > 25;
  const gyroStable = input.gyroLastRateDegPerSec != null && Math.abs(input.gyroLastRateDegPerSec) < 10;
  const active = accPoor || gyroStable; // simple
  return {
    id: 'R09',
    name: 'Inside Vehicle',
    category: 'Environment',
    severity: 'warn',
    active,
    message: 'Possibly inside vehicle',
    detail: `Speed ${speed!.toFixed(1)} m/s with ${accPoor ? 'poor GPS' : 'stable gyro'} - steel shell may shield compass`,
    remediation: 'For best accuracy, hold device near window or step outside.',
  };
}

function evalR10(input: CompassAccuracyInput): CompassRuleResult {
  const acc = input.lastLocation?.coords.accuracy ?? null;
  // Indoor: poor GPS + heading accuracy poor or unavailable
  const poorGps = acc != null && acc > 30;
  const headingAccPoor = input.headingAccuracy != null && input.headingAccuracy > 20;
  const active = poorGps && (headingAccPoor || input.headingAccuracy == null);
  return {
    id: 'R10',
    name: 'Inside Building / Blocked',
    category: 'Environment',
    severity: 'warn',
    active,
    message: 'Indoors / blocked sky',
    detail: active ? `GPS +/- ${Math.round(acc!)}m and ${input.headingAccuracy == null ? 'no' : '+/- ' + Math.round(input.headingAccuracy!)} heading accuracy - structure may distort field` : 'Sky not blocked',
    remediation: 'Step outside away from rebar/concrete for true heading.',
  };
}

function evalR11(input: CompassAccuracyInput): CompassRuleResult {
  const hist = input.history;
  if (hist.length < 4) {
    return { id: 'R11', name: 'Heading Jitter', category: 'Sensor Health', severity: 'warn', active: false, message: 'Heading jitter', detail: 'Not enough samples' };
  }
  const cutoff = input.now - THRESH.jitterWindowMs;
  const recent = hist.filter((s) => s.timestamp >= cutoff);
  if (recent.length < 4) return { id: 'R11', name: 'Heading Jitter', category: 'Sensor Health', severity: 'warn', active: false, message: 'Heading jitter', detail: 'Window too small' };
  const vals = recent.map((r) => r.heading);
  const sd = stddevDeg(vals);
  let reversals = 0;
  for (let i = 2; i < recent.length; i++) {
    const d1 = shortestDiff(recent[i - 1].heading, recent[i].heading);
    const d0 = shortestDiff(recent[i - 2].heading, recent[i - 1].heading);
    if (d1 * d0 < 0 && Math.abs(d1) > 20 && Math.abs(d0) > 20) reversals++;
  }
  const active = sd > THRESH.jitterStddev || reversals >= THRESH.jitterReversals;
  return {
    id: 'R11',
    name: 'Heading Jitter',
    category: 'Sensor Health',
    severity: 'warn',
    active,
    message: 'Heading jitter',
    detail: active ? `Unstable: sd ${sd.toFixed(1)} deg${reversals >= 2 ? `, ${reversals} reversals` : ''} in 3s` : `Stable (sd ${sd.toFixed(1)} deg)`,
    remediation: 'Hold level and steady, away from electronics.',
  };
}

function evalR12(input: CompassAccuracyInput): CompassRuleResult {
  const acc = input.headingAccuracy;
  if (acc == null) {
    return { id: 'R12', name: 'Heading Accuracy', category: 'Sensor Health', severity: 'warn', active: false, message: 'Heading accuracy', detail: 'OS accuracy not reported - assume nominal' };
  }
  const active = acc > THRESH.headingAccuracyWarn;
  return {
    id: 'R12',
    name: 'Needs Calibration',
    category: 'Sensor Health',
    severity: acc > THRESH.headingAccuracyCritical ? 'critical' : 'warn',
    active,
    message: 'Needs calibration',
    detail: `Compass accuracy +/- ${Math.round(acc)} deg${acc > THRESH.headingAccuracyWarn ? ' - wave in figure-8' : ''}`,
    remediation: 'Wave in figure-8 until accuracy improves.',
  };
}

function evalR13(input: CompassAccuracyInput): CompassRuleResult {
  const hist = input.history;
  if (hist.length < 2) return { id: 'R13', name: 'Implausible Rotation', category: 'Kinematics', severity: 'warn', active: false, message: 'Implausible rotation', detail: 'Not enough data' };
  // check most recent delta
  const last = hist[hist.length - 1];
  const prev = hist[hist.length - 2];
  const dtSec = (last.timestamp - prev.timestamp) / 1000;
  if (dtSec <= 0.01) {
    return { id: 'R13', name: 'Implausible Rotation', category: 'Kinematics', severity: 'warn', active: false, message: 'Implausible rotation', detail: 'Dt too small' };
  }
  const dDeg = absShortest(prev.heading, last.heading);
  const rate = dDeg / dtSec;
  const spike = dDeg > THRESH.spikeDegPer100ms && dtSec < 0.2;
  const sustainedHigh = rate > THRESH.plausibleRateDegPerSec;
  // require gyro to disagree for spike (otherwise could be real fast spin)
  const gyroRate = input.gyroLastRateDegPerSec != null ? Math.abs(input.gyroLastRateDegPerSec) : null;
  const gyroConfirmsStill = gyroRate != null && gyroRate < 30;
  const active = (sustainedHigh && gyroConfirmsStill) || (spike && gyroConfirmsStill);
  return {
    id: 'R13',
    name: 'Implausible Rotation',
    category: 'Kinematics',
    severity: 'warn',
    active,
    message: 'Sensor glitch',
    detail: active ? `Jump ${dDeg.toFixed(1)} deg in ${(dtSec * 1000).toFixed(0)}ms (${rate.toFixed(0)} deg/s)` : `Rate ${rate.toFixed(0)} deg/s`,
  };
}

function evalR14(input: CompassAccuracyInput): CompassRuleResult {
  const tilt = computeTiltAngles(input.accelerometer);
  if (!tilt) {
    return { id: 'R14', name: 'Device Not Level', category: 'Orientation', severity: 'warn', active: false, message: 'Device not level', detail: 'Tilt unavailable (no accelerometer)' };
  }
  const active = tilt.max > THRESH.tiltDeg;
  return {
    id: 'R14',
    name: 'Device Not Level',
    category: 'Orientation',
    severity: 'warn',
    active,
    message: 'Device not level',
    detail: `Tilt ${tilt.max.toFixed(0)} deg (pitch ${tilt.pitch.toFixed(0)}, roll ${tilt.roll.toFixed(0)}) - limit ${THRESH.tiltDeg} deg`,
    remediation: 'Hold device level for best compass accuracy.',
  };
}

function evalR15(input: CompassAccuracyInput): CompassRuleResult {
  const speed = input.lastLocation?.coords.speed ?? null;
  const stationary = speed == null ? null : speed < THRESH.stationarySpeedMps;
  if (stationary === false) {
    return { id: 'R15', name: 'Stationary Drift', category: 'Kinematics', severity: 'warn', active: false, message: 'Stationary drift', detail: 'Moving - heading reliable' };
  }
  // Check variance when stationary (or speed unknown, treat as stationary for variance check)
  const hist = input.history;
  if (hist.length < 4) return { id: 'R15', name: 'Stationary Drift', category: 'Kinematics', severity: 'warn', active: false, message: 'Stationary drift', detail: 'Not enough samples' };
  const recent = hist.filter((s) => input.now - s.timestamp <= 5000);
  if (recent.length < 4) return { id: 'R15', name: 'Stationary Drift', category: 'Kinematics', severity: 'warn', active: false, message: 'Stationary drift', detail: 'Window small' };
  const sd = stddevDeg(recent.map((r) => r.heading));
  const active = sd > 8;
  return {
    id: 'R15',
    name: 'Stationary Drift',
    category: 'Kinematics',
    severity: 'warn',
    active,
    message: 'Standing still - drift',
    detail: `${speed == null ? 'Speed unknown' : `Speed ${speed.toFixed(1)} m/s`} and sd ${sd.toFixed(1)} deg over 5s - walk a few steps`,
    remediation: 'Walk a few steps for more stable heading.',
  };
}

function evalR16(input: CompassAccuracyInput): CompassRuleResult {
  const active = input.gpsMode === 'powerSave' || input.gpsMode === 'super';
  return {
    id: 'R16',
    name: 'Power Save Throttled',
    category: 'Mode',
    severity: 'info',
    active,
    message: 'Power save throttled',
    detail: active ? `GPS mode ${input.gpsMode} - heading updates throttled to save battery` : 'High accuracy mode',
  };
}

export function evaluateCompassRules(input: CompassAccuracyInput): CompassRuleResult[] {
  return [
    evalR01(input),
    evalR02(input),
    evalR03(input),
    evalR04(input),
    evalR05(input),
    evalR06(input),
    evalR07(input),
    evalR08(input),
    evalR09(input),
    evalR10(input),
    evalR11(input),
    evalR12(input),
    evalR13(input),
    evalR14(input),
    evalR15(input),
    evalR16(input),
  ];
}

export function getActiveRules(results: CompassRuleResult[]): CompassRuleResult[] {
  return results.filter((r) => r.active);
}

export function worstSeverity(active: CompassRuleResult[]): RuleSeverity | null {
  if (active.some((r) => r.severity === 'critical')) return 'critical';
  if (active.some((r) => r.severity === 'warn')) return 'warn';
  if (active.some((r) => r.severity === 'info')) return 'info';
  return null;
}
