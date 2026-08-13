/**
 * MGRS / UTM conversion helpers.
 *
 * Ported from the MIT-licensed `mgrs` package (https://github.com/proj4js/mgrs),
 * which itself follows the US NGA TR8350.2 specification. Faithfully preserves
 * the reference algorithm (including the 100,000m square "set" lettering).
 */

export type LatLon = { latitude: number; longitude: number };

/** UTM zone width in degrees */
const UTM_ZONE_WIDTH = 6;

/** Scale factor along the central meridian */
const SCALE_FACTOR = 0.9996;

/** Semimajor axis (half the width of the earth) in meters */
const SEMI_MAJOR_AXIS = 6378137;

/** First eccentricity squared */
const ECC_SQUARED = 0.00669438;

/** The easting of the central meridian of each UTM zone */
const EASTING_OFFSET = 500000;

/** The northing of the equator for southern hemisphere locations (in UTM) */
const NORTHING_OFFSET = 10000000;

const A = 65; // A
const I = 73; // I
const O = 79; // O
const V = 86; // V
const Z = 90; // Z

/** Number of 100km "sets" */
const NUM_100K_SETS = 6;

/** The column letters (for easting) of the lower left value, per set. */
const SET_ORIGIN_COLUMN_LETTERS = 'AJSAJS';

/** The row letters (for northing) of the lower left value, per set. */
const SET_ORIGIN_ROW_LETTERS = 'AFAFAF';

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad: number) {
  return (180 * rad) / Math.PI;
}

/** UTM zone number for a longitude (1-60). */
export function utmZoneOfLongitude(lon: number): number {
  let zone = Math.floor((lon + 180) / UTM_ZONE_WIDTH) + 1;
  // Make sure the longitude 180 is in Zone 60
  if (lon === 180) {
    zone = 60;
  }
  return zone;
}

/**
 * Apply the special-zone overrides (Norway & Svalbard) used by the MGRS
 * standard. Returns the standard UTM zone adjusted, or the input zone.
 */
function zoneWithSpecialCases(lat: number, lon: number, zone: number): number {
  let z = zone;
  // Special zone for Norway
  if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) {
    z = 32;
  }
  // Special zones for Svalbard
  if (lat >= 72 && lat < 84) {
    if (lon >= 0 && lon < 9) {
      z = 31;
    } else if (lon >= 9 && lon < 21) {
      z = 33;
    } else if (lon >= 21 && lon < 33) {
      z = 35;
    } else if (lon >= 33 && lon < 42) {
      z = 37;
    }
  }
  return z;
}

/**
 * Calculate the MGRS latitude band designator letter for the given latitude.
 * Returns 'Z' outside the MGRS range (-80..84).
 */
export function latitudeBandLetter(latitude: number): string {
  if (latitude <= 84 && latitude >= 72) {
    // the X band is 12 degrees high
    return 'X';
  } else if (latitude < 72 && latitude >= -80) {
    // Latitude bands are lettered C through X, excluding I and O
    const bandLetters = 'CDEFGHJKLMNPQRSTUVWX';
    const bandHeight = 8;
    const minLatitude = -80;
    const index = Math.floor((latitude - minLatitude) / bandHeight);
    return bandLetters[index];
  }
  // Outside MGRS limits
  return 'Z';
}

