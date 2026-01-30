import { CompassOverlay } from '@/components/map/CompassOverlay';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Camera, LineLayer, MapView, MarkerView, ShapeSource, SymbolLayer, UserLocation } from "@maplibre/maplibre-react-native";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '../themed-view';
import { bearingDegrees, haversineMeters, InfoBox, RecenterButton, sleep, CompassButton } from './MaplibreMap.general';
import { buildMapGridGeoJSON, buildMapGridNumbersGeoJSON, buildMapGridSubdivisionsGeoJSON } from './mapGrid';
import { degreesToMils } from './converter';

const GRID_LINE_COLOR = '#111111';

export default function MapLibreMap() {
  const { apiKey, loading } = useMapTilerKey();
  const { lastLocation, requestLocation } = useGPS();
  const {
    checkpoints,
    addCheckpoint,
    removeCheckpoint,
    selectCheckpoint,
    selectedId,
    selectedCheckpoint,
    placementModeRequested,
    consumePlacementModeRequest,
    activeRouteColor,
    activeRouteStart,
    activeRouteLoop,
  } = useCheckpoints();
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
  const [cameraReady, setCameraReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [visibleBounds, setVisibleBounds] = useState<[[number, number], [number, number]] | null>(null);
  const buttonIconColor = following ? tabIconSelected : (colorScheme === 'light' ? tint : iconColor);
  const initialZoomDone = React.useRef(false);

  const compassHeadingDeg = (() => {
    if (!lastLocation) return null;
    const useMag = mapHeading !== 'true';
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
    // Single-press follow. User map interaction stops following.
    requestLocation();
    if (lastLocation) {
      await centerOnLocation(lastLocation);
    }
    setFollowing(true);
  };

  const onMapPress = async (feature: any) => {
    if (following && !placementModeRequested) {
      setFollowing(false);
    }

    if (!placementModeRequested) return;

    const coordinates =
      feature?.geometry?.coordinates ??
      feature?.features?.[0]?.geometry?.coordinates ??
      feature?.coordinates;

    if (!Array.isArray(coordinates) || coordinates.length < 2) return;
    const [longitude, latitude] = coordinates;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
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
          const accent = selected ? tabIconSelected : tint;
          const dotColor = cp.color ?? activeRouteColor ?? accent;
          const markerBg = colorScheme === 'dark' ? 'rgba(16,18,20,0.96)' : 'rgba(255,255,255,0.98)';
          const markerBorder = colorScheme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)';

          return (
            <MarkerView
              key={cp.id}
              coordinate={[cp.longitude, cp.latitude]}
              anchor={{ x: 0.5, y: 1 }}
              allowOverlap={true}
            >
              <TouchableOpacity onPress={() => handleMarkerPress(cp.id)} activeOpacity={0.85}>
                <View style={styles.checkpointRoot}>
                  <View style={[styles.checkpointOuter, { backgroundColor: accent, shadowColor: accent }]}>
                    <View style={[styles.checkpointInner, { backgroundColor: markerBg, borderColor: markerBorder }]}>
                      <View style={[styles.checkpointDot, { backgroundColor: dotColor }]} />
                    </View>
                  </View>
                  <View style={[styles.checkpointStem, { backgroundColor: accent }]} />
                  <View style={[styles.checkpointBase, { backgroundColor: accent }]} />
                  {cp.label && (
                    <View
                      style={[
                        styles.checkpointLabelWrap,
                        {
                          backgroundColor: background,
                          borderColor: selected ? String(accent) : String(borderColor),
                        },
                      ]}
                    >
                      <Text style={[styles.checkpointLabelText, { color: textColor }]}>{cp.label}</Text>
                    </View>
                  )}
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

      {placementModeRequested && (
        <View
          style={[
            styles.placementBannerWrap,
            {
              top: insets.top + 60,
              left: insets.left + 12,
              right: insets.right + 12,
            },
          ]}
        >
          <View style={[styles.placementBanner, { backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.95)', borderColor: String(borderColor) }]}>
            <Text style={[styles.placementBannerTitle, { color: textColor }]}>Placement mode</Text>
            <Text style={[styles.placementBannerText, { color: textColor }]}>Tap map to place checkpoint</Text>
            <TouchableOpacity onPress={() => consumePlacementModeRequest()} style={styles.placementBannerAction}>
              <Text style={[styles.placementBannerHint, { color: String(tint) }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {selectedCheckpoint && (
        <View
          style={[
            styles.checkpointActions,
            {
              right: insets.right + 12,
              bottom: insets.bottom + 12 + 58,
              backgroundColor: colorScheme === 'dark' ? 'rgba(12,12,12,0.85)' : 'rgba(255,255,255,0.95)',
              borderColor: String(borderColor),
            },
          ]}
        >
          <Text style={[styles.checkpointActionsTitle, { color: textColor }]}>Checkpoint selected</Text>
          <Text style={[styles.checkpointActionsMeta, { color: textColor }]}>Lat {selectedCheckpoint.latitude.toFixed(5)} · Lon {selectedCheckpoint.longitude.toFixed(5)}</Text>
          <View style={styles.checkpointActionsRow}>
            <TouchableOpacity
              onPress={() => removeCheckpoint(selectedCheckpoint.id)}
              style={[styles.checkpointActionBtn, { borderColor: String(borderColor) }]}
            >
              <Text style={[styles.checkpointActionText, { color: textColor }]}>Remove</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => selectCheckpoint(null)}
              style={[styles.checkpointActionBtn, { borderColor: 'transparent', backgroundColor: String(tint) }]}
            >
              <Text style={[styles.checkpointActionText, { color: 'white' }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
  },
  placementBanner: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: 320,
  },
  placementBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  placementBannerText: {
    fontSize: 12,
    opacity: 0.85,
    marginTop: 2,
  },
  placementBannerAction: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  placementBannerHint: {
    fontSize: 12,
    fontWeight: '700',
  },
  checkpointActions: {
    position: 'absolute',
    zIndex: 60,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 200,
  },
  checkpointActionsTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  checkpointActionsMeta: {
    marginTop: 2,
    fontSize: 11,
    opacity: 0.8,
  },
  checkpointActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  checkpointActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkpointActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  checkpointRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkpointOuter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    padding: 2,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  checkpointInner: {
    flex: 1,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkpointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  checkpointStem: {
    width: 4,
    height: 10,
    borderRadius: 2,
    marginTop: 2,
  },
  checkpointBase: {
    width: 16,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
    opacity: 0.25,
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
});
