export type BearingRef = 'true' | 'magnetic' | 'grid';

export interface ConversionOptions {
  /**
   * Magnetic declination in degrees. Positive when magnetic north is east of true north.
   */
  declination?: number;
  /**
   * Grid convergence in degrees. Positive when grid north is east of true north.
   */
  convergence?: number;
}

function normalizeDeg(deg: number) {
  let v = deg % 360;
  if (v < 0) v += 360;
  return v;
}

function normalizeMils(mils: number, milsPerCircle = 6400) {
  let v = mils % milsPerCircle;
  if (v < 0) v += milsPerCircle;
  return v;
}

/**
 * NATO mils per full circle.
 *
 * Note: other "mil" definitions exist (e.g., 6000, 6283.185...), but most
 * land-nav / artillery contexts use 6400.
 */
export const MILS_PER_CIRCLE = 6400;

/**
 * Convert degrees to mils.
 * Uses $360^\circ = 6400$ mils by default.
 */
export function degreesToMils(
  degrees: number,
  opts: { normalize?: boolean; milsPerCircle?: number } = {}
): number {
  const milsPerCircle = opts.milsPerCircle ?? MILS_PER_CIRCLE;
  const mils = (degrees * milsPerCircle) / 360;
  return opts.normalize ? normalizeMils(mils, milsPerCircle) : mils;
}

/**
 * Convert mils to degrees.
 * Uses $6400$ mils $= 360^\circ$ by default.
 */
export function milsToDegrees(
  mils: number,
  opts: { normalize?: boolean; milsPerCircle?: number } = {}
): number {
  const milsPerCircle = opts.milsPerCircle ?? MILS_PER_CIRCLE;
  const degrees = (mils * 360) / milsPerCircle;
  return opts.normalize ? normalizeDeg(degrees) : degrees;
}

/**
 * Convert a bearing between `true`, `magnetic`, and `grid` references.
 *
 * Conventions used:
 * - `declination` is positive when magnetic north is east (clockwise) of true north.
 * - `convergence` is positive when grid north is east (clockwise) of true north.
 *
 * Example: to convert a grid bearing to magnetic, the function converts grid -> true -> magnetic.
 */
export function convertBearing(
  bearing: number,
  from: BearingRef,
  to: BearingRef,
  opts: ConversionOptions = {}
): number {
  const decl = opts.declination ?? 0;
  const conv = opts.convergence ?? 0;

  if (from === to) return normalizeDeg(bearing);

  // First convert input to true bearing
  let trueBearing: number;
  if (from === 'true') {
    trueBearing = bearing;
  } else if (from === 'magnetic') {
    // magnetic -> true : add declination
    trueBearing = bearing + decl;
  } else {
    // grid -> true : add convergence
    trueBearing = bearing + conv;
  }

  // Then convert true bearing to target
  let out: number;
  if (to === 'true') {
    out = trueBearing;
  } else if (to === 'magnetic') {
    // true -> magnetic : subtract declination
    out = trueBearing - decl;
  } else {
    // true -> grid : subtract convergence
    out = trueBearing - conv;
  }

  return normalizeDeg(out);
}

export default convertBearing;

export { getMagneticDeclination } from './declination';

/**
 * Compute grid convergence (degrees) for a given latitude/longitude and UTM zone.
 * If `zone` is omitted the UTM zone for the longitude will be used.
 *
 * Formula (approximate, suitable for small areas):
 *   convergence = atan( sin(lambda - lambda0) * tan(phi) )
 * where lambda/lambda0 are longitudes (radians) and phi is latitude (radians).
 */
export function computeGridConvergence(lat: number, lon: number, zone?: number): number {
  // determine UTM zone if not provided
  const z = zone ?? Math.floor((lon + 180) / 6) + 1;
  const lambda = (lon * Math.PI) / 180;
  const lambda0Deg = z * 6 - 183; // central meridian
  const lambda0 = (lambda0Deg * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;

  const gamma = Math.atan(Math.sin(lambda - lambda0) * Math.tan(phi));
  return (gamma * 180) / Math.PI;
}

/**
 * Query magnetic declination (degrees) at the given location and date.
 * Attempts to use NOAA's Geomag web service. Returns 0 on failure.
 *
 * `date` may be a `Date` or ISO date string. If omitted, current date is used.
 */
// declination is provided by components/map/declination.tsx (offline WMMHR model)