/** Forward UTM projection (WGS84) for a given lat/lon and zone. */
function utmForward(lat: number, lon: number, zoneNumber: number): { easting: number; northing: number } {
  const a = SEMI_MAJOR_AXIS;
  const LatRad = degToRad(lat);
  const LongRad = degToRad(lon);

  // +3 puts origin in middle of zone
  const LongOrigin = (zoneNumber - 1) * UTM_ZONE_WIDTH - 180 + UTM_ZONE_WIDTH / 2;
  const LongOriginRad = degToRad(LongOrigin);

  const eccPrimeSquared = ECC_SQUARED / (1 - ECC_SQUARED);

  const N = a / Math.sqrt(1 - ECC_SQUARED * Math.sin(LatRad) * Math.sin(LatRad));
  const T = Math.tan(LatRad) * Math.tan(LatRad);
  const C = eccPrimeSquared * Math.cos(LatRad) * Math.cos(LatRad);
  const A = Math.cos(LatRad) * (LongRad - LongOriginRad);

  const M =
    a *
    ((1 - ECC_SQUARED / 4 - (3 * ECC_SQUARED * ECC_SQUARED) / 64 - (5 * ECC_SQUARED * ECC_SQUARED * ECC_SQUARED) / 256) * LatRad -
      ((3 * ECC_SQUARED) / 8 + (3 * ECC_SQUARED * ECC_SQUARED) / 32 + (45 * ECC_SQUARED * ECC_SQUARED * ECC_SQUARED) / 1024) * Math.sin(2 * LatRad) +
      ((15 * ECC_SQUARED * ECC_SQUARED) / 256 + (45 * ECC_SQUARED * ECC_SQUARED * ECC_SQUARED) / 1024) * Math.sin(4 * LatRad) -
      ((35 * ECC_SQUARED * ECC_SQUARED * ECC_SQUARED) / 3072) * Math.sin(6 * LatRad));

  const easting =
    SCALE_FACTOR * N * (A + ((1 - T + C) * A * A * A) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * eccPrimeSquared) * A * A * A * A * A) / 120) +
    EASTING_OFFSET;

  const northing =
    SCALE_FACTOR *
    (M +
      N *
        Math.tan(LatRad) *
        ((A * A) / 2 + ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * eccPrimeSquared) * A * A * A * A * A * A) / 720));

  return { easting, northing };
}

/**
 * Convert lat/lon to UTM (standard form: northing measured from the equator,
 * 10,000,000 m offset applied in the southern hemisphere).
 */
export function latLonToUtm(lat: number, lon: number): { zone: number; band: string; easting: number; northing: number } {
  const baseZone = utmZoneOfLongitude(lon);
  const zone = zoneWithSpecialCases(lat, lon, baseZone);

  const { easting, northing } = utmForward(lat, lon, zone);

  const hemisphereOffset = lat < 0 ? NORTHING_OFFSET : 0;
  return {
    zone,
    band: latitudeBandLetter(lat),
    easting: Math.trunc(easting),
    northing: Math.trunc(northing + hemisphereOffset),
  };
}

/**
 * Convert lat/lon to zone-local UTM grid coordinates (northing is a signed
 * distance north of the equator, negative in the southern hemisphere).
 * Used for drawing grid geometry across the equator without the 10,000,000 m
 * flip. Note: the point is projected into `zone` regardless of its own zone.
 */
export function latLonToUtmGridCoords(lat: number, lon: number, zone: number): { easting: number; northing: number } {
  // utmForward already returns the signed northing (negative south of the
  // equator); unlike latLonToUtm we must NOT add the 10,000,000 m hemisphere
  // offset here, or southern-hemisphere grid lines project to invalid
  // latitudes and the MGRS overlay silently disappears.
  const { easting, northing } = utmForward(lat, lon, zone);
  return { easting, northing };
}

/** Convert UTM grid coordinates (signed northing, see above) to lat/lon. */
export function utmGridCoordsToLatLon(zone: number, easting: number, northing: number): LatLon {
  const standardNorthing = northing < 0 ? northing + NORTHING_OFFSET : northing;
  const zoneLetter = northing < 0 ? 'M' : 'N';
  return utmToLatLon(zone, zoneLetter, easting, standardNorthing);
}

/**
 * Convert UTM coords to lat/lon using the WGS84 ellipsoid.
 * `band` may be any latitude band letter (only its hemisphere is used here).
 */
