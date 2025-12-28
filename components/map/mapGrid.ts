const EARTH_RADIUS_M = 6378137;
const MAX_MERCATOR_LAT = 85.05112878;

export type LonLat = [number, number];
export type LonLatBounds = { west: number; south: number; east: number; north: number };
export type GridOrigin = { latitude: number; longitude: number };

type GeoJSONFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry:
      | { type: 'LineString'; coordinates: LonLat[] }
      | { type: 'Point'; coordinates: LonLat };
    properties: Record<string, unknown>;
  }[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lonLatToMercatorMeters(lon: number, lat: number): { x: number; y: number } {
  const clampedLat = clamp(lat, -MAX_MERCATOR_LAT, MAX_MERCATOR_LAT);
  const x = (EARTH_RADIUS_M * lon * Math.PI) / 180;
  const y = EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + (clampedLat * Math.PI) / 360));
  return { x, y };
}

function mercatorMetersToLonLat(x: number, y: number): LonLat {
  const lon = (x / EARTH_RADIUS_M) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / EARTH_RADIUS_M)) - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
}

export function gridOffsetMetersToLatLon(origin: GridOrigin, eastingMeters: number, northingMeters: number) {
  const o = lonLatToMercatorMeters(origin.longitude, origin.latitude);
  const [longitude, latitude] = mercatorMetersToLonLat(o.x + eastingMeters, o.y + northingMeters);
  return { latitude, longitude };
}

function snapDown(value: number, step: number) {
  return Math.floor(value / step) * step;
}

function snapUp(value: number, step: number) {
  return Math.ceil(value / step) * step;
}

function baseGridStepMetersForZoom(zoom: number) {
  // Denser grid at lower zooms.
  if (zoom >= 12) return 1000;
  if (zoom >= 10) return 2000;
  if (zoom >= 8) return 4000;
  if (zoom >= 6) return 8000;
  if (zoom >= 4) return 16000;
  return 32000;
}

function boundsToMercatorRect(bounds: LonLatBounds) {
  const sw = lonLatToMercatorMeters(bounds.west, bounds.south);
  const ne = lonLatToMercatorMeters(bounds.east, bounds.north);
  return {
    xmin: Math.min(sw.x, ne.x),
    xmax: Math.max(sw.x, ne.x),
    ymin: Math.min(sw.y, ne.y),
    ymax: Math.max(sw.y, ne.y),
  };
}

function originToMercator(origin?: GridOrigin | null) {
  if (!origin) return { x: 0, y: 0 };
  return lonLatToMercatorMeters(origin.longitude, origin.latitude);
}

function estimateLineCount(rect: { xmin: number; xmax: number; ymin: number; ymax: number }, step: number) {
  const xLines = Math.max(0, Math.floor((rect.xmax - rect.xmin) / step) + 2);
  const yLines = Math.max(0, Math.floor((rect.ymax - rect.ymin) / step) + 2);
  return xLines + yLines;
}

function buildGridLines(
  bounds: LonLatBounds,
  stepMeters: number,
  properties: Record<string, unknown>,
  origin?: GridOrigin | null
): GeoJSONFeatureCollection {
  const rect = boundsToMercatorRect(bounds);
  const o = originToMercator(origin);

  const startX = o.x + snapDown(rect.xmin - o.x, stepMeters);
  const endX = o.x + snapUp(rect.xmax - o.x, stepMeters);
  const startY = o.y + snapDown(rect.ymin - o.y, stepMeters);
  const endY = o.y + snapUp(rect.ymax - o.y, stepMeters);

  const features: GeoJSONFeatureCollection['features'] = [];

  for (let x = startX; x <= endX; x += stepMeters) {
    const a = mercatorMetersToLonLat(x, rect.ymin);
    const b = mercatorMetersToLonLat(x, rect.ymax);
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [a, b] },
      properties: { kind: 'grid', axis: 'x', stepMeters, ...properties },
    });
  }

  for (let y = startY; y <= endY; y += stepMeters) {
    const a = mercatorMetersToLonLat(rect.xmin, y);
    const b = mercatorMetersToLonLat(rect.xmax, y);
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [a, b] },
      properties: { kind: 'grid', axis: 'y', stepMeters, ...properties },
    });
  }

  return { type: 'FeatureCollection', features };
}

