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
