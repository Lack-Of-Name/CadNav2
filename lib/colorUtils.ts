/** True when a hex color is perceptually light (use dark text on top). */
export function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/** Text color that contrasts with a filled button or banner background. */
export function contrastingTextColor(hex: string, light = '#000', dark = '#fff'): string {
  return isLightColor(hex) ? light : dark;
}

export type HSV = { h: number; s: number; v: number };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Hex (#RRGGBB) to HSV, hue 0–360, saturation/value 0–100. Falls back to red on invalid input. */
export function hexToHsv(hex: string): HSV {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return { h: 0, s: 100, v: 100 };
  const c = m[1];
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

/** HSV (hue 0–360, saturation/value 0–100) to uppercase hex (#RRGGBB). Falls back to red on invalid input. */
export function hsvToHex(h: number, s: number, v: number): string {
  if (![h, s, v].every(Number.isFinite)) return '#FF0000';
  const hh = (((h % 360) + 360) % 360) / 60;
  const ss = clamp(s, 0, 100) / 100;
  const vv = clamp(v, 0, 100) / 100;
  const c = vv * ss;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = vv - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 1) { r = c; g = x; }
  else if (hh < 2) { r = x; g = c; }
  else if (hh < 3) { g = c; b = x; }
  else if (hh < 4) { g = x; b = c; }
  else if (hh < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}
