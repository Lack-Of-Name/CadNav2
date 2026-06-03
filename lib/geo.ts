import { haversineMeters } from '@/components/map/MaplibreMap.utils';

import type { Checkpoint } from '@/types';

export function computeRouteDistanceMeters(cps: Checkpoint[], isLoop = false): number {
  if (cps.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < cps.length; i++) {
    total += haversineMeters(
      cps[i - 1].latitude,
      cps[i - 1].longitude,
      cps[i].latitude,
      cps[i].longitude,
    );
  }
  if (isLoop) {
    total += haversineMeters(
      cps[cps.length - 1].latitude,
      cps[cps.length - 1].longitude,
      cps[0].latitude,
      cps[0].longitude,
    );
  }
  return total;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km.toFixed(km >= 10 ? 0 : 1)} km`;
  }
  return `${Math.round(meters)} m`;
}
