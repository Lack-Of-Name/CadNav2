import type { LatLng } from './geo';

export type LatLonBounds = { latMin: number; latMax: number; lonMin: number; lonMax: number };

export type TileXYZ = { z: number; x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function latLonToTileXY(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);

  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );

  return { x, y };
}

export function tileForCoordinate(coord: LatLng, z: number): TileXYZ {
  const { x, y } = latLonToTileXY(coord.latitude, coord.longitude, z);
  return { z, x, y };
}

export function tilesForBounds(bounds: LatLonBounds, z: number): TileXYZ[] {
  const n = 2 ** z;

  const a = latLonToTileXY(bounds.latMax, bounds.lonMin, z);
  const b = latLonToTileXY(bounds.latMin, bounds.lonMax, z);

  let xMin = clamp(Math.min(a.x, b.x), 0, n - 1);
  let xMax = clamp(Math.max(a.x, b.x), 0, n - 1);
  let yMin = clamp(Math.min(a.y, b.y), 0, n - 1);
  let yMax = clamp(Math.max(a.y, b.y), 0, n - 1);

  const tiles: TileXYZ[] = [];
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      tiles.push({ z, x, y });
    }
  }
  return tiles;
}

export function estimateTileCount(bounds: LatLonBounds, minZoom: number, maxZoom: number) {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    total += tilesForBounds(bounds, z).length;
  }
  return total;
}

export function normalizeBoundsFromCorners(a: LatLng, b: LatLng): LatLonBounds {
  return {
    latMin: Math.min(a.latitude, b.latitude),
    latMax: Math.max(a.latitude, b.latitude),
    lonMin: Math.min(a.longitude, b.longitude),
    lonMax: Math.max(a.longitude, b.longitude),
  };
}