function buildGridLinePositions(bounds: LonLatBounds, stepMeters: number, origin?: GridOrigin | null) {
  const rect = boundsToMercatorRect(bounds);
  const o = originToMercator(origin);

  const startX = o.x + snapDown(rect.xmin - o.x, stepMeters);
  const endX = o.x + snapUp(rect.xmax - o.x, stepMeters);
  const startY = o.y + snapDown(rect.ymin - o.y, stepMeters);
  const endY = o.y + snapUp(rect.ymax - o.y, stepMeters);

  return { rect, o, startX, endX, startY, endY };
}

function chooseStepMeters(bounds: LonLatBounds, zoom: number, maxLines: number) {
  const sw = lonLatToMercatorMeters(bounds.west, bounds.south);
  const ne = lonLatToMercatorMeters(bounds.east, bounds.north);

  const xmin = Math.min(sw.x, ne.x);
  const xmax = Math.max(sw.x, ne.x);
  const ymin = Math.min(sw.y, ne.y);
  const ymax = Math.max(sw.y, ne.y);

  let step = baseGridStepMetersForZoom(zoom);

  // Increase step until the number of lines is below the cap.
  for (let i = 0; i < 12; i++) {
    const xLines = Math.max(0, Math.floor((xmax - xmin) / step) + 2);
    const yLines = Math.max(0, Math.floor((ymax - ymin) / step) + 2);
    const total = xLines + yLines;
    if (total <= maxLines) break;
    step *= 2;
  }

  return step;
}

export function buildMapGridGeoJSON(bounds: LonLatBounds, zoom: number, origin?: GridOrigin | null): GeoJSONFeatureCollection {
  const stepMeters = chooseStepMeters(bounds, zoom, 320);
  return buildGridLines(bounds, stepMeters, { weight: 'major' }, origin);
}

export function buildMapGridNumbersGeoJSON(bounds: LonLatBounds, zoom: number, origin?: GridOrigin | null): GeoJSONFeatureCollection {
  const stepMeters = chooseStepMeters(bounds, zoom, 320);
  const { rect, o, startX, endX, startY, endY } = buildGridLinePositions(bounds, stepMeters, origin);

  // Hide labels when zoomed too far out; they start to clutter.
  // "Looks ok until about 32km on each side" -> about ~64km total span.
  const spanX = rect.xmax - rect.xmin;
  const spanY = rect.ymax - rect.ymin;
  if (Math.max(spanX, spanY) > 64_000) {
    return { type: 'FeatureCollection', features: [] };
  }

  // Place labels inset from the viewport edges so they're visible and not cramped.
  const inset = Math.min(350, Math.max(80, Math.round(stepMeters / 12)));

  const features: GeoJSONFeatureCollection['features'] = [];

  // Vertical lines: label at (x, top)
  for (let x = startX; x <= endX; x += stepMeters) {
    const km = Math.round((x - o.x) / 1000);
    const pt = mercatorMetersToLonLat(x, rect.ymax - inset);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: pt },
      properties: { kind: 'gridLabel', axis: 'x', stepMeters, km, label: String(km) },
    });
  }

  // Horizontal lines: label at (right, y)
  for (let y = startY; y <= endY; y += stepMeters) {
    const km = Math.round((y - o.y) / 1000);
    const pt = mercatorMetersToLonLat(rect.xmax - inset, y);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: pt },
      properties: { kind: 'gridLabel', axis: 'y', stepMeters, km, label: String(km) },
    });
  }

  return { type: 'FeatureCollection', features };
}

export function buildMapGridSubdivisionsGeoJSON(
  bounds: LonLatBounds,
  zoom: number,
  origin?: GridOrigin | null
): GeoJSONFeatureCollection {
  // Show subdivisions earlier; keep it safe via a line-count cap.
  if (zoom < 8) return { type: 'FeatureCollection', features: [] };

  const majorStep = chooseStepMeters(bounds, zoom, 320);
  const stepMeters = Math.max(100, Math.round(majorStep / 10));

  const rect = boundsToMercatorRect(bounds);
  if (estimateLineCount(rect, stepMeters) > 1000) {
    return { type: 'FeatureCollection', features: [] };
  }

  return buildGridLines(bounds, stepMeters, { weight: 'minor', majorStepMeters: majorStep, stepMeters }, origin);
}
