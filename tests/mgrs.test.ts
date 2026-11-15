// CadNav 2 tests — Copyright (C) 2026 Lyren, Alexander Ellul
// SPDX-License-Identifier: LGPL-3.0-or-later
/**
 * MGRS accuracy tests against known ground truth.
 *
 * Ground truth comes from two independent sources:
 *  1. The `proj4` package — a mature, independently maintained
 *     implementation of the WGS84 UTM projection. This validates the numeric
 *     projection in `lib/mgrs.ts`.
 *  2. Well-known published landmarks and the closed-form UTM anchor at the
 *     equator / prime meridian (zone 31, easting 166021.44, northing 0),
 *     plus the MGRS specification rules for zones, bands and the precision
 *     ladder.
 *
 * `lib/mgrs.ts` truncates easting/northing to whole meters
 * (Math.trunc in latLonToUtm), so the forward direction can never agree with
 * ground truth to better than 1 m; tests assert a tolerance just above that
 * so a real regression still trips them.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  latLonToMGRS,
  latLonToUtm,
  latitudeBandLetter,
  mgrsAccuracyMeters,
  mgrsAreaString,
  mgrsToLatLon,
  parseMGRS,
  utmGridConvergence,
  utmToLatLon,
  utmZoneOfLongitude,
} from '../lib/mgrs.ts';

import {
  LANDMARKS,
  distanceMeters,
  sampleGrid,
  truthUtmForward,
  truthUtmInverse,
} from './helpers/groundTruth.ts';

/**
 * The lib truncates to whole meters, so forward agreement can never beat
 * 1 m. Anything beyond ~1.05 m means the projection itself drifted.
 */
const FORWARD_TOLERANCE_M = 1.05;
/** Inverse is full float precision; it matched proj4 to ~1.3 cm in practice. */
const INVERSE_TOLERANCE_M = 0.5;

describe('utmZoneOfLongitude', () => {
  it('maps longitudes to their standard 6° zone', () => {
    assert.equal(utmZoneOfLongitude(-180), 1);
    assert.equal(utmZoneOfLongitude(-179.999), 1);
    // Zone 1 covers [-180, -174); -174 itself opens zone 2.
    assert.equal(utmZoneOfLongitude(-174.001), 1);
    assert.equal(utmZoneOfLongitude(-174), 2);
    assert.equal(utmZoneOfLongitude(-173.999), 2);
    assert.equal(utmZoneOfLongitude(0), 31);
    assert.equal(utmZoneOfLongitude(2.999), 31);
    // Base zone only: the Norway/Svalbard overrides are applied in latLonToUtm.
    assert.equal(utmZoneOfLongitude(3), 31);
    assert.equal(utmZoneOfLongitude(6), 32);
    assert.equal(utmZoneOfLongitude(179.999), 60);
  });

  it('puts longitude 180 in zone 60 (not zone 1)', () => {
    assert.equal(utmZoneOfLongitude(180), 60);
  });

  it('is monotonic across the whole globe', () => {
    for (let lon = -180; lon < 180; lon += 0.5) {
      const a = utmZoneOfLongitude(lon);
      const b = utmZoneOfLongitude(lon + 0.5);
      assert.ok(b === a || b === a + 1, `zone jumped from ${a} to ${b} at lon=${lon}`);
      assert.ok(a >= 1 && a <= 60, `zone out of range at lon=${lon}: ${a}`);
    }
  });
});

describe('latitudeBandLetter', () => {
  it('follows the C..X band table (8° bands, I and O skipped)', () => {
    assert.equal(latitudeBandLetter(-80), 'C');
    assert.equal(latitudeBandLetter(-79.999), 'C');
    assert.equal(latitudeBandLetter(-72), 'D');
    assert.equal(latitudeBandLetter(-40), 'H');
    assert.equal(latitudeBandLetter(0), 'N');
    assert.equal(latitudeBandLetter(38.9), 'S');
    assert.equal(latitudeBandLetter(51.4), 'U');
    assert.equal(latitudeBandLetter(60), 'V');
    assert.equal(latitudeBandLetter(71.999), 'W');
  });

  it('gives the 12°-tall X band its full extent (72..84)', () => {
    assert.equal(latitudeBandLetter(72), 'X');
    assert.equal(latitudeBandLetter(78.2), 'X');
    assert.equal(latitudeBandLetter(84), 'X');
  });

  it('returns Z outside the MGRS latitude limits', () => {
    assert.equal(latitudeBandLetter(84.001), 'Z');
    assert.equal(latitudeBandLetter(-80.001), 'Z');
    assert.equal(latitudeBandLetter(90), 'Z');
  });
});

