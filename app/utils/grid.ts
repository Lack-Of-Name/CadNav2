import type { LatLng } from './geo';

export type GridAnchor = {
  coordinate: LatLng;
  eastingMeters: number;
  northingMeters: number;
  // Optional: preserve what the user typed for display/debug.
  eastingInput?: string;
  northingInput?: string;
  scaleMeters?: number;
};

export type GridConfig = {
  enabled: boolean;
  anchor: GridAnchor | null;
  majorSpacingMeters: number;
  minorDivisions: number; // e.g. 10 (=> minor = major / 10)
};

export type LatLngBounds = {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
};

export type GridComputed = {
  majorLonLines: Array<{ lon: number; label: string }>;
  majorLatLines: Array<{ lat: number; label: string }>;
  minorLonLines: number[];
  minorLatLines: number[];
};

const METERS_PER_DEG_LAT = 111_320;

function safeInt(value: number) {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return 0;
  return rounded;
}

function safeNumber(value: number) {
  if (!Number.isFinite(value)) return 0;
  return value;
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function computeGrid(bounds: LatLngBounds, config: GridConfig): GridComputed | null {
  if (!config.enabled) return null;
  if (!config.anchor) return null;

  const majorMeters = Math.max(10, config.majorSpacingMeters);
  const minorDivisions = clampInt(config.minorDivisions, 2, 20);
  const anchor = config.anchor;

  const offsetEMeters = safeNumber(anchor.eastingMeters);
  const offsetNMeters = safeNumber(anchor.northingMeters);

  const midLat = (bounds.latMin + bounds.latMax) / 2;
  const anchorLatRad = (midLat * Math.PI) / 180;
  const cosLat = Math.max(0.15, Math.cos(anchorLatRad));

  // Grid size is fixed; only the label origin (offset) changes.
  const majorLatStepDeg = majorMeters / METERS_PER_DEG_LAT;
  const majorLonStepDeg = majorMeters / (METERS_PER_DEG_LAT * cosLat);
  const minorLatStepDeg = majorLatStepDeg / minorDivisions;
  const minorLonStepDeg = majorLonStepDeg / minorDivisions;

  // Origin is the coordinate of the (0,0) major intersection.
  const originLat = anchor.coordinate.latitude - (offsetNMeters / majorMeters) * majorLatStepDeg;
  const originLon = anchor.coordinate.longitude - (offsetEMeters / majorMeters) * majorLonStepDeg;

  const lonMin = Math.min(bounds.lonMin, bounds.lonMax);
  const lonMax = Math.max(bounds.lonMin, bounds.lonMax);
  const latMin = Math.min(bounds.latMin, bounds.latMax);
  const latMax = Math.max(bounds.latMin, bounds.latMax);

  // Safety: instead of hard-clamping (which can make lines disappear), we increase skip.
  const maxMajorLines = 140;
  const maxMinorLines = 600;

  const majorLonStart = Math.floor((lonMin - originLon) / majorLonStepDeg);
  const majorLonEnd = Math.ceil((lonMax - originLon) / majorLonStepDeg);
  const majorLatStart = Math.floor((latMin - originLat) / majorLatStepDeg);
  const majorLatEnd = Math.ceil((latMax - originLat) / majorLatStepDeg);

  const majorLonCount = Math.max(0, majorLonEnd - majorLonStart + 1);
  const majorLatCount = Math.max(0, majorLatEnd - majorLatStart + 1);
  const majorLonSkip = Math.max(1, Math.ceil(majorLonCount / maxMajorLines));
  const majorLatSkip = Math.max(1, Math.ceil(majorLatCount / maxMajorLines));

  const majorLonLines: Array<{ lon: number; label: string }> = [];
  for (let i = majorLonStart; i <= majorLonEnd; i += majorLonSkip) {
    const lon = originLon + i * majorLonStepDeg;
    if (lon < lonMin - majorLonStepDeg || lon > lonMax + majorLonStepDeg) continue;
    majorLonLines.push({ lon, label: String(i) });
  }

  const majorLatLines: Array<{ lat: number; label: string }> = [];
  for (let j = majorLatStart; j <= majorLatEnd; j += majorLatSkip) {
    const lat = originLat + j * majorLatStepDeg;
    if (lat < latMin - majorLatStepDeg || lat > latMax + majorLatStepDeg) continue;
    majorLatLines.push({ lat, label: String(j) });
  }

  const minorLonStart = Math.floor((lonMin - originLon) / minorLonStepDeg);
  const minorLonEnd = Math.ceil((lonMax - originLon) / minorLonStepDeg);
  const minorLonLines: number[] = [];
  for (let i = minorLonStart; i <= minorLonEnd && minorLonLines.length < maxMinorLines; i += 1) {
    if (i % minorDivisions === 0) continue; // major line
    const lon = originLon + i * minorLonStepDeg;
    if (lon < lonMin - minorLonStepDeg || lon > lonMax + minorLonStepDeg) continue;
    minorLonLines.push(lon);
  }

  const minorLatStart = Math.floor((latMin - originLat) / minorLatStepDeg);
  const minorLatEnd = Math.ceil((latMax - originLat) / minorLatStepDeg);
  const minorLatLines: number[] = [];
  for (let j = minorLatStart; j <= minorLatEnd && minorLatLines.length < maxMinorLines; j += 1) {
    if (j % minorDivisions === 0) continue; // major line
    const lat = originLat + j * minorLatStepDeg;
    if (lat < latMin - minorLatStepDeg || lat > latMax + minorLatStepDeg) continue;
    minorLatLines.push(lat);
  }

  return { majorLonLines, majorLatLines, minorLonLines, minorLatLines };
}
