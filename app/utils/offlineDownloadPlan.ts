import type { LatLng } from './geo';
import { estimateTileCount, tilesForBounds, type LatLonBounds, type TileXYZ } from './offlineTiles';

export type OfflineDownloadPlan = {
  // MARK: What to download
  bounds: LatLonBounds;
  tiles: TileXYZ[];
  total: number;
  minZoom: number;
  maxZoom: number;

  // MARK: Where to download from
  // Template uses {z}/{x}/{y} placeholders.
  // NOTE: Some providers use {z}/{y}/{x} ordering — that is handled by the caller by choosing the right template.
  urlTemplate: string;

  // MARK: Where to store locally
  // Root URI MUST end with '/'. For Expo FileSystem this is typically a 'file://' URI.
  rootUri: string;
};

export type BuildOfflineDownloadPlanArgs = {
  bounds: LatLonBounds;
  urlTemplate: string;
  rootUri: string;
  minZoom: number;
  maxZoom: number;

  // MARK: Safety caps
  // This is a guardrail to prevent accidental huge downloads.
  maxTiles: number;
};

export type BuildOfflineDownloadPlanResult =
  | { ok: true; plan: OfflineDownloadPlan }
  | { ok: false; error: string };

// MARK: URL / path rendering helpers
export function renderRemoteUrl(urlTemplate: string, t: TileXYZ) {
  return urlTemplate.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y));
}

export function renderLocalTileUri(rootUri: string, t: TileXYZ) {
  // Storage layout is fixed: {root}/{z}/{x}/{y}.png
  return `${rootUri}${t.z}/${t.x}/${t.y}.png`;
}

// MARK: Planning
// This function is pure and platform-independent.
// It produces the exact set of tiles to fetch + metadata for progress UI.
//
// Implementation note:
// - Many failures we hit earlier were IO/runtime issues.
// - Keeping the planning step pure makes it easy to unit test and reason about.
export function buildOfflineDownloadPlan(args: BuildOfflineDownloadPlanArgs): BuildOfflineDownloadPlanResult {
  const { bounds, urlTemplate, rootUri, minZoom, maxZoom, maxTiles } = args;

  if (!urlTemplate || !urlTemplate.includes('{z}') || !urlTemplate.includes('{x}') || !urlTemplate.includes('{y}')) {
    return { ok: false, error: 'Invalid urlTemplate: must contain {z}, {x}, and {y}.' };
  }
  if (!rootUri || !rootUri.endsWith('/')) {
    return { ok: false, error: 'Invalid rootUri: must be a non-empty string ending with "/".' };
  }
  if (minZoom < 0 || maxZoom < 0 || maxZoom < minZoom) {
    return { ok: false, error: 'Invalid zoom range.' };
  }

  // MARK: Tile cap enforcement
  // Reduce maxZoom until we fit under maxTiles. This preserves the area selection.
  let plannedMaxZoom = maxZoom;
  let total = estimateTileCount(bounds, minZoom, plannedMaxZoom);
  while (total > maxTiles && plannedMaxZoom > minZoom) {
    plannedMaxZoom -= 1;
    total = estimateTileCount(bounds, minZoom, plannedMaxZoom);
  }

  if (total > maxTiles) {
    return {
      ok: false,
      error: `Selection too large (${total} tiles). Reduce the area or zoom range.`,
    };
  }

  const tiles: TileXYZ[] = [];
  for (let z = minZoom; z <= plannedMaxZoom; z++) {
    tiles.push(...tilesForBounds(bounds, z));
  }

  return {
    ok: true,
    plan: {
      bounds,
      tiles,
      total: tiles.length,
      minZoom,
      maxZoom: plannedMaxZoom,
      urlTemplate,
      rootUri,
    },
  };
}

// MARK: Optional verification helpers
// These are useful for a downloader implementation to quickly verify something was written.
export function planSampleTiles(bounds: LatLonBounds, minZoom: number, maxZoom: number) {
  const centerCoord: LatLng = {
    latitude: (bounds.latMin + bounds.latMax) / 2,
    longitude: (bounds.lonMin + bounds.lonMax) / 2,
  };
  const tl: LatLng = { latitude: bounds.latMax, longitude: bounds.lonMin };
  const br: LatLng = { latitude: bounds.latMin, longitude: bounds.lonMax };

  const sampleCoords = [centerCoord, tl, br];
  const sampleZooms = [minZoom, maxZoom].filter((z, idx, arr) => arr.indexOf(z) === idx);

  return { sampleCoords, sampleZooms };
}
