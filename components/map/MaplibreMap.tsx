import DownloadProgressOverlay from '@/components/DownloadProgressOverlay';
import { CompassOverlay } from '@/components/map/CompassOverlay';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { useOfflineMaps } from '@/hooks/offline-maps';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '../themed-view';
import { bearingDegrees, CompassButton, haversineMeters, InfoBox, RecenterButton, sleep } from './MaplibreMap.general';
import { degreesToMils } from './converter';

let maplibreModule: any | undefined | null;

function getMaplibreModule() {
  if (maplibreModule !== undefined) return maplibreModule;
  try {
    // Avoid hard-crashing Expo Go when the native module isn't available.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    maplibreModule = require('@maplibre/maplibre-react-native');
  } catch {
    maplibreModule = null;
  }
  return maplibreModule;
}

export default function MapLibreMap() {
  const maplibre = getMaplibreModule();
  const { apiKey, loading } = useMapTilerKey();
  const { lastLocation, requestLocation } = useGPS();
  const { checkpoints, selectCheckpoint, selectedId, selectedCheckpoint, placementModeRequested, consumePlacementModeRequest, addCheckpoint, activeRouteColor, activeRouteStart, activeRouteLoop } = useCheckpoints();
  const { angleUnit, mapHeading } = useSettings();
  const { initOffline } = useOfflineMaps();
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
  const [cameraReady, setCameraReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [visibleBounds, setVisibleBounds] = useState<[[number, number], [number, number]] | null>(null);
  const buttonIconColor = following ? tabIconSelected : (colorScheme === 'light' ? tint : iconColor);
  const initialZoomDone = React.useRef(false);

  const compassHeadingDeg = (() => {
    if (!lastLocation) return null;
    const useMag = mapHeading === 'magnetic';
    const h = useMag ? lastLocation.coords.magHeading : lastLocation.coords.trueHeading;
    return typeof h === 'number' ? h : null;
  })();

  const compassHeadingRefLabel = compassHeadingDeg == null ? null : (mapHeading === 'true' ? 'True' : 'Magnetic');

  const selectedIndex = selectedCheckpoint
    ? checkpoints.findIndex((c) => c.id === selectedCheckpoint.id)
    : -1;

  const compassTargetLabel = selectedCheckpoint
    ? selectedCheckpoint.label?.trim() || `Checkpoint ${selectedIndex + 1}`
    : null;

  const compassTargetBearingDeg =
    lastLocation && selectedCheckpoint
      ? bearingDegrees(
          lastLocation.coords.latitude,
          lastLocation.coords.longitude,
          selectedCheckpoint.latitude,
          selectedCheckpoint.longitude
        )
      : null;

  const compassBearingText =
    typeof compassTargetBearingDeg === 'number'
      ? angleUnit === 'mils'
        ? `${Math.round(degreesToMils(compassTargetBearingDeg, { normalize: true }))} mils`
        : `${Math.round(compassTargetBearingDeg)}°`
      : null;

  const compassDistanceText =
    lastLocation && selectedCheckpoint
      ? (() => {
          const meters = haversineMeters(
            lastLocation.coords.latitude,
            lastLocation.coords.longitude,
            selectedCheckpoint.latitude,
            selectedCheckpoint.longitude
          );
          if (!Number.isFinite(meters)) return null;
          if (meters >= 1000) {
            const km = meters / 1000;
            const decimals = km >= 10 ? 0 : 1;
            return `${km.toFixed(decimals)} km`;
          }
          return `${Math.round(meters)} m`;
        })()
      : null;

  const centerOnLocation = async (loc: any) => {
    if (!loc || !cameraRef.current) return;
    const { latitude, longitude } = loc.coords;
    cameraRef.current.zoomTo?.(12, 200);
    await sleep(200);
    cameraRef.current.flyTo?.([longitude, latitude], 800);
    await sleep(800)
  };

  const handleRecenterPress = async () => {
    // Always re-center and enable following. Following stops on user map interaction.
    requestLocation();
    if (lastLocation) {
      await centerOnLocation(lastLocation);
    }
    setFollowing(true);
  };

  const onMapPress = async (feature: any) => {
    if (!placementModeRequested) return;
    const { geometry } = feature;
    const [longitude, latitude] = geometry.coordinates;
    await addCheckpoint(latitude, longitude);
    await consumePlacementModeRequest();
  };

  const handleMarkerPress = async (id: string) => {
    if (selectedId === id) {
      await selectCheckpoint(null);
      return;
    }
    await selectCheckpoint(id);
  };

  useEffect(() => {
    if (lastLocation && !initialZoomDone.current && cameraRef.current && cameraReady) {
      initialZoomDone.current = true;
      void centerOnLocation(lastLocation);
      setFollowing(true);
    }
  }, [lastLocation, cameraReady]);

  // Initialize offline ambient cache on first mount
  useEffect(() => {
    initOffline();
  }, [initOffline]);

  useEffect(() => {
    if (!following || !lastLocation || !cameraRef.current) return;
    const { latitude, longitude } = lastLocation.coords;
    cameraRef.current.flyTo([longitude, latitude]);
  }, [lastLocation, following]);

  if (!maplibre) {
    return (
      <ThemedView style={styles.page}>
        <Text style={styles.unavailableTitle}>Map unavailable in Expo Go</Text>
        <Text style={styles.unavailableBody}>
          This screen uses native MapLibre modules, which require a custom dev client or a prebuilt app.
        </Text>
        <Text style={styles.unavailableBody}>
          Build with a dev client (or run a prebuilt app) to enable the native map view.
        </Text>
      </ThemedView>
    );
  }

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

  const routeLineShape = (() => {
    if (!activeRouteColor) return emptyGeo;
    const coords = checkpoints.map((cp) => [cp.longitude, cp.latitude]);
    if (activeRouteStart) {
      coords.unshift([activeRouteStart.longitude, activeRouteStart.latitude]);
    }
    if (activeRouteLoop && coords.length > 1) {
      const first = coords[0];
      coords.push(first);
    }
    if (coords.length < 2) return emptyGeo;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
          properties: { kind: 'routeLine' },
        },
      ],
    } as any;
  })();


  const { Camera, LineLayer, MapView, MarkerView, ShapeSource, UserLocation } = maplibre as any;

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
        onPress={onMapPress}
        onRegionDidChange={(ev: any) => {
          const z = ev?.properties?.zoomLevel ?? ev?.properties?.zoom ?? ev?.zoomLevel;
          if (typeof z === 'number' && Number.isFinite(z)) setZoomLevel(z);
          // Keep bounds updated for the grid overlay.
          const getBounds = mapRef.current?.getVisibleBounds;
          if (typeof getBounds === 'function') {
            Promise.resolve()
              .then(() => getBounds.call ? getBounds.call(mapRef.current) : getBounds())
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
          const isUserInteraction = Boolean(
            ev?.properties?.isUserInteraction ??
            ev?.properties?.isUserTouching ??
            ev?.properties?.isGestureActive
          );
          if (following && isUserInteraction) {
            setFollowing(false);
          }
          // Update continuously while the camera is moving so grid follows the camera.
          const z = ev?.properties?.zoomLevel ?? ev?.properties?.zoom ?? ev?.zoomLevel;
          if (typeof z === 'number' && Number.isFinite(z)) setZoomLevel(z);
          const getBounds = mapRef.current?.getVisibleBounds;
          if (typeof getBounds === 'function') {
            // Use the same Promise-based approach as onRegionDidChange so both async and sync
            // implementations of getVisibleBounds are handled consistently.
            Promise.resolve()
              .then(() => getBounds.call ? getBounds.call(mapRef.current) : getBounds())
              .then((b: any) => {
                if (Array.isArray(b) && b.length === 2 && Array.isArray(b[0]) && Array.isArray(b[1])) {
                  setVisibleBounds(b as [[number, number], [number, number]]);
                }
              })
              .catch(() => {
                // ignore
              });
          }
        }}
      >
        <Camera
          ref={(ref) => {
            cameraRef.current = ref;
            if (ref) setCameraReady(true);
          }}
          defaultSettings={{
            centerCoordinate: [0, 0],
            zoomLevel: 1,
          }}
        />

        <ShapeSource id="route-line-source" shape={routeLineShape}>
          <LineLayer
            id="route-line"
            style={{
              lineColor: activeRouteColor ?? 'transparent',
              lineOpacity: activeRouteColor ? 0.75 : 0,
              lineWidth: 3,
            }}
          />
        </ShapeSource>

        {checkpoints.map((cp) => {
          const selected = selectedId === cp.id;
          const dotColor = cp.color ?? activeRouteColor ?? tint;
          return (
            <MarkerView key={cp.id} coordinate={[cp.longitude, cp.latitude]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap={true}>
              <TouchableOpacity onPress={() => handleMarkerPress(cp.id)} activeOpacity={0.85}>
                <View style={styles.checkpointRoot}>
                  <View style={styles.checkpointOuter}>
                    <View style={styles.checkpointInner}>
                      <View style={[styles.checkpointDot, { backgroundColor: dotColor }]} />
                    </View>
                  </View>
                  {cp.label ? (
                    <View style={[styles.checkpointLabelWrap, { backgroundColor: background, borderColor: selected ? String(tint) : String(borderColor) }]}> 
                      <Text style={[styles.checkpointLabelText, { color: textColor }]}>{cp.label}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            </MarkerView>
          );
        })}

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

      <DownloadProgressOverlay />

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

      {placementModeRequested ? (
        <View style={[styles.placementBannerWrap, { top: insets.top + 12, left: 0, right: 0 }]}> 
          <View style={[styles.placementBanner, { backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.95)', borderColor: String(borderColor) }]}>
            <View style={styles.placementBannerRow}>
              <Text style={[styles.placementBannerTitle, { color: String(textColor) }]}>Place checkpoint</Text>
              <Text style={[styles.placementBannerHint, { color: String(borderColor) }]}>Tap map</Text>
            </View>
            <Text style={[styles.placementBannerText, { color: String(borderColor) }]}>Tap anywhere on the map to drop a checkpoint.</Text>
          </View>
        </View>
      ) : null}

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
  checkpointRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkpointOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  checkpointInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkpointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checkpointLabelWrap: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 160,
  },
  checkpointLabelText: {
    fontSize: 11,
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
  unavailableTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  unavailableBody: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.75,
    paddingHorizontal: 18,
    marginBottom: 6,
  },
});
