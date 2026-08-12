import { computeRouteDistanceMeters, formatDistance } from '@/lib/geo';
import { latLonToMGRS } from '@/lib/mgrs';
import type { Checkpoint, RouteItem } from '@/types';

function gridRef(cp: Checkpoint): string {
  return cp.mgrs?.trim() || latLonToMGRS(cp.latitude, cp.longitude, 5);
}

function geoUri(cp: Checkpoint): string {
  return `geo:${cp.latitude.toFixed(6)},${cp.longitude.toFixed(6)}`;
}

/** Human-readable, camera-scan friendly text payload for a single checkpoint. */
export function checkpointSharePayload(cp: Checkpoint): string {
  const lines = ['CadNav checkpoint'];
  lines.push(cp.label?.trim() || 'Checkpoint');
  lines.push(`Grid: ${gridRef(cp)}`);
  lines.push(`${cp.latitude.toFixed(5)}, ${cp.longitude.toFixed(5)}`);
  lines.push(geoUri(cp));
  return lines.join('\n');
}

/** Human-readable, camera-scan friendly text payload for an entire route. */
export function routeSharePayload(
  route: Pick<RouteItem, 'title' | 'subtitle'>,
  cps: Checkpoint[],
  isLoop: boolean,
): string {
  const lines = ['CadNav route'];
  lines.push(route.title);
  if (route.subtitle) lines.push(route.subtitle);
  lines.push(`Total: ${formatDistance(computeRouteDistanceMeters(cps, isLoop))}${isLoop ? ' (loop)' : ''}`);
  lines.push('');

  cps.forEach((cp, idx) => {
    lines.push(`${String(idx + 1).padStart(2, '0')}${cp.label ? ` — ${cp.label}` : ''}`);
    lines.push(gridRef(cp));
    lines.push(geoUri(cp));
    lines.push('');
  });

  return lines.join('\n');
}
