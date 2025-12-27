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