describe('special MGRS zones (Norway & Svalbard)', () => {
  it('uses zone 32 for south-west Norway (56–64°N, 3–12°E)', () => {
    // Standard zone would be 31 or 32 depending on longitude; the rule forces 32.
    assert.equal(latLonToUtm(60, 4).zone, 32);
    assert.equal(latLonToUtm(60, 11.999).zone, 32);
    // Just outside the latitude band: no override.
    assert.equal(latLonToUtm(55.9, 5).zone, 31);
  });

  it('splits Svalbard (72–84°N) into zones 31/33/35/37', () => {
    assert.equal(latLonToUtm(78, 1).zone, 31);
    assert.equal(latLonToUtm(78, 10).zone, 33);
    assert.equal(latLonToUtm(78, 22).zone, 35);
    assert.equal(latLonToUtm(78, 34).zone, 37);
    // Between the defined wedges the standard zone applies (zone 32 gap).
    assert.equal(latLonToUtm(78, 8.5).zone, 31);
  });

  it('gives special-zone points a consistent band letter', () => {
    assert.equal(latLonToUtm(78.223166, 15.646237).band, 'X');
    assert.equal(latLonToUtm(60, 4).band, 'V');
  });
});

describe('forward UTM projection vs proj4 ground truth', () => {
  it('agrees with proj4 across a global sample grid', () => {
    const grid = sampleGrid();
    assert.ok(grid.length > 100, `expected a dense sample grid, got ${grid.length}`);

    let worstE = 0;
    let worstN = 0;
    for (const p of grid) {
      const lib = latLonToUtm(p.lat, p.lon);
      const truth = truthUtmForward(p.lat, p.lon, lib.zone);
      worstE = Math.max(worstE, Math.abs(lib.easting - truth.easting));
      worstN = Math.max(worstN, Math.abs(lib.northing - truth.northing));
    }
    assert.ok(worstE <= FORWARD_TOLERANCE_M, `max easting error ${worstE.toFixed(3)} m exceeds ${FORWARD_TOLERANCE_M} m`);
    assert.ok(worstN <= FORWARD_TOLERANCE_M, `max northing error ${worstN.toFixed(3)} m exceeds ${FORWARD_TOLERANCE_M} m`);
  });

  it('agrees with proj4 at well-known landmarks', () => {
    for (const lm of LANDMARKS) {
      const lib = latLonToUtm(lm.lat, lm.lon);
      const truth = truthUtmForward(lm.lat, lm.lon, lib.zone);
      const dE = Math.abs(lib.easting - truth.easting);
      const dN = Math.abs(lib.northing - truth.northing);
      assert.ok(
        dE <= FORWARD_TOLERANCE_M && dN <= FORWARD_TOLERANCE_M,
        `${lm.label}: dE=${dE.toFixed(3)} dN=${dN.toFixed(3)} m`,
      );
    }
  });

  it('reproduces the canonical equator / prime-meridian anchor', () => {
    // (0°, 0°) sits 3° west of zone 31's central meridian. At the equator a
    // degree of longitude is ~111,319.49 m, so the easting must be
    // 500000 − 3×111319.49×(scale) ≈ 166021.44 m and the northing exactly 0.
    const utm = latLonToUtm(0, 0);
    assert.equal(utm.zone, 31);
    assert.equal(utm.band, 'N');
    assert.equal(utm.northing, 0);

    const truth = truthUtmForward(0, 0, 31);
    assert.ok(
      Math.abs(truth.easting - 166021.44) < 1,
      `expected the published 166021.44 m, got ${truth.easting.toFixed(2)}`,
    );
    assert.ok(
      Math.abs(utm.easting - 166021.44) <= FORWARD_TOLERANCE_M,
      `lib easting ${utm.easting} vs published 166021.44 m`,
    );
  });

  it('applies the 500,000 m false easting on every central meridian', () => {
    // A point exactly on its zone's central meridian has easting 500000.
    const northCm = latLonToUtm(45, 3); // zone 31, CM = 3°E
    assert.equal(northCm.zone, 31);
    assert.equal(northCm.easting, 500000);

    const southCm = latLonToUtm(-30, 15); // zone 33, CM = 15°E
    assert.equal(southCm.zone, 33);
    assert.equal(southCm.easting, 500000);

    // Cross-check the CM northing against proj4 for a spread of latitudes.
    for (const lat of [-55, -20, 0, 12, 45, 64]) {
      const utm = latLonToUtm(lat, lat === 0 ? 0 : 3); // 3°E is zone 31's CM
      const truth = truthUtmForward(lat, 3, 31);
      const dN = Math.abs(utm.northing - truth.northing);
      assert.ok(dN <= FORWARD_TOLERANCE_M, `CM northing at lat=${lat} off by ${dN.toFixed(3)} m`);
    }
  });

  it('places the southern hemisphere below the 10,000,000 m northing offset', () => {
    // Mirrored latitudes must straddle the 10,000,000 m offset.
    const north = latLonToUtm(30, 15);
    const south = latLonToUtm(-30, 15);
    assert.equal(north.zone, 33);
    assert.equal(south.zone, 33);
    assert.ok(north.northing < 5_000_000);
    assert.ok(
      Math.abs(south.northing - (10_000_000 - north.northing)) <= FORWARD_TOLERANCE_M,
      `southern northing ${south.northing} should mirror 10M − ${north.northing}`,
    );

    // Just south of the equator the northing sits just below 10,000,000.
    const nearEquator = latLonToUtm(-1, 15);
    assert.ok(
      nearEquator.northing > 9_000_000 && nearEquator.northing < 10_000_000,
      `near-equator southern northing out of range: ${nearEquator.northing}`,
    );

    // ...and the northern twin sits just above 0.
    assert.ok(latLonToUtm(1, 15).northing < 1_000_000);
  });
});