export function utmToLatLon(zone: number, band: string, easting: number, northing: number): LatLon {
  const a = SEMI_MAJOR_AXIS;
  const e1 = (1 - Math.sqrt(1 - ECC_SQUARED)) / (1 + Math.sqrt(1 - ECC_SQUARED));

  // remove 500,000 meter offset for longitude
  const x = easting - EASTING_OFFSET;
  let y = northing;

  // The zone letter indicates the hemisphere (even if not the exact band).
  if (band < 'N') {
    y -= NORTHING_OFFSET;
  }

  // +3 puts origin in middle of zone
  const LongOrigin = (zone - 1) * UTM_ZONE_WIDTH - 180 + UTM_ZONE_WIDTH / 2;

  const eccPrimeSquared = ECC_SQUARED / (1 - ECC_SQUARED);

  const M = y / SCALE_FACTOR;
  const mu = M / (a * (1 - ECC_SQUARED / 4 - (3 * ECC_SQUARED * ECC_SQUARED) / 64 - (5 * ECC_SQUARED * ECC_SQUARED * ECC_SQUARED) / 256));

  const phi1Rad =
    mu +
    ((3 * e1) / 2 - (27 * e1 * e1 * e1) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 * e1 * e1 * e1) / 32) * Math.sin(4 * mu) +
    ((151 * e1 * e1 * e1) / 96) * Math.sin(6 * mu);

  const N1 = a / Math.sqrt(1 - ECC_SQUARED * Math.sin(phi1Rad) * Math.sin(phi1Rad));
  const T1 = Math.tan(phi1Rad) * Math.tan(phi1Rad);
  const C1 = eccPrimeSquared * Math.cos(phi1Rad) * Math.cos(phi1Rad);
  const R1 = (a * (1 - ECC_SQUARED)) / Math.pow(1 - ECC_SQUARED * Math.sin(phi1Rad) * Math.sin(phi1Rad), 1.5);
  const D = x / (N1 * SCALE_FACTOR);

  const latRad =
    phi1Rad -
    ((N1 * Math.tan(phi1Rad)) / R1) *
      ((D * D) / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eccPrimeSquared) * D * D * D * D) / 24 + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * eccPrimeSquared - 3 * C1 * C1) * D * D * D * D * D * D) / 720);

  const lonRad =
    (D - ((1 + 2 * T1 + C1) * D * D * D) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * eccPrimeSquared + 24 * T1 * T1) * D * D * D * D * D) / 120) /
    Math.cos(phi1Rad);

  return {
    latitude: radToDeg(latRad),
    longitude: LongOrigin + radToDeg(lonRad),
  };
}

/** Given a UTM zone number, figure out the MGRS 100K set it is in. */
function get100kSetForZone(zone: number): number {
  let setParm = zone % NUM_100K_SETS;
  if (setParm === 0) {
    setParm = NUM_100K_SETS;
  }
  return setParm;
}

/**
 * Get the two-letter MGRS 100k designator for a given UTM easting, northing
 * and zone number. `northing` must be the standard UTM northing (with the
 * 10,000,000 m offset applied in the southern hemisphere).
 */
export function mgrs100kSquare(easting: number, northing: number, zone: number): string {
  const setParm = get100kSetForZone(zone);
  const setColumn = Math.floor(easting / 100000);
  const setRow = Math.floor(northing / 100000) % 20;
  return getLetter100kID(setColumn, setRow, setParm);
}

/**
 * Get the two-letter MGRS 100k designator given the column/row indices and
 * the set number (1-6).
 */
function getLetter100kID(column: number, row: number, parm: number): string {
  // colOrigin and rowOrigin are the letters at the origin of the set
  const index = parm - 1;
  const colOrigin = SET_ORIGIN_COLUMN_LETTERS.charCodeAt(index);
  const rowOrigin = SET_ORIGIN_ROW_LETTERS.charCodeAt(index);

  // colInt and rowInt are the letters to build to return
  let colInt = colOrigin + column - 1;
  let rowInt = rowOrigin + row;
  let rollover = false;

  if (colInt > Z) {
    colInt = colInt - Z + A - 1;
    rollover = true;
  }

  if (colInt === I || (colOrigin < I && colInt > I) || ((colInt > I || colOrigin < I) && rollover)) {
    colInt++;
  }

  if (colInt === O || (colOrigin < O && colInt > O) || ((colInt > O || colOrigin < O) && rollover)) {
    colInt++;

    if (colInt === I) {
      colInt++;
    }
  }

  if (colInt > Z) {
    colInt = colInt - Z + A - 1;
  }

  if (rowInt > V) {
    rowInt = rowInt - V + A - 1;
    rollover = true;
  } else {
    rollover = false;
  }

  if ((rowInt === I) || ((rowOrigin < I) && (rowInt > I)) || (((rowInt > I) || (rowOrigin < I)) && rollover)) {
    rowInt++;
  }

  if ((rowInt === O) || ((rowOrigin < O) && (rowInt > O)) || (((rowInt > O) || (rowOrigin < O)) && rollover)) {
    rowInt++;

    if (rowInt === I) {
      rowInt++;
    }
  }

  if (rowInt > V) {
    rowInt = rowInt - V + A - 1;
  }

  return String.fromCharCode(colInt) + String.fromCharCode(rowInt);
}

/** Accuracy in meters for a given digit count (5=1m, 3=100m, 2=1km, ...). */
export function mgrsAccuracyMeters(digits: number): number {
  return 100000 / Math.pow(10, digits);
}

