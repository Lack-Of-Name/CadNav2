import * as turf from '@turf/turf';

type LatLon = { latitude: number; longitude: number };

/**
 * Convert grid offsets in meters to latitude/longitude.
 * @param origin The origin point { latitude, longitude }
 * @param easting Offset in meters east from origin
 * @param northing Offset in meters north from origin
 * @returns New point { latitude, longitude }
 */
export function gridOffsetMetersToLatLon(origin: LatLon, easting: number, northing: number): LatLon {
  // Start at origin [lon, lat]
  const originPoint = turf.point([origin.longitude, origin.latitude]);

  // Move east by easting meters
  const eastPoint = turf.destination(originPoint, easting, 90, { units: 'meters' });

  // Move north by northing meters
  const finalPoint = turf.destination(eastPoint, northing, 0, { units: 'meters' });

  const [lon, lat] = finalPoint.geometry.coordinates;
  return { latitude: lat, longitude: lon };
}

/**
 * Given an origin and two corner lat/lon points (map bottom-left and top-right),
 * compute expanded grid-aligned corner coordinates around the origin.
 *
 * Steps:
 * 1. Calculate easting (meters east of origin) and northing (meters north of origin)
 *    for both corners.
 * 2. For bottom-left subtract 1km from both easting and northing and round to nearest 1km.
 *    For top-right add 1km to both and round to nearest 1km.
 * 3. Convert the adjusted easting/northing back to lat/lon to produce grid bounds.
 */
export function computeGridCornersFromMapBounds(
  origin: LatLon,
  bottomLeft: LatLon,
  topRight: LatLon,
  step = 1000,
  gridConvergence = 0
): {
  offsets: {
    bottomLeft: { easting: number; northing: number };
    topRight: { easting: number; northing: number };
  };
} {
  const originPoint = turf.point([origin.longitude, origin.latitude]);

  // Build all four corners of the map bounds
  const bl = turf.point([bottomLeft.longitude, bottomLeft.latitude]);
  const br = turf.point([topRight.longitude, bottomLeft.latitude]);
  const tl = turf.point([bottomLeft.longitude, topRight.latitude]);
  const tr = turf.point([topRight.longitude, topRight.latitude]);

  const corners = [bl, br, tl, tr];

  // Helper: rotate EN vector by degrees
  const rotate = (e: number, n: number, deg: number) => {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { e: e * cos - n * sin, n: e * sin + n * cos };
  };

  // Convert each corner to true-east/north offsets (meters) from origin, then rotate
  // into grid coordinates by applying the inverse of gridConvergence (i.e. -gridConvergence).
  const enPoints = corners.map((pt) => {
    const dist = turf.distance(originPoint, pt, { units: 'meters' });
    const bearing = turf.bearing(originPoint, pt); // degrees from north
    const rad = (bearing * Math.PI) / 180;
    const eTrue = dist * Math.sin(rad);
    const nTrue = dist * Math.cos(rad);
    // rotate into grid coordinates (grid north = true north + gridConvergence)
    const { e, n } = rotate(eTrue, nTrue, -gridConvergence);
    return { e, n };
  });

  const eVals = enPoints.map((p) => p.e);
  const nVals = enPoints.map((p) => p.n);

  const eMin = Math.min(...eVals);
  const eMax = Math.max(...eVals);
  const nMin = Math.min(...nVals);
  const nMax = Math.max(...nVals);

  const roundKm = (v: number) => Math.round(v / step) * step;

  // Expand by 1km on each side to ensure coverage, then round to nearest step
  const adjEastingBL = roundKm(eMin - step);
  const adjNorthingBL = roundKm(nMin - step);
  const adjEastingTR = roundKm(eMax + step);
  const adjNorthingTR = roundKm(nMax + step);

  return {
    offsets: {
      bottomLeft: { easting: adjEastingBL, northing: adjNorthingBL },
      topRight: { easting: adjEastingTR, northing: adjNorthingTR },
    },
  };
}

/**
 * Generate a grid of intersection points (easting, northing) between two corner offsets.
 *
 * Both corners are specified as meters east/north of the origin. The function will
 * return all intersection points (inclusive) on a regular grid with spacing `step`.
 *
 * Returns an array of tuples: [easting, northing]
 */
export function generateGridIntersections(
  offsets: {
    bottomLeft: { easting: number; northing: number };
    topRight: { easting: number; northing: number };
  },
  step = 1000
): Array<[number, number]> {
  const eStart = Math.min(offsets.bottomLeft.easting, offsets.topRight.easting);
  const eEnd = Math.max(offsets.bottomLeft.easting, offsets.topRight.easting);
  const nStart = Math.min(offsets.bottomLeft.northing, offsets.topRight.northing);
  const nEnd = Math.max(offsets.bottomLeft.northing, offsets.topRight.northing);

  if (step <= 0) throw new Error('step must be > 0');

  // Assume (eEnd-eStart) and (nEnd-nStart) are divisible by `step`.
  const eCount = (eEnd - eStart) / step;
  const nCount = (nEnd - nStart) / step;

  const points: Array<[number, number]> = [];
  for (let i = 0; i <= eCount; i++) {
    const e = eStart + i * step;
    for (let j = 0; j <= nCount; j++) {
      const n = nStart + j * step;
      points.push([e, n]);
    }
  }
  return points;
}

/**
 * Convert grid coordinates (easting,northing) into latitude/longitude, taking
 * grid convergence into account. `gridConvergence` is degrees difference
 * between true north and grid north (gridNorth = trueNorth + gridConvergence).
 */
export function gridCoordsToLatLon(origin: LatLon, easting: number, northing: number, gridConvergence = 0): LatLon {
  // rotate grid coords back to true EN by applying +gridConvergence
  const rad = (gridConvergence * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const eTrue = easting * cos - northing * sin;
  const nTrue = easting * sin + northing * cos;
  return gridOffsetMetersToLatLon(origin, eTrue, nTrue);
}

/**
 * Generate grid intersections as lat/lon points. Returns an array of objects
 * containing the original grid `e` and `n` values (in meters) and the
 * corresponding `latitude`/`longitude` computed after applying
 * `gridConvergence`.
 */
export function generateGridPoints(
  origin: LatLon,
  offsets: {
    bottomLeft: { easting: number; northing: number };
    topRight: { easting: number; northing: number };
  },
  step = 1000,
  gridConvergence = 0
): Array<{ e: number; n: number; latitude: number; longitude: number }> {
  const pts: Array<{ e: number; n: number; latitude: number; longitude: number }> = [];
  const intersections = generateGridIntersections(offsets, step);
  for (const [e, n] of intersections) {
    const ll = gridCoordsToLatLon(origin, e, n, gridConvergence);
    pts.push({ e, n, latitude: ll.latitude, longitude: ll.longitude });
  }
  return pts;
}