describe('inverse UTM projection vs proj4 ground truth', () => {
  it('agrees with the proj4 inverse within tolerance', () => {
    let worst = 0;
    let worstLabel = '';
    for (const p of sampleGrid()) {
      const lib = latLonToUtm(p.lat, p.lon);
      const a = utmToLatLon(lib.zone, lib.band, lib.easting, lib.northing);
      const b = truthUtmInverse(lib.zone, lib.easting, lib.northing, p.lat < 0);
      const d = distanceMeters(a.latitude, a.longitude, b.latitude, b.longitude);
      if (d > worst) {
        worst = d;
        worstLabel = p.label;
      }
    }
    assert.ok(worst <= INVERSE_TOLERANCE_M, `worst inverse mismatch ${worst.toFixed(4)} m at ${worstLabel}`);
  });

  it('round-trips every sample point back to its origin', () => {
    // Encode to whole-meter UTM then decode; residual is bounded by the
    // truncation plus the inverse's own error.
    for (const p of sampleGrid()) {
      const utm = latLonToUtm(p.lat, p.lon);
      const back = utmToLatLon(utm.zone, utm.band, utm.easting, utm.northing);
      const d = distanceMeters(p.lat, p.lon, back.latitude, back.longitude);
      assert.ok(d <= 1.5, `round trip for ${p.label} lost ${d.toFixed(3)} m`);
    }
  });
});

describe('MGRS encoding precision ladder', () => {
  it('maps digit counts to the specified cell sizes', () => {
    assert.equal(mgrsAccuracyMeters(5), 1);
    assert.equal(mgrsAccuracyMeters(4), 10);
    assert.equal(mgrsAccuracyMeters(3), 100);
    assert.equal(mgrsAccuracyMeters(2), 1000);
    assert.equal(mgrsAccuracyMeters(1), 10000);
  });

  it('encodes and reports matching cell sizes per precision', () => {
    const lat = 51.5007;
    const lon = -0.1246; // Big Ben
    for (const digits of [1, 2, 3, 4, 5]) {
      const s = latLonToMGRS(lat, lon, digits);
      const parsed = parseMGRS(s);
      assert.ok(parsed, `parseMGRS failed for ${s}`);
      assert.equal(parsed!.digits, digits, `digits mismatch for ${s}`);
      assert.equal(parsed!.accuracyMeters, mgrsAccuracyMeters(digits), `cell size mismatch for ${s}`);
    }
  });

  it('narrows the decoded cell as precision increases', () => {
    const lat = 51.5007;
    const lon = -0.1246;
    let prevCell = Infinity;
    for (const digits of [1, 2, 3, 4, 5]) {
      const parsed = parseMGRS(latLonToMGRS(lat, lon, digits))!;
      assert.ok(parsed.accuracyMeters < prevCell, `cell did not shrink at digits=${digits}`);
      prevCell = parsed.accuracyMeters;
    }
  });
});

