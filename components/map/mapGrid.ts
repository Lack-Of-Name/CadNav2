import { latLonToUtm, latLonToUtmGridCoords, mgrs100kSquare, utmGridCoordsToLatLon, type LatLon } from '@/lib/mgrs';

/** The 10,000,000 m northing offset used for southern-hemisphere UTM. */
const NORTHING_OFFSET = 10000000;

export type GridOffsets = {
  bottomLeft: { easting: number; northing: number };
  topRight: { easting: number; northing: number };
};

export type GridContext = {
  /** UTM zone the grid is drawn in. */
  zone: number;
  /** MGRS latitude band of the grid's origin area. */
  band: string;
  offsets: GridOffsets;
};

/**
 * Given the map's visible bounds, compute the UTM grid (1km-aligned) that
 * covers it. The grid is drawn in the UTM zone containing the bounds centre.
 * Returns null when the area is outside MGRS limits (beyond 84N/80S).
 */
export function computeGridCornersFromMapBounds(
  bottomLeft: LatLon,
  topRight: LatLon,
  step = 1000
): GridContext | null {
  const centerLat = (bottomLeft.latitude + topRight.latitude) / 2;
  const centerLon = (bottomLeft.longitude + topRight.longitude) / 2;

  const utm = latLonToUtm(centerLat, centerLon);
  if (utm.band === 'Z') return null; // outside MGRS limits
  const zone = utm.zone;

  // Build all four corners of the map bounds, projected into this zone.
  const bl = { latitude: bottomLeft.latitude, longitude: bottomLeft.longitude };
  const br = { latitude: bottomLeft.latitude, longitude: topRight.longitude };
  const tl = { latitude: topRight.latitude, longitude: bottomLeft.longitude };
  const tr = { latitude: topRight.latitude, longitude: topRight.longitude };

  const enPoints = [bl, br, tl, tr].map((pt) => latLonToUtmGridCoords(pt.latitude, pt.longitude, zone));

  const eVals = enPoints.map((p) => p.easting);
  const nVals = enPoints.map((p) => p.northing);

  const eMin = Math.min(...eVals);
  const eMax = Math.max(...eVals);
  const nMin = Math.min(...nVals);
  const nMax = Math.max(...nVals);

  // Expand by 3 steps on each side to ensure coverage during panning, then snap to grid steps
  const pad = 3 * step;
  const adjEastingBL = Math.floor((eMin - pad) / step) * step;
  const adjNorthingBL = Math.floor((nMin - pad) / step) * step;
  const adjEastingTR = Math.ceil((eMax + pad) / step) * step;
  const adjNorthingTR = Math.ceil((nMax + pad) / step) * step;

  return {
    zone,
    band: utm.band,
    offsets: {
      bottomLeft: { easting: adjEastingBL, northing: adjNorthingBL },
      topRight: { easting: adjEastingTR, northing: adjNorthingTR },
    },
  };
}

/**
 * Generate a grid of intersection points (easting, northing) between two corner offsets.
 * Both corners are zone-local UTM meters; all intersections on a regular grid
 * with spacing `step` are returned (inclusive).
 */
export function generateGridIntersections(offsets: GridOffsets, step = 1000): [number, number][] {
  const eStart = Math.min(offsets.bottomLeft.easting, offsets.topRight.easting);
  const eEnd = Math.max(offsets.bottomLeft.easting, offsets.topRight.easting);
  const nStart = Math.min(offsets.bottomLeft.northing, offsets.topRight.northing);
  const nEnd = Math.max(offsets.bottomLeft.northing, offsets.topRight.northing);

  if (step <= 0) throw new Error('step must be > 0');

  // Assume (eEnd-eStart) and (nEnd-nStart) are divisible by `step`.
  const eCount = (eEnd - eStart) / step;
  const nCount = (nEnd - nStart) / step;

  const points: [number, number][] = [];
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
 * Generate grid intersections as lat/lon points for the given grid context.
 * Returns objects with the zone-local `e`/`n` values (meters) and the
 * corresponding latitude/longitude.
 */
export function generateGridPoints(
  ctx: GridContext,
  step = 1000
): { e: number; n: number; latitude: number; longitude: number }[] {
  const pts: { e: number; n: number; latitude: number; longitude: number }[] = [];
  const intersections = generateGridIntersections(ctx.offsets, step);
  for (const [e, n] of intersections) {
    const ll = utmGridCoordsToLatLon(ctx.zone, e, n);
    pts.push({ e, n, latitude: ll.latitude, longitude: ll.longitude });
  }
  return pts;
}

/**
 * GZD (grid zone designator) boundary lines covering the bounding box
 * `sw`/`ne`: UTM zone (column) edges at every 6° of longitude and the
 * latitude band (row) edges at -80°..84° (8° bands, 12° for the X band).
 * Each returned line is an array of [lon, lat] pairs.
 */
export function generateGzdLines(sw: LatLon, ne: LatLon): [number, number][][] {
  const lines: [number, number][][] = [];

  // Zone edges run along meridians at every 6 degrees of longitude.
  const firstLon = Math.ceil(sw.longitude / 6) * 6;
  const lastLon = Math.floor(ne.longitude / 6) * 6;
  for (let lon = firstLon; lon <= lastLon; lon += 6) {
    lines.push([
      [lon, sw.latitude],
      [lon, ne.latitude],
    ]);
  }

  // Latitude band edges: C (-80..-72) through W (64..72), then X (72..84).
  const bandEdges: number[] = [];
  for (let k = 0; k <= 19; k++) bandEdges.push(-80 + 8 * k);
  bandEdges.push(84);
  for (const lat of bandEdges) {
    if (lat < sw.latitude || lat > ne.latitude) continue;
    lines.push([
      [sw.longitude, lat],
      [ne.longitude, lat],
    ]);
  }

  return lines;
}

/**
 * MGRS label for the 1km grid cell whose SW corner is at zone-local grid
 * coordinate (e, n), e.g. "DV 12 34". Uses the 100,000m square letters plus
 * the 2-digit km easting/northing of the corner within that square.
 */
export function mgrsCellLabel(e: number, n: number, zone: number): string {
  const standardN = n >= 0 ? n : n + NORTHING_OFFSET;
  const square = mgrs100kSquare(e, standardN, zone);
  const eKm = (Math.floor(e / 1000) % 100 + 100) % 100;
  const nKm = (Math.floor(standardN / 1000) % 100 + 100) % 100;
  return `${square} ${String(eKm).padStart(2, '0')} ${String(nKm).padStart(2, '0')}`;
}
