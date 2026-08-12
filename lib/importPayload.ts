export type ImportedCheckpoint = {
  latitude: number;
  longitude: number;
  mgrs?: string;
  label?: string;
};

export type CadNavImportPayload =
  | {
      kind: 'cp';
      latitude: number;
      longitude: number;
      mgrs?: string;
      label?: string;
    }
  | {
      kind: 'route';
      title: string;
      subtitle?: string;
      loop: boolean;
      checkpoints: ImportedCheckpoint[];
    };

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function numberOrNull(value: string | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse an `cadnav://import?…` deep link into an import payload.
 * Params may be pre-decoded (expo-router) or still URL-encoded, so every
 * value is decoded defensively. Returns null for anything unrecognised.
 */
export function parseCadNavImportParams(
  params: Record<string, string | string[] | undefined>,
): CadNavImportPayload | null {
  const get = (key: string): string | undefined => {
    const value = params[key];
    if (Array.isArray(value)) return value[value.length - 1];
    return value;
  };

  const kind = (safeDecode(get('kind') ?? '').toLowerCase() ||
    safeDecode(get('type') ?? '').toLowerCase());

  if (kind === 'cp') {
    const lat = numberOrNull(get('lat'));
    const lon = numberOrNull(get('lon'));
    if (lat == null || lon == null) return null;
    const mgrs = safeDecode(get('mgrs') ?? '').trim() || undefined;
    const label = safeDecode(get('label') ?? '').trim() || undefined;
    return { kind: 'cp', latitude: lat, longitude: lon, mgrs, label };
  }

  if (kind === 'route') {
    const title = safeDecode(get('title') ?? '').trim();
    if (!title) return null;
    const subtitle = safeDecode(get('subtitle') ?? '').trim() || undefined;
    const loopRaw = safeDecode(get('loop') ?? '');
    const loop = loopRaw === '1' || loopRaw.toLowerCase() === 'true';
    const rawCps = safeDecode(get('cps') ?? '');

    const checkpoints: ImportedCheckpoint[] = [];
    if (rawCps) {
      for (const segment of rawCps.split('|')) {
        const fields = segment.split('~');
        if (fields.length < 2) continue;
        const lat = Number(fields[0]);
        const lon = Number(fields[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const mgrs = fields[2] ? safeDecode(fields[2]).trim() || undefined : undefined;
        const label = fields[3] ? safeDecode(fields[3]).trim() || undefined : undefined;
        checkpoints.push({ latitude: lat, longitude: lon, mgrs, label });
      }
    }
    if (checkpoints.length === 0) return null;

    return { kind: 'route', title, subtitle, loop, checkpoints };
  }

  return null;
}