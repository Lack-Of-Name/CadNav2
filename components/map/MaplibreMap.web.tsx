import { alert as showAlert } from '@/components/alert';
import { CompassOverlay } from '@/components/map/CompassOverlay';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { formatHeading, getCompassHeadingDeg, normalizeDegrees, sleep } from './MaplibreMap.general';
// checkpoints removed — compass kept
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ThemedView } from '../themed-view';

export default function MapLibreMap() {
  const { apiKey, loading } = useMapTilerKey();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const lastLocationRef = useRef<typeof lastLocation | null>(null);
  const lastLocationLossTimer = useRef<number | null>(null);
  const errorReportedRef = useRef(false);
  const { lastLocation } = useGPS();
  const { angleUnit, mapHeading } = useSettings();
  // checkpoints removed
  const colorScheme = useColorScheme() ?? 'light';
  const iconColor = useThemeColor({}, 'tabIconDefault');
  const tabIconSelected = useThemeColor({}, 'tabIconSelected');
  const tint = useThemeColor({}, 'tint');
  const markerPole = Colors.light.text;
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const background = useThemeColor({}, 'background');
  const [following, setFollowing] = useState(false);
  const buttonIconColor = following ? tabIconSelected : (colorScheme === 'light' ? tint : iconColor);
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [orientation, setOrientation] = useState<number | null>(null);
  const [mapBearing, setMapBearing] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [compassOpen, setCompassOpen] = useState(false);
  
  // Overlay styles and small helpers to keep JSX concise below
  const overlayStyles = {
    container: { width: 24, height: 24, borderRadius: 12, background: '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center' } as any,
    pulse: { position: 'absolute', left: 0, top: 0, width: 24, height: 24, borderRadius: 12, boxShadow: '0 0 0 6px rgba(0,122,255,0.15)', animation: 'pulse 2s infinite' } as any,
    recenter: (following: boolean) => ({
      position: 'absolute' as const,
      bottom: 12,
      left: 12,
      padding: 10,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 50,
      display: 'flex',
      cursor: 'pointer',
      backgroundColor: following
        ? (colorScheme === 'dark' ? 'rgba(9, 63, 81)' : 'rgba(255,255,255)')
        : (colorScheme === 'dark' ? 'rgba(0,0,0)' : 'rgba(255,255,255)'),
      border: following ? `1.5px solid ${String(tint)}` : '1.5px solid transparent',
    }) as any,
    floatingButton: (bottom: number, active: boolean) => ({
      position: 'absolute' as const,
      bottom,
      left: 12,
      padding: 10,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 50,
      display: 'flex',
      cursor: 'pointer',
      backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0)' : 'rgba(255,255,255)',
      border: active ? `1.5px solid ${String(tint)}` : '1.5px solid transparent',
    }) as any,
  };

  const currentHeading = getCompassHeadingDeg(lastLocation);

  // checkpoint-bearing and distance removed

  // Small subcomponents keep the return() markup readable
  function RecenterButton({ onPress }: { onPress: () => void }) {
    return (
      <div onClick={onPress} role="button" aria-label="Recenter map" style={overlayStyles.recenter(following)}>
        <IconSymbol size={28} name="location.fill.viewfinder" color={String(buttonIconColor)} />
      </div>
    );
  }

  function CompassButton() {
    return (
      <div onClick={() => setCompassOpen(false)} role="button" aria-label="Compass" style={overlayStyles.floatingButton(12 + 58, compassOpen)}>
        <IconSymbol size={26} name="location.north.line" color={String(compassOpen ? tabIconSelected : buttonIconColor)} />
      </div>
    );
  }

  // Use shared CompassOverlay component for web as well
  const compassHeadingDeg = currentHeading ?? null;
  const compassTargetBearingDeg = null;
  const compassTargetLabel = null;
  const compassHeadingRefLabel = 'Magnetic';
  const compassBearingText = null;
  const compassDistanceText = null;

  function LocationMarker({ x, y, orientation }: { x: number; y: number; orientation: number | null }) {
    return (
      <div style={{ position: 'absolute', left: x - 12, top: y - 12, pointerEvents: 'none' }}>
        <div style={overlayStyles.container}>
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
        <div style={overlayStyles.pulse} />
      </div>
    );
  }

  function InfoBox() {
    if (!lastLocation) return null;
    const headingText = formatHeading(lastLocation, mapHeading, angleUnit);

    return (
      <div style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 6 }}>
        <Text style={styles.locationText}>Lat: {lastLocation.coords.latitude.toFixed(6)}</Text>
        <br />
        <Text style={styles.locationText}>Lon: {lastLocation.coords.longitude.toFixed(6)}</Text>
        <br />
        <Text style={styles.locationText}>Alt: {lastLocation.coords.altitude == null ? '—' : `${lastLocation.coords.altitude.toFixed(0)} m`}</Text>
        <br />
        <Text style={styles.locationText}>Heading: {headingText}</Text>
      </div>
    );
  }

  // sleep imported from MaplibreMap.general

  useEffect(() => {
    // placement mode removed
  }, []);

  // checkpoint markers removed

  // Placement mode: click map to drop a checkpoint
  useEffect(() => {
    if (loading || !apiKey) return;
    if (map.current) return; // stops map from initializing more than once
    if (!mapContainer.current) return;
    if (!mapDiv.current) return;

    const mapStyle = `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${apiKey}`;

    map.current = new maplibregl.Map({
      container: mapDiv.current,
      style: mapStyle,
      center: [0, 0],
      zoom: 1
    });

    // Update bearing and projected screen position when map events fire
    const update = () => {
      if (!map.current) return;
      try {
        const b = typeof map.current.getBearing === 'function' ? map.current.getBearing() : 0;
        setMapBearing(b);
        const z = typeof map.current.getZoom === 'function' ? map.current.getZoom() : 1;
        if (Number.isFinite(z)) setZoomLevel(z);
      } catch (err) {
        if (!errorReportedRef.current) {
          errorReportedRef.current = true;
          void showAlert({ title: 'MapLibreMap', message: String(err) });
        }
      }
      const ll = lastLocationRef.current;
      if (ll && map.current) {
          try {
            const p = map.current.project([ll.coords.longitude, ll.coords.latitude]);
            setScreenPos({ x: p.x, y: p.y });
          } catch (err) {
            if (!errorReportedRef.current) {
              errorReportedRef.current = true;
              void showAlert({ title: 'MapLibreMap', message: String(err) });
            }
            setScreenPos(null);
          }
      }
    };

    map.current.on('load', update);
    map.current.on('move', update);
    map.current.on('zoom', update);

    // map click handlers for placement removed
    // initial update
    setTimeout(update, 0);

    // Lock map orientation to north-up: disable user rotation and force bearing 0
    try {
      if (map.current.dragRotate && typeof map.current.dragRotate.disable === 'function') {
        map.current.dragRotate.disable();
      }
      if (map.current.touchZoomRotate && typeof map.current.touchZoomRotate.disableRotation === 'function') {
        map.current.touchZoomRotate.disableRotation();
      }
      map.current.setBearing(0);
    } catch (err) {
      if (!errorReportedRef.current) {
        errorReportedRef.current = true;
        void showAlert({ title: 'MapLibreMap', message: String(err) });
      }
      // ignore if methods are unavailable
    }

    return () => {
      if (map.current) {
        map.current.off('load', update);
        map.current.off('move', update);
        map.current.off('zoom', update);
        map.current.remove();
      }
      map.current = null;
    };
  }, [apiKey, loading]);

  // Dashed route line between checkpoints
  // route layer removed

  // keep a ref copy of lastLocation so event handlers see latest value
  useEffect(() => {
    lastLocationRef.current = lastLocation;
  }, [lastLocation]);

  useEffect(() => {
    // If lastLocation is present, cancel any pending clear and update immediately
    if (lastLocation) {
      if (lastLocationLossTimer.current) {
        window.clearTimeout(lastLocationLossTimer.current);
        lastLocationLossTimer.current = null;
      }
      if (!map.current) return;
      try {
        const p = map.current.project([lastLocation.coords.longitude, lastLocation.coords.latitude]);
        setScreenPos({ x: p.x, y: p.y });
      } catch (err) {
        if (!errorReportedRef.current) {
          errorReportedRef.current = true;
          void showAlert({ title: 'MapLibreMap', message: String(err) });
        }
        // keep previous screenPos rather than clearing immediately
      }
      return;
    }

    // lastLocation became unavailable — clear the marker after a short delay
    if (lastLocationLossTimer.current) {
      window.clearTimeout(lastLocationLossTimer.current);
    }
    lastLocationLossTimer.current = window.setTimeout(() => {
      setScreenPos(null);
      lastLocationLossTimer.current = null;
    }, 2000);

    return () => {
      if (lastLocationLossTimer.current) {
        window.clearTimeout(lastLocationLossTimer.current);
        lastLocationLossTimer.current = null;
      }
    };
  }, [lastLocation]);

  useEffect(() => {
    if (!following || !lastLocation || !map.current) return;
    const { latitude, longitude } = lastLocation.coords;
    try {
      map.current.flyTo({ center: [longitude, latitude] });
    } catch (err) {
      if (!errorReportedRef.current) {
        errorReportedRef.current = true;
        void showAlert({ title: 'MapLibreMap', message: String(err) });
      }
      // ignore
    }
  }, [lastLocation, following]);

  // Compute the orientation (degrees) for the arrow based on device heading
  useEffect(() => {
    if (!lastLocation) {
      setOrientation(null);
      return;
    }
    const useMag = mapHeading === 'magnetic';
    const h = useMag ? lastLocation.coords.magHeading : lastLocation.coords.trueHeading;
    if (h == null) {
      setOrientation(null);
      return;
    }
    // Use the device heading directly (no inversion) and subtract map bearing
    const raw = h - mapBearing;
    const normalized = normalizeDegrees(raw);
    setOrientation(normalized);
  }, [lastLocation, mapBearing, mapHeading]);

  const handleRecenterPress = async () => {
    const enabling = !following;
    if (enabling && lastLocation && map.current) {
      const { latitude, longitude } = lastLocation.coords;
      try {
        map.current.flyTo({ center: [longitude, latitude], zoom: 16, duration: 1000, essential: true });
      } catch (err) {
        if (!errorReportedRef.current) {
          errorReportedRef.current = true;
          void showAlert({ title: 'MapLibreMap', message: String(err) });
        }
        // ignore
      }
    }
    await sleep(1000)
    setFollowing(enabling);
  };

  if (loading || !apiKey) {
    return (
      <ThemedView style={styles.container}>
        <Text>Waiting for MapTiler API key...</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'",
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <div ref={mapDiv} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 0 }} />
        <RecenterButton onPress={handleRecenterPress} />
        <CompassButton />
        {/* placement UI removed */}
        <CompassOverlay
          open={compassOpen}
          onToggle={() => setCompassOpen(false)}
          headingDeg={compassHeadingDeg}
          angleUnit={angleUnit}
          targetBearingDeg={compassTargetBearingDeg}
          targetLabel={compassTargetLabel}
          headingReferenceLabel={compassHeadingDeg == null ? null : compassHeadingRefLabel}
          bearingText={compassBearingText}
          distanceText={compassDistanceText}
          panelBg={colorScheme === 'dark' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)'}
          borderColor={String(borderColor)}
          background={String(background)}
          textColor={String(textColor)}
          textMuted={String(borderColor)}
          textSubtle={String(borderColor)}
          primary={String(tint)}
          tick={String(borderColor)}
          tickStrong={String(textColor)}
          style={{
            left: 12 + 58,
            bottom: 12 + 58,
          }}
        />
        {screenPos && <LocationMarker x={screenPos.x} y={screenPos.y} orientation={orientation} />}
        <InfoBox />
        <style>{`@keyframes pulse { 0% { transform: scale(0.9); opacity: 0.6 } 50% { transform: scale(1.4); opacity: 0.15 } 100% { transform: scale(0.9); opacity: 0.6 } }`}</style>
      </div>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  locationText: {
    color: 'white',
    fontSize: 12,
  },
  recenterButton: {
    position: 'absolute',
    padding: 10,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    elevation: 6,
  },
});