describe('MGRS string layout', () => {
  it('encodes to "ZONE BAND SQ EEEEE NNNNN"', () => {
    const s = latLonToMGRS(51.5007, -0.1246, 5);
    const m = /^(\d{1,2})([A-Z]) ([A-Z]{2}) (\d{5}) (\d{5})$/.exec(s);
    assert.ok(m, `unexpected MGRS layout: ${s}`);
    assert.equal(m![1], '30');
    assert.equal(m![2], 'U');
  });

  it('omits digits cleanly for coarse precisions', () => {
    const s1 = latLonToMGRS(51.5007, -0.1246, 1);
    const m = /^(\d{1,2})([A-Z]) ([A-Z]{2}) (\d{1}) (\d{1})$/.exec(s1);
    assert.ok(m, `unexpected 1-digit MGRS layout: ${s1}`);
  });

  it('mgrsAreaString returns just the GZD + 100km square', () => {
    const area = mgrsAreaString(51.5007, -0.1246);
    const m = /^(\d{1,2})([A-Z]) ([A-Z]{2})$/.exec(area);
    assert.ok(m, `unexpected area layout: ${area}`);
    assert.equal(area, latLonToMGRS(51.5007, -0.1246, 5).split(' ').slice(0, 2).join(' '));
  });
});

describe('mgrsToLatLon returns the cell centre', () => {
  it('decodes 5-digit cells to within half a cell diagonal of any point inside', () => {
    // For a 1 m cell the centre is at most √2/2 ≈ 0.707 m from any point in it.
    for (const lm of LANDMARKS) {
      const s = latLonToMGRS(lm.lat, lm.lon, 5);
      const centre = mgrsToLatLon(s);
      assert.ok(centre, `mgrsToLatLon failed for ${s}`);
      const d = distanceMeters(lm.lat, lm.lon, centre!.latitude, centre!.longitude);
      // Source point truncates toward the SW corner (up to 1 m per axis),
      // then the centre adds up to 0.707 m; allow the full diagonal + slack.
      assert.ok(
        d <= Math.SQRT2 * centre!.accuracyMeters + 1.05,
        `${lm.label}: decoded centre ${d.toFixed(3)} m from source`,
      );
    }
  });

  it('decodes coarse cells to their centre, not their corner', () => {
    // A 1 km cell's centre must sit ~500 m inside from the SW corner.
    const s = latLonToMGRS(51.5007, -0.1246, 2);
    const parsed = parseMGRS(s)!;
    const corner = utmToLatLon(parsed.zone, parsed.band, parsed.easting, parsed.northing);
    const centre = mgrsToLatLon(s)!;
    const d = distanceMeters(corner.latitude, corner.longitude, centre.latitude, centre.longitude);
    // Half the cell diagonal for a 1 km cell is ~707 m.
    assert.ok(d > 300 && d < 800, `centre offset ${d.toFixed(1)} m from SW corner`);
    assert.equal(centre.accuracyMeters, 1000);
  });
});

describe('parseMGRS error handling', () => {
  it('returns null for malformed input', () => {
    assert.equal(parseMGRS(''), null);
    assert.equal(parseMGRS('   '), null);
    assert.equal(parseMGRS('garbage'), null);
    assert.equal(parseMGRS('99Z AA 12345 12345'), null); // invalid band Z
    assert.equal(parseMGRS('0A AA 12345 12345'), null); // invalid band A
    assert.equal(parseMGRS('31N UA 12345'), null); // odd digit count
    assert.equal(parseMGRS('31N UA 1234 56789'), null); // split 4/5 digits
    assert.equal(parseMGRS('31N UA ABCDE FGHIJ'), null); // non-numeric
    assert.equal(parseMGRS(''), null);
  });

  it('rejects a missing 100k square designator', () => {
    assert.equal(parseMGRS('31N'), null);
  });

  it('accepts lowercase and extra spacing', () => {
    const upper = latLonToMGRS(51.5007, -0.1246, 5);
    const lower = parseMGRS(upper.toLowerCase());
    assert.ok(lower, 'lowercase MGRS should parse');
    const spaced = parseMGRS(upper.replace(/ /g, '  '));
    assert.ok(spaced, 'extra-spaced MGRS should parse');
  });
});

