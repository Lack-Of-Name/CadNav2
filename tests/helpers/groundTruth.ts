// CadNav 2 test helpers — Copyright (C) 2026 Lyren, Alexander Ellul
// SPDX-License-Identifier: LGPL-3.0-or-later
/**
 * Ground truth for the MGRS tests.
 *
 * `lib/mgrs.ts` is a hand port of the proj4/mgrs package (Snyder's meridian
 * arc series, USGS PP1395). To test its *accuracy* rather than just its
 * self-consistency we compare against an independently maintained
 * implementation of the same WGS84 UTM projection: the `proj4` package
 * (different codebase, same published specification).
 *
 * On top of proj4 we layer:
 *  - a small set of anchor facts that follow directly from the UTM/MGRS
 *    specification (false easting 500 000, zone width 6°, the equator /
 *    prime-meridian intersection sitting 3° west of zone 31's central
 *    meridian, latitude band boundaries, the Norway/Svalbard zone rules);
 *  - great-circle distance helpers so assertions can talk in meters.
 */
import proj4 from 'proj4';

/** WGS84 UTM projection string for a zone (northern hemisphere). */
function utmProjString(zone: number, south: boolean): string {
  return `+proj=utm +zone=${zone} ${south ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`;
}

/** Forward UTM (easting/northing) from lat/lon via proj4. Full float precision. */
export function truthUtmForward(
  lat: number,
  lon: number,
  zone: number,
): { easting: number; northing: number } {
  const [easting, northing] = proj4('EPSG:4326', utmProjString(zone, lat < 0), [lon, lat]) as [
    number,
    number,
  ];
  return { easting, northing };
}

/** Inverse UTM: standard northing (with the 10,000,000 m southern offset). */
export function truthUtmInverse(
  zone: number,
  easting: number,
  northing: number,
  south: boolean,
): { latitude: number; longitude: number } {
  const [longitude, latitude] = proj4(utmProjString(zone, south), 'EPSG:4326', [easting, northing]) as [
    number,
    number,
  ];
  return { latitude, longitude };
}

/** Great-circle distance in meters (WGS84 mean radius) for comparison asserts. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type Sample = { lat: number; lon: number; label: string };

/**
 * A coarse-but-global grid of points well inside the UTM validity envelope
 * (−80 ≤ φ ≤ 84) and at least ~0.4° from any zone edge, so both the lib and
 * proj4 project into the same zone without edge effects.
 */
export function sampleGrid(): Sample[] {
  const pts: Sample[] = [];
  for (let lat = -76; lat <= 80; lat += 8) {
    for (let lon = -176; lon <= 176; lon += 12) {
      // Zone boundaries sit at multiples of 6 offset by −180.
      const offsetFromBoundary = ((lon + 180) % 6 + 6) % 6;
      if (offsetFromBoundary < 0.4 || offsetFromBoundary > 5.6) continue;
      pts.push({ lat, lon, label: `${lat},${lon}` });
    }
  }
  return pts;
}

/**
 * Well-known landmarks (documented public coordinates) spanning both
 * hemispheres, high and low latitudes, and both sides of zone meridians.
 */
export const LANDMARKS: Sample[] = [
  { lat: 38.8976763, lon: -77.0365298, label: 'White House' },
  { lat: 40.6892474, lon: -74.044502, label: 'Statue of Liberty' },
  { lat: -33.856784, lon: 151.215297, label: 'Sydney Opera House' },
  { lat: 27.988144, lon: 86.924975, label: 'Mount Everest summit' },
  { lat: -22.951916, lon: -43.210487, label: 'Christ the Redeemer' },
  { lat: 64.146582, lon: -21.942635, label: 'Reykjavik' },
  { lat: -33.924869, lon: 18.424055, label: 'Cape Town' },
  { lat: 51.47788, lon: -0.00148, label: 'Greenwich Observatory' },
  { lat: 78.223166, lon: 15.646237, label: 'Longyearbyen (Svalbard)' },
  { lat: 60.169856, lon: 24.938379, label: 'Helsinki' },
  { lat: -54.80191, lon: -68.302951, label: 'Ushuaia' },
  { lat: 0, lon: 0, label: 'Equator / prime meridian' },
];
