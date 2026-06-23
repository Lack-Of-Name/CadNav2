"use strict";

export interface DeclinationOptions {
  altitudeKm?: number;
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

// Earth reference radius used by WMM (km)
const EARTH_REF_RADIUS_KM = 6371.2;

function idx(n: number, m: number) {
  return (n * (n + 1)) / 2 + m;
}

function decimalYearFromDate(d: Date) {
  const year = d.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const days = (end - start) / (24 * 3600 * 1000);
  const dayIndex = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / (24 * 3600 * 1000));
  return year + dayIndex / days;
}

type Model = { epoch: number; nmax: number; g: number[]; h: number[]; dg: number[]; dh: number[] };

let cached: Promise<Model> | null = null;
async function loadModel(): Promise<Model> {
  if (cached) return cached;
  
  // Statically require the pre-parsed JSON so the JS engine native C++ JSON parser handles it instantly
  // avoiding any large string allocations or Regex splits on the main thread.
  const WMMHR_JSON = require("../../assets/WMMHR.json");
  cached = Promise.resolve(WMMHR_JSON as Model);
  
  return cached;
}

// Convert geodetic coordinates (lat, lon, altitude) to spherical (geocentric)
// Returns: longitude (deg), geocentric latitude phi_g (deg), radius r (km)
function geodeticToSpherical(latDeg: number, lonDeg: number, altKm: number) {
  const a = 6378.137; // equatorial radius (km)
  const b = 6356.7523142; // polar radius (km)
  const eccSq = 1 - (b * b) / (a * a);
  const latRad = latDeg * RAD;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);

  // Radius of curvature in the prime vertical
  const rc = a / Math.sqrt(1 - eccSq * sinLat * sinLat);

  // Cartesian coordinates of the geodetic point
  const x = (rc + altKm) * cosLat;
  const z = (rc * (1 - eccSq) + altKm) * sinLat;

  const r = Math.hypot(x, z);
  const geocentricLatDeg = Math.asin(z / r) * DEG;
  return { lonSphDeg: lonDeg, phigDeg: geocentricLatDeg, rKm: r };
}

// Precompute radius factors and trig multiples of longitude used in field summation
function computeSphVars(lonDeg: number, rKm: number, nmax: number) {
  const cosLambda = Math.cos(lonDeg * RAD);
  const sinLambda = Math.sin(lonDeg * RAD);

  // rr[n] = (re / r)^(n+2) with rr[0] = (re/r)^2
  const rr = new Array(nmax + 1).fill(0);
  rr[0] = (EARTH_REF_RADIUS_KM / rKm) * (EARTH_REF_RADIUS_KM / rKm);
  for (let n = 1; n <= nmax; n++) rr[n] = rr[n - 1] * (EARTH_REF_RADIUS_KM / rKm);

  // cml/sml hold cos(m*lambda) and sin(m*lambda)
  const cml = new Array(nmax + 1).fill(0);
  const sml = new Array(nmax + 1).fill(0);
  cml[0] = 1; sml[0] = 0;
  if (nmax >= 1) { cml[1] = cosLambda; sml[1] = sinLambda; }
  for (let m = 2; m <= nmax; m++) {
    cml[m] = cml[m - 1] * cosLambda - sml[m - 1] * sinLambda;
    sml[m] = cml[m - 1] * sinLambda + sml[m - 1] * cosLambda;
  }
  return { rr, cml, sml };
}