describe('MGRS round-trip across the globe', () => {
  it('encodes then decodes every grid point into the correct cell', () => {
    for (const p of sampleGrid()) {
      for (const digits of [1, 2, 3, 4, 5]) {
        const s = latLonToMGRS(p.lat, p.lon, digits);
        const parsed = parseMGRS(s);
        assert.ok(parsed, `parseMGRS failed for ${s} (${p.label})`);

        // The decoded UTM must reproduce the source within the cell diagonal.
        const truth = truthUtmForward(p.lat, p.lon, parsed!.zone);
        const dEasting = Math.abs(truth.easting - parsed!.easting);
        const dNorthing = Math.abs(truth.northing - parsed!.northing);
        const limit = parsed!.accuracyMeters * Math.SQRT2 + FORWARD_TOLERANCE_M;
        assert.ok(
          dEasting <= limit && dNorthing <= limit,
          `${p.label} digits=${digits}: dE=${dEasting.toFixed(2)} dN=${dNorthing.toFixed(2)} (limit ${limit.toFixed(2)})`,
        );
      }
    }
  });
});

describe('grid convergence', () => {
  it('is zero on the central meridian', () => {
    assert.ok(Math.abs(utmGridConvergence(45, 3)) < 1e-9); // zone 31 CM = 3°E
    assert.ok(Math.abs(utmGridConvergence(-30, 15)) < 1e-9); // zone 33 CM = 15°E
  });

  it('has opposite signs east and west of the central meridian', () => {
    const west = utmGridConvergence(45, 2);
    const east = utmGridConvergence(45, 4);
    assert.ok(west * east < 0, `expected opposite signs, got west=${west} east=${east}`);
  });

  it('is zero at the equator regardless of longitude', () => {
    assert.ok(Math.abs(utmGridConvergence(0, 1)) < 1e-9);
  });

  it('grows with distance from the central meridian and with latitude', () => {
    const near = Math.abs(utmGridConvergence(45, 4));
    const far = Math.abs(utmGridConvergence(45, 5.9));
    assert.ok(far > near, `expected |convergence| to grow away from CM: ${near} vs ${far}`);
  });
});

describe('known landmark MGRS strings (regression anchors)', () => {
  // Frozen from the lib and cross-checked against proj4 forward projection
  // (the UTM easting/northing must match proj4 to < 1 m) so these pin both
  // the projection and the string formatting.
  type Case = { lat: number; lon: number; mgrs: string; area: string };
  const CASES: Case[] = [
    { lat: 38.8976763, lon: -77.0365298, mgrs: '18S UJ 23391 07393', area: '18S UJ' },
    { lat: 40.6892474, lon: -74.044502, mgrs: '18T WL 80735 04700', area: '18T WL' },
    { lat: -33.856784, lon: 151.215297, mgrs: '56H LH 34900 52290', area: '56H LH' },
    { lat: 27.988144, lon: 86.924975, mgrs: '45R VL 92622 95891', area: '45R VL' },
    { lat: -22.951916, lon: -43.210487, mgrs: '23K PQ 83477 60685', area: '23K PQ' },
    { lat: 64.146582, lon: -21.942635, mgrs: '27W VM 54136 13687', area: '27W VM' },
    { lat: -33.924869, lon: 18.424055, mgrs: '34H BH 61877 43185', area: '34H BH' },
    { lat: 51.47788, lon: -0.00148, mgrs: '30U YC 08214 07233', area: '30U YC' },
    { lat: 78.223166, lon: 15.646237, mgrs: '33X WG 14723 83356', area: '33X WG' },
    { lat: 60.169856, lon: 24.938379, mgrs: '35V LG 85609 72113', area: '35V LG' },
    { lat: -54.80191, lon: -68.302951, mgrs: '19F EV 44808 27028', area: '19F EV' },
    { lat: 0, lon: 0, mgrs: '31N AA 66021 00000', area: '31N AA' },
  ];

  for (const c of CASES) {
    it(`encodes lat=${c.lat} lon=${c.lon} to ${c.mgrs}`, () => {
      assert.equal(latLonToMGRS(c.lat, c.lon, 5), c.mgrs);
      assert.equal(mgrsAreaString(c.lat, c.lon), c.area);

      // Cross-check the embedded UTM against proj4 ground truth.
      const parsed = parseMGRS(c.mgrs);
      assert.ok(parsed, `could not parse ${c.mgrs}`);
      const truth = truthUtmForward(c.lat, c.lon, parsed!.zone);
      const dE = Math.abs(truth.easting - parsed!.easting);
      const dN = Math.abs(truth.northing - parsed!.northing);
      assert.ok(
        dE <= FORWARD_TOLERANCE_M && dN <= FORWARD_TOLERANCE_M,
        `${c.mgrs}: ground truth drift dE=${dE.toFixed(3)} dN=${dN.toFixed(3)} m`,
      );
    });
  }
});