/**
 * Encodes a UTM location as an MGRS string, e.g. "55H DV 123 456".
 * @param digits Accuracy in digits (5 for 1 m, 4 for 10 m, 3 for 100 m,
 *   2 for 1 km, 1 for 10 km). Default 5.
 */
export function latLonToMGRS(lat: number, lon: number, digits = 5): string {
  const utm = latLonToUtm(lat, lon);
  const seasting = '00000' + utm.easting;
  const snorthing = '00000' + utm.northing;
  const square = mgrs100kSquare(utm.easting, utm.northing, utm.zone);
  const eDigits = seasting.substr(seasting.length - 5, digits);
  const nDigits = snorthing.substr(snorthing.length - 5, digits);
  return `${utm.zone}${utm.band} ${square} ${eDigits} ${nDigits}`;
}

/** The GZD + 100,000m square for a location, e.g. "55H DV". */
export function mgrsAreaString(lat: number, lon: number): string {
  const utm = latLonToUtm(lat, lon);
  const square = mgrs100kSquare(utm.easting, utm.northing, utm.zone);
  return `${utm.zone}${utm.band} ${square}`;
}

/** The minimum northing value of a MGRS zone (per Geotrans' band table). */
function getMinNorthing(zoneLetter: string): number {
  let northing: number;
  switch (zoneLetter) {
    case 'C':
      northing = 1100000;
      break;
    case 'D':
      northing = 2000000;
      break;
    case 'E':
      northing = 2800000;
      break;
    case 'F':
      northing = 3700000;
      break;
    case 'G':
      northing = 4600000;
      break;
    case 'H':
      northing = 5500000;
      break;
    case 'J':
      northing = 6400000;
      break;
    case 'K':
      northing = 7300000;
      break;
    case 'L':
      northing = 8200000;
      break;
    case 'M':
      northing = 9100000;
      break;
    case 'N':
      northing = 0;
      break;
    case 'P':
      northing = 800000;
      break;
    case 'Q':
      northing = 1700000;
      break;
    case 'R':
      northing = 2600000;
      break;
    case 'S':
      northing = 3500000;
      break;
    case 'T':
      northing = 4400000;
      break;
    case 'U':
      northing = 5300000;
      break;
    case 'V':
      northing = 6200000;
      break;
    case 'W':
      northing = 7000000;
      break;
    case 'X':
      northing = 7900000;
      break;
    default:
      northing = -1;
  }
  if (northing >= 0) {
    return northing;
  }
  throw new TypeError(`Invalid zone letter: ${zoneLetter}`);
}

/** Given the first letter from a two-letter MGRS 100k zone, and the set, find the easting offset. */
function getEastingFromChar(e: string, set: number): number {
  let curCol = SET_ORIGIN_COLUMN_LETTERS.charCodeAt(set - 1);
  let eastingValue = 100000;
  let rewindMarker = false;

  while (curCol !== e.charCodeAt(0)) {
    curCol++;
    if (curCol === I) curCol++;
    if (curCol === O) curCol++;
    if (curCol > Z) {
      if (rewindMarker) {
        throw new Error(`Bad character: ${e}`);
      }
      curCol = A;
      rewindMarker = true;
    }
    eastingValue += 100000;
  }

  return eastingValue;
}

/** Given the second letter from a two-letter MGRS 100k zone, and the set, find the northing offset. */
function getNorthingFromChar(n: string, set: number): number {
  if (n > 'V') {
    throw new TypeError(`MGRSPoint given invalid Northing ${n}`);
  }

  let curRow = SET_ORIGIN_ROW_LETTERS.charCodeAt(set - 1);
  let northingValue = 0;
  let rewindMarker = false;

  while (curRow !== n.charCodeAt(0)) {
    curRow++;
    if (curRow === I) curRow++;
    if (curRow === O) curRow++;
    if (curRow > V) {
      if (rewindMarker) {
        throw new Error(`Bad character: ${n}`);
      }
      curRow = A;
      rewindMarker = true;
    }
    northingValue += 100000;
  }

  return northingValue;
}

export type ParsedMGRS = {
  zone: number;
  band: string;
  easting: number;
  northing: number;
  /** Digit count of the easting/northing (2 = 1km, 3 = 100m, 5 = 1m). */
  digits: number;
  /** Cell size in meters implied by the digit count. */
  accuracyMeters: number;
};