function pcupLow(sinPhi: number, nmax: number) {
  const num = ((nmax + 1) * (nmax + 2)) / 2 + 1;
  const pcup = new Array(num).fill(0);
  const dpcup = new Array(num).fill(0);
  pcup[0] = 1; dpcup[0] = 0;
  const x = sinPhi;
  const z = Math.sqrt(Math.max(0, (1 - x) * (1 + x)));
  for (let n = 1; n <= nmax; n++) {
    for (let m = 0; m <= n; m++) {
      const id = idx(n, m);
      if (n === m) {
        const id1 = idx(n - 1, m - 1);
        pcup[id] = z * pcup[id1];
        dpcup[id] = z * dpcup[id1] + x * pcup[id1];
      } else if (n === 1 && m === 0) {
        const id1 = idx(n - 1, m);
        pcup[id] = x * pcup[id1];
        dpcup[id] = x * dpcup[id1] - z * pcup[id1];
      } else {
        const id1 = idx(n - 2, m);
        const id2 = idx(n - 1, m);
        if (m > n - 2) {
          pcup[id] = x * pcup[id2];
          dpcup[id] = x * dpcup[id2] - z * pcup[id2];
        } else {
          const k = (((n - 1) * (n - 1)) - (m * m)) / ((2 * n - 1) * (2 * n - 3));
          pcup[id] = x * pcup[id2] - k * pcup[id1];
          dpcup[id] = x * dpcup[id2] - z * pcup[id2] - k * dpcup[id1];
        }
      }
    }
  }
  const schmidt = new Array(num).fill(0);
  schmidt[0] = 1;
  for (let n = 1; n <= nmax; n++) {
    const i0 = idx(n, 0);
    const i0p = idx(n - 1, 0);
    schmidt[i0] = schmidt[i0p] * (2 * n - 1) / n;
    for (let m = 1; m <= n; m++) {
      const id = idx(n, m);
      const idm1 = idx(n, m - 1);
      schmidt[id] = schmidt[idm1] * Math.sqrt(((n - m + 1) * (m === 1 ? 2 : 1)) / (n + m));
    }
  }

  // Apply Schmidt quasi-normalization to pcup/dpcup
  for (let n = 1; n <= nmax; n++) for (let m = 0; m <= n; m++) {
    const id = idx(n, m);
    pcup[id] *= schmidt[id];
    dpcup[id] = -dpcup[id] * schmidt[id];
  }
  return { pcup, dpcup };
}

function associatedLegendre(sinPhi: number, nmax: number) {
  return pcupLow(sinPhi, nmax);
}

// Compute magnetic field components in spherical coordinates (bx, by, bz)
function computeFieldComponents(model: Model, dtYear: number, rr: number[], cml: number[], sml: number[], pcup: number[], dpcup: number[]) {
  let bx = 0, by = 0, bz = 0;
  for (let n = 1; n <= model.nmax; n++) {
    for (let m = 0; m <= n; m++) {
      const id = idx(n, m);
      const g = model.g[id] + dtYear * model.dg[id];
      const h = model.h[id] + dtYear * model.dh[id];
      const common = g * cml[m] + h * sml[m];
      bz -= rr[n] * common * (n + 1) * pcup[id];
      by += rr[n] * (g * sml[m] - h * cml[m]) * m * pcup[id];
      bx -= rr[n] * common * dpcup[id];
    }
  }
  return { bx, by, bz };
}

let cachedDeclinationPromise: { lat: number; lon: number; altKm: number; year: number; promise: Promise<number> } | null = null;

export async function getMagneticDeclination(lat: number, lon: number, date?: Date | string, opts: DeclinationOptions = {}): Promise<number> {
  const dt = date ? new Date(date) : new Date();
  if (Number.isNaN(dt.getTime()) || !Number.isFinite(lat) || !Number.isFinite(lon)) return 0;
  const altKm = opts.altitudeKm ?? 0;
  const decimalYear = decimalYearFromDate(dt);

  // Return cached promise if we are querying nearby location / time to avoid massive WMM HR recalculations.
  if (
    cachedDeclinationPromise &&
    Math.abs(cachedDeclinationPromise.lat - lat) < 0.01 &&
    Math.abs(cachedDeclinationPromise.lon - lon) < 0.01 &&
    Math.abs(cachedDeclinationPromise.altKm - altKm) < 0.5 &&
    Math.abs(cachedDeclinationPromise.year - decimalYear) < 0.1
  ) {
    return cachedDeclinationPromise.promise;
  }

  const promise = (async () => {
    const model = await loadModel();
    const dtYear = decimalYear - model.epoch;
    const { lonSphDeg, phigDeg, rKm } = geodeticToSpherical(lat, lon, altKm);
    const sinPhi = Math.sin(phigDeg * RAD);
    const { rr, cml, sml } = computeSphVars(lonSphDeg, rKm, model.nmax);
    const { pcup, dpcup } = associatedLegendre(sinPhi, model.nmax);
    const { bx, by: byRaw, bz } = computeFieldComponents(model, dtYear, rr, cml, sml, pcup, dpcup);
    
    let by = byRaw;
    const cosPhi = Math.cos(phigDeg * RAD);
    if (Math.abs(cosPhi) > 1e-10) by /= cosPhi;
    const psi = (phigDeg - lat) * RAD;
    const bx_geo = bx * Math.cos(psi) - bz * Math.sin(psi);
    const by_geo = by;
    const decl = Math.atan2(by_geo, bx_geo) * DEG;
    return decl;
  })();

  cachedDeclinationPromise = { lat, lon, altKm, year: decimalYear, promise };
  return promise;
}
