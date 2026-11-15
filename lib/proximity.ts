// CadNav 2 libraries — Copyright (C) 2026 Lyren, Alexander Ellul
// SPDX-License-Identifier: LGPL-3.0-or-later
// See lib/LICENSE for full terms.

/**
 * True when `distanceMeters` is inside the radius of uncertainty reported by a
 * GPS fix (`accuracyMeters`, the 68% confidence radius in meters).
 *
 * Used for the "arrived" state: if the only thing separating us from the
 * checkpoint is the fix's own error circle, we treat the user as being there.
 *
 * Returns false for missing/NaN/negative inputs so the UI never flips to the
 * arrived state on a bogus number.
 */
export function isWithinAccuracy(
  distanceMeters: number | null | undefined,
  accuracyMeters: number | null | undefined,
): boolean {
  if (typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters) || distanceMeters < 0) {
    return false;
  }
  if (typeof accuracyMeters !== 'number' || !Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
    return false;
  }
  return distanceMeters <= accuracyMeters;
}