/**
 * Decode the UTM parameters from an MGRS string such as "55H DV 123 456".
 * Returns the SW corner of the referenced grid cell. Returns null if the
 * string is malformed or outside MGRS limits.
 */
export function parseMGRS(mgrsString: string): ParsedMGRS | null {
  try {
    if (!mgrsString || mgrsString.length === 0) {
      return null;
    }
    const cleaned = mgrsString.toUpperCase().replace(/ /g, '');
    if (cleaned.length === 0) return null;

    let hunK: string | null = null;
    let sb = '';
    let testChar = '';
    let i = 0;

    // get Zone number
    while (!/[A-Z]/.test((testChar = cleaned.charAt(i)))) {
      if (i >= 2) {
        return null;
      }
      sb += testChar;
      i++;
    }

    const zoneNumber = parseInt(sb, 10);

    if (i === 0 || i + 3 > cleaned.length) {
      // A good MGRS string has to be 4-5 digits long, ##AAA/#AAA at least.
      return null;
    }

    const zoneLetter = cleaned.charAt(i++);
    if (zoneLetter <= 'A' || zoneLetter === 'B' || zoneLetter === 'Y' || zoneLetter >= 'Z' || zoneLetter === 'I' || zoneLetter === 'O') {
      return null;
    }

    hunK = cleaned.substring(i, (i += 2));
    if (hunK.length !== 2) return null;

    const set = get100kSetForZone(zoneNumber);

    const east100k = getEastingFromChar(hunK.charAt(0), set);
    let north100k = getNorthingFromChar(hunK.charAt(1), set);

    // The northing may be 2,000,000 too low — roll forward while below the
    // band's minimum northing.
    while (north100k < getMinNorthing(zoneLetter)) {
      north100k += 2000000;
    }

    const remainder = cleaned.length - i;
    if (remainder % 2 !== 0) {
      return null;
    }

    const sep = remainder / 2;

    let sepEasting = 0;
    let sepNorthing = 0;
    const accuracyBonus = 100000 / Math.pow(10, sep);
    if (sep > 0) {
      const sepEastingString = cleaned.substring(i, i + sep);
      const sepNorthingString = cleaned.substring(i + sep);
      if (!/^[0-9]+$/.test(sepEastingString) || !/^[0-9]+$/.test(sepNorthingString)) {
        return null;
      }
      sepEasting = parseFloat(sepEastingString) * accuracyBonus;
      sepNorthing = parseFloat(sepNorthingString) * accuracyBonus;
    }

    return {
      zone: zoneNumber,
      band: zoneLetter,
      easting: sepEasting + east100k,
      northing: sepNorthing + north100k,
      digits: sep,
      accuracyMeters: accuracyBonus,
    };
  } catch {
    return null;
  }
}

/**
 * Convert an MGRS string to the lat/lon of the *centre* of the referenced
 * cell (e.g. "55H DV 123 456" → the centre of the 1m cell). Returns null if
 * the string is malformed. `accuracyMeters` is the cell size.
 */
export function mgrsToLatLon(mgrsString: string): { latitude: number; longitude: number; accuracyMeters: number } | null {
  const parsed = parseMGRS(mgrsString);
  if (!parsed) return null;
  const sw = utmToLatLon(parsed.zone, parsed.band, parsed.easting, parsed.northing);
  const ne = utmToLatLon(parsed.zone, parsed.band, parsed.easting + parsed.accuracyMeters, parsed.northing + parsed.accuracyMeters);
  return {
    latitude: (sw.latitude + ne.latitude) / 2,
    longitude: (sw.longitude + ne.longitude) / 2,
    accuracyMeters: parsed.accuracyMeters,
  };
}

/**
 * Grid convergence in degrees for a WGS84 point in the UTM zone containing
 * it. Positive when grid north is east of true north.
 */
export function utmGridConvergence(lat: number, lon: number): number {
  const zone = zoneWithSpecialCases(lat, lon, utmZoneOfLongitude(lon));
  const lonOrigin = (zone - 1) * UTM_ZONE_WIDTH - 180 + UTM_ZONE_WIDTH / 2;
  const deltaLambda = degToRad(lon - lonOrigin);
  const phi = degToRad(lat);
  return radToDeg(Math.atan(Math.tan(phi) * Math.sin(deltaLambda)));
}
