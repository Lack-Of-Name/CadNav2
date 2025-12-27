import { degreesToMils } from '@/components/map/converter';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text as RNText, View as RNView, TouchableOpacity } from 'react-native';

export const normalizeDegrees = (d: number) => ((d % 360) + 360) % 360;
export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

export const bearingDegrees = (fromLat: number, fromLon: number, toLat: number, toLon: number) => {
  const phi1 = toRad(fromLat);
  const phi2 = toRad(toLat);
  const deltaLambda = toRad(toLon - fromLon);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return normalizeDegrees(toDeg(Math.atan2(y, x)));
};

export const haversineMeters = (fromLat: number, fromLon: number, toLat: number, toLon: number) => {
  const R = 6371000;
  const phi1 = toRad(fromLat);
  const phi2 = toRad(toLat);
  const deltaPhi = toRad(toLat - fromLat);
  const deltaLambda = toRad(toLon - fromLon);
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function getCompassHeadingDeg(lastLocation?: any) {
  return lastLocation?.coords?.magHeading ?? null;
}

export function formatHeading(lastLocation: any, mapHeading: string | undefined, angleUnit: string | undefined) {
  if (!lastLocation) return '—';
  const useMag = mapHeading === 'magnetic';
  const h = useMag ? lastLocation.coords.magHeading : lastLocation.coords.trueHeading;
  if (h == null) return '—';
  const formatted = angleUnit === 'mils' ? `${Math.round(degreesToMils(h, { normalize: true }))} mils` : `${h.toFixed(0)}°`;
  const indicator = useMag ? 'Magnetic' : 'True';
  return `${formatted} — ${indicator}`;
}

type RenderAs = 'web' | 'native';

export function RecenterButton({ onPress, style, color, renderAs = 'web' }: { onPress: () => void; style?: any; color?: string; renderAs?: RenderAs }) {
  if (renderAs === 'web') {
    return (
      <div onClick={onPress} role="button" aria-label="Recenter map" style={style}>
        <IconSymbol size={28} name="location.fill.viewfinder" color={String(color)} />
      </div>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={style}>
      <IconSymbol size={28} name="location.fill.viewfinder" color={String(color)} />
    </TouchableOpacity>
  );
}

export function CompassButton({ onPress, style, color, active, renderAs = 'web' }: { onPress: () => void; style?: any; color?: string; active?: boolean; renderAs?: RenderAs }) {
  if (renderAs === 'web') {
    return (
      <div onClick={onPress} role="button" aria-label="Compass" style={style}>
        <IconSymbol size={26} name="safari.fill" color={String(active ? color : color)} />
      </div>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} accessibilityLabel="Compass" style={style}>
      <IconSymbol size={26} name="safari.fill" color={String(active ? color : color)} />
    </TouchableOpacity>
  );
}

export function InfoBox({ lastLocation, mapHeading, angleUnit, containerStyle, textStyle, renderAs = 'web' }: {
  lastLocation?: any;
  mapHeading?: string;
  angleUnit?: string;
  containerStyle?: any;
  textStyle?: any;
  renderAs?: RenderAs;
}) {
  const headingText = formatHeading(lastLocation, mapHeading, angleUnit);
  if (!lastLocation) return null;
  if (renderAs === 'web') {
    return (
      <div style={containerStyle}>
        <RNText style={textStyle}>Lat: {lastLocation.coords.latitude.toFixed(6)}</RNText>
        <br />
        <RNText style={textStyle}>Lon: {lastLocation.coords.longitude.toFixed(6)}</RNText>
        <br />
        <RNText style={textStyle}>Alt: {lastLocation.coords.altitude == null ? '—' : `${lastLocation.coords.altitude.toFixed(0)} m`}</RNText>
        <br />
        <RNText style={textStyle}>Heading: {headingText}</RNText>
      </div>
    );
  }
  return (
    <RNView style={containerStyle}>
      <RNText style={textStyle}>Lat: {lastLocation.coords.latitude.toFixed(6)}</RNText>
      <RNText style={textStyle}>Lon: {lastLocation.coords.longitude.toFixed(6)}</RNText>
      <RNText style={textStyle}>Alt: {lastLocation.coords.altitude == null ? '—' : `${lastLocation.coords.altitude.toFixed(0)} m`}</RNText>
      <RNText style={textStyle}>Heading: {headingText}</RNText>
    </RNView>
  );
}

export function LocationMarker({ x, y, orientation, renderAs = 'web', containerStyle }: { x: number; y: number; orientation: number | null; renderAs?: RenderAs; containerStyle?: any }) {
  if (renderAs !== 'web') return null;
  return (
    <div style={{ position: 'absolute', left: x - 12, top: y - 12, pointerEvents: 'none', ...containerStyle }}>
      <div style={{ width: 24, height: 24, borderRadius: 12, background: '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {orientation != null ? (
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ transform: `rotate(${orientation}deg)` }}>
            <path d="M12 2 L19 21 L12 17 L5 21 Z" fill="white" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="5" fill="white" />
          </svg>
        )}
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 24, height: 24, borderRadius: 12, boxShadow: '0 0 0 6px rgba(0,122,255,0.15)', animation: 'pulse 2s infinite' }} />
    </div>
  );
}
