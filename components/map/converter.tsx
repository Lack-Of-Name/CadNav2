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
export async function getMagneticDeclination(
  lat: number,
  lon: number,
  date?: Date | string
): Promise<number> {
  const dt = date ? new Date(date) : new Date();
  if (isNaN(dt.getTime())) return 0;

  const year = dt.getUTCFullYear();
  const month = dt.getUTCMonth() + 1;
  const day = dt.getUTCDate();

  // NOAA geomag calculator endpoint (returns JSON)
  const url = `https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination?lat1=${encodeURIComponent(
    String(lat)
  )}&lon1=${encodeURIComponent(String(lon))}&resultFormat=json&startYear=${year}&startMonth=${month}&startDay=${day}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return 0;
    const data = await res.json();
    // response structure varies; try known paths
    // when successful, `result` array with objects containing `declination` is expected
    if (data && data.result && Array.isArray(data.result) && data.result.length > 0) {
      const r = data.result[0];
      if (typeof r.declination === 'number') return r.declination;
      if (typeof r.declination_value === 'number') return r.declination_value;
    }
    // some endpoints return an object with `declination` at top-level
    if (typeof data.declination === 'number') return data.declination;
  } catch (e) {
    // ignore network / parse errors
  }

  return 0;
}
