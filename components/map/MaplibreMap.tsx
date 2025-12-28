import { CompassOverlay } from '@/components/map/CompassOverlay';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
// checkpoints removed — compass kept
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Camera, LineLayer, MapView, ShapeSource, SymbolLayer, UserLocation } from "@maplibre/maplibre-react-native";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '../themed-view';
import { CompassButton, getCompassHeadingDeg, InfoBox, RecenterButton, sleep } from './MaplibreMap.general';
import { buildMapGridGeoJSON, buildMapGridNumbersGeoJSON, buildMapGridSubdivisionsGeoJSON } from './mapGrid';

const GRID_LINE_COLOR = '#111111';

export default function MapLibreMap() {
  const { apiKey, loading } = useMapTilerKey();
  const { lastLocation, requestLocation } = useGPS();
  const { angleUnit, mapHeading, mapGridEnabled, mapGridSubdivisionsEnabled, mapGridNumbersEnabled, mapGridOrigin } = useSettings();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const iconColor = useThemeColor({}, 'tabIconDefault');
  const tabIconSelected = useThemeColor({}, 'tabIconSelected');
  const tint = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const background = useThemeColor({}, 'background');
  const cameraRef = React.useRef<any>(null);
  const mapRef = React.useRef<any>(null);
  const [following, setFollowing] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [visibleBounds, setVisibleBounds] = useState<[[number, number], [number, number]] | null>(null);
  const buttonIconColor = following ? tabIconSelected : (colorScheme === 'light' ? tint : iconColor);

  const currentHeading = getCompassHeadingDeg(lastLocation);

  const compassHeadingDeg = currentHeading ?? null;
  const compassTargetBearingDeg = null;
  const compassTargetLabel = null;
  const compassHeadingRefLabel = 'Magnetic';
  const compassBearingText = null;
  const compassDistanceText = null;

  const centerOnLocation = async (loc: any) => {
    if (!loc || !cameraRef.current) return;
    const { latitude, longitude } = loc.coords;
    cameraRef.current.zoomTo?.(16, 200);
    await sleep(200);
    cameraRef.current.flyTo?.([longitude, latitude], 800);
    await sleep(800)
  };

  const handleRecenterPress = async () => {
    // Dual behavior:
    // - If already following, toggle off.
    // - If not following, request/restart location and toggle on immediately.
    //   The map will center immediately if we already have a fix, or as soon as one arrives.
    if (following) {
      setFollowing(false);
      return;
    }

    requestLocation();
    if (lastLocation) {
      await centerOnLocation(lastLocation);
    }
    setFollowing(true);
  };

  // map press handler removed (placement/checkpoints removed)

  useEffect(() => {
    if (!following || !lastLocation || !cameraRef.current) return;
    const { latitude, longitude } = lastLocation.coords;
    cameraRef.current.flyTo([longitude, latitude]);
  }, [lastLocation, following]);

  if (loading || !apiKey) {
    return (
      <ThemedView style={styles.page}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Waiting for MapTiler API key...</Text>
      </ThemedView>
    );
  }

  const mapStyle = `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${apiKey}`;

  const emptyGeo = { type: 'FeatureCollection', features: [] } as any;

  const showGrid = Boolean(mapGridEnabled && visibleBounds && typeof zoomLevel === 'number' && zoomLevel >= 12);

  const gridShape = (() => {
    if (!showGrid) return emptyGeo;
    const [[west, south], [east, north]] = visibleBounds as [[number, number], [number, number]];
    return buildMapGridGeoJSON({ west, south, east, north }, zoomLevel, mapGridOrigin) as any;
  })();

  const gridMinorShape = (() => {
    if (!showGrid || !mapGridSubdivisionsEnabled) return emptyGeo;
    const [[west, south], [east, north]] = visibleBounds as [[number, number], [number, number]];
    const geo = buildMapGridSubdivisionsGeoJSON({ west, south, east, north }, zoomLevel, mapGridOrigin) as any;
    return !geo?.features?.length ? emptyGeo : geo;
  })();

  const gridLabelShape = (() => {
    if (!showGrid || !mapGridNumbersEnabled) return emptyGeo;
    const [[west, south], [east, north]] = visibleBounds as [[number, number], [number, number]];
    const geo = buildMapGridNumbersGeoJSON({ west, south, east, north }, zoomLevel, mapGridOrigin) as any;
    return !geo?.features?.length ? emptyGeo : geo;
  })();

  return (
    <ThemedView style={styles.page}>
      <StatusBar animated={true} barStyle="dark-content" />

      <MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={mapStyle}
        logoEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        compassEnabled={false}
        // checkpoint interaction removed
        onRegionDidChange={(ev: any) => {
          const z = ev?.properties?.zoomLevel ?? ev?.properties?.zoom ?? ev?.zoomLevel;
          if (typeof z === 'number' && Number.isFinite(z)) setZoomLevel(z);

          // Keep bounds updated for the grid overlay.
          const getBounds = mapRef.current?.getVisibleBounds;
          if (typeof getBounds === 'function') {
            Promise.resolve(getBounds.call(mapRef.current))
              .then((b: any) => {
                if (Array.isArray(b) && b.length === 2 && Array.isArray(b[0]) && Array.isArray(b[1])) {
                  setVisibleBounds(b as [[number, number], [number, number]]);
                }
              })
              .catch(() => {
                // ignore - grid will just not render
              });
          }
        }}
        onRegionIsChanging={(ev: any) => {
          // Also update continuously while the camera is moving so grid follows the camera.
          const z = ev?.properties?.zoomLevel ?? ev?.properties?.zoom ?? ev?.zoomLevel;
          if (typeof z === 'number' && Number.isFinite(z)) setZoomLevel(z);
          const getBounds = mapRef.current?.getVisibleBounds;
          if (typeof getBounds === 'function') {
            try {
              const b = getBounds.call(mapRef.current);
              if (Array.isArray(b) && b.length === 2 && Array.isArray(b[0]) && Array.isArray(b[1])) {
                setVisibleBounds(b as [[number, number], [number, number]]);
              }
            } catch {
              // ignore
            }
          }
        }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [0, 0],
            zoomLevel: 1,
          }}
        />

        <ShapeSource id="map-grid-source" shape={gridShape}>
            <LineLayer
              id="map-grid-lines"
              style={{
                lineColor: GRID_LINE_COLOR,
                lineOpacity: 0.55,
                lineWidth: 2,
              }}
            />
        </ShapeSource>

        <ShapeSource id="map-grid-minor-source" shape={gridMinorShape}>
            <LineLayer
              id="map-grid-minor-lines"
              style={{
                lineColor: GRID_LINE_COLOR,
                lineOpacity: 0.12,
                lineWidth: 1.5,
              }}
            />
        </ShapeSource>

        <ShapeSource id="map-grid-labels-source" shape={gridLabelShape}>
          <SymbolLayer
            id="map-grid-labels"
            style={{
              textField: ['get', 'label'],
              textSize: 12,
              textColor: GRID_LINE_COLOR,
              textHaloColor: '#FFFFFF',
              textHaloWidth: 1,
              textAllowOverlap: true,
            }}
          />
        </ShapeSource>

        {/* checkpoints removed */}

        {/* Render the native location puck w/ heading indicator. */}
        {/* @ts-ignore - typing differs across forks */}
        <UserLocation
          visible={true}
          animated={true}
          renderMode="native"
          androidRenderMode="compass"
          showsUserHeadingIndicator={true}
          androidPreferredFramesPerSecond={60}
        />
      </MapView>

      <RecenterButton onPress={handleRecenterPress} style={[styles.recenterButton, { bottom: insets.bottom + 12, left: insets.left + 12, backgroundColor: following ? (colorScheme === 'dark' ? 'rgba(9, 63, 81)' : 'rgba(255,255,255 )') : (colorScheme === 'dark' ? 'rgba(0,0,0)' : 'rgba(255,255,255)'), borderWidth: 1.5, borderColor: following ? String(tint) : 'transparent' }]} color={buttonIconColor} renderAs="native" />

      <CompassButton onPress={() => setCompassOpen(true)} style={[styles.recenterButton, { bottom: insets.bottom + 12 + 58, left: insets.left + 12, backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0)' : 'rgba(255,255,255)', borderWidth: 1.5, borderColor: compassOpen ? String(tint) : 'transparent' }]} color={compassOpen ? tabIconSelected : buttonIconColor} active={compassOpen} renderAs="native" />

      <CompassOverlay
        open={compassOpen}
        onToggle={() => setCompassOpen((v) => !v)}
        headingDeg={compassHeadingDeg}
        angleUnit={angleUnit}
        targetBearingDeg={compassTargetBearingDeg}
        targetLabel={compassTargetLabel}
        headingReferenceLabel={compassHeadingDeg == null ? null : compassHeadingRefLabel}
        bearingText={compassBearingText}
        distanceText={compassDistanceText}
        panelBg={colorScheme === 'dark' ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.96)'}
        borderColor={String(borderColor)}
        background={String(background)}
        textColor={String(textColor)}
        textMuted={String(borderColor)}
        textSubtle={String(borderColor)}
        primary={String(tint)}
        tick={String(borderColor)}
        tickStrong={String(textColor)}
        style={{
          left: insets.left + 12,
          right: insets.right + 12,
          bottom: insets.bottom + 12 + 58,
        }}
      />

      {/* placement mode removed */}

      {/* Compass overlay replaced by CompassOverlay */}

      {lastLocation ? (
        <InfoBox lastLocation={lastLocation} mapHeading={mapHeading} angleUnit={angleUnit} containerStyle={[styles.locationOverlay, { top: insets.top + 12, right: insets.right + 12 }]} textStyle={styles.locationText} renderAs="native" />
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  map: {
    flex: 1,
    alignSelf: 'stretch',
  },
  locationOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 6,
  },
  locationText: {
    color: 'white',
    fontSize: 12,
  },
  placementBannerWrap: {
    position: 'absolute',
    zIndex: 60,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  placementBanner: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    maxWidth: 280,
  },
  placementBannerText: {
    fontSize: 12,
    opacity: 0.9,
  },
  placementBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  placementBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  placementBannerHint: {
    marginLeft: 'auto',
    fontSize: 12,
    opacity: 0.8,
  },
  compassOverlay: {
    // (unused)
  },
  checkpointMarker: {
    position: 'relative',
    width: 32,
    height: 48,
  },
  checkpointIconWrap: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 32,
    height: 32,
  },
  checkpointLabelWrap: {
    position: 'absolute',
    left: 10,
    right: -110,
    bottom: 34,
    maxWidth: 140,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,1)',
  },
  checkpointLabelText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
