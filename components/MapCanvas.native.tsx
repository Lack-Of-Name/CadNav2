import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { LocalTile, Marker, Polyline, Polygon, Region, UrlTile } from 'react-native-maps';
import type { LatLng } from '../app/utils/geo';
import type { GridConfig } from '../app/utils/grid';
import { computeGrid } from '../app/utils/grid';
import { useAppTheme } from '../app/state/ThemeContext';

export type Checkpoint = {
  id: string;
  name: string;
  coordinate: LatLng;
  createdAt?: number;
};

export type MapCanvasHandle = {
  centerOn: (coordinate: LatLng, options?: { animated?: boolean; zoom?: number }) => void;
  getCenter: () => LatLng | null;
};

export type MapCanvasProps = {
  checkpoints: Checkpoint[];
  selectedCheckpointId: string | null;
  userLocation: LatLng | null;
  userHeadingDeg?: number | null;
  grid?: GridConfig;
  offlineMapMode?: 'online' | 'offline';
  offlineTileTemplateUri?: string | null;
  baseMap?: 'osm' | 'esriWorldImagery';
  initialCenter?: LatLng | null;
  onCenterChange?: (center: LatLng) => void;
  minZoomLevel?: number;
  maxZoomLevel?: number;
  mapDownload?: { active: boolean; firstCorner: LatLng | null; secondCorner: LatLng | null };
  onMapTap?: (coordinate: LatLng) => void;
  placingCheckpoint?: boolean;
  onPlaceCheckpointAt?: (coordinate: LatLng) => void;
  onSelectCheckpoint: (id: string) => void;
};

function coordKey(coord: LatLng) {
  return `${coord.latitude.toFixed(6)},${coord.longitude.toFixed(6)}`;
}

const DEFAULT_REGION: Region = {
  latitude: -36.9962,
  longitude: 145.0272,
  latitudeDelta: 0.09,
  longitudeDelta: 0.09,
};

const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(
  (
    {
      checkpoints,
      selectedCheckpointId,
      userLocation,
      userHeadingDeg = null,
      grid = null,
      offlineMapMode = 'online',
      offlineTileTemplateUri = null,
      baseMap = 'osm',
      initialCenter = null,
      onCenterChange,
      minZoomLevel,
      maxZoomLevel,
      mapDownload,
      onMapTap,
      placingCheckpoint = false,
      onPlaceCheckpointAt,
      onSelectCheckpoint,
    },
    ref
  ) => {
    const { theme } = useAppTheme();

    const hexToRgba = (hex: string, alpha: number) => {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
      if (!m) return hex;
      const int = Number.parseInt(m[1], 16);
      const r = (int >> 16) & 255;
      const g = (int >> 8) & 255;
      const b = int & 255;
      return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
    };

    const mapIsTypicallyDark = baseMap === 'esriWorldImagery';
    const gridMajorColor = useMemo(() => {
      const isRetro = theme.id === 'retroLight' || theme.id === 'retroDark';
      if (isRetro) return hexToRgba(theme.colors.primary, mapIsTypicallyDark ? 0.75 : 0.7);
      return mapIsTypicallyDark ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.55)';
    }, [theme.id, theme.colors.primary, mapIsTypicallyDark]);

    const gridMinorColor = useMemo(() => {
      const isRetro = theme.id === 'retroLight' || theme.id === 'retroDark';
      if (isRetro) return hexToRgba(theme.colors.primaryPressed, mapIsTypicallyDark ? 0.32 : 0.26);
      return mapIsTypicallyDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.14)';
    }, [theme.id, theme.colors.primaryPressed, mapIsTypicallyDark]);

    const gridLabel = useMemo(() => {
      if (mapIsTypicallyDark) {
        return {
          bg: 'rgba(255,255,255,0.92)',
          border: 'rgba(15,23,42,0.20)',
          text: '#0f172a',
        };
      }
      return {
        bg: 'rgba(15,23,42,0.90)',
        border: 'rgba(255,255,255,0.20)',
        text: '#ffffff',
      };
    }, [mapIsTypicallyDark]);
    const initialRegion: Region = useMemo(() => {
      if (!initialCenter) return DEFAULT_REGION;
      return {
        latitude: initialCenter.latitude,
        longitude: initialCenter.longitude,
        latitudeDelta: DEFAULT_REGION.latitudeDelta,
        longitudeDelta: DEFAULT_REGION.longitudeDelta,
      };
    }, [initialCenter]);

    const mapRef = useRef<MapView | null>(null);
    const lastRegionRef = useRef<Region>(initialRegion);
    const [regionForGrid, setRegionForGrid] = useState<Region>(() => initialRegion);
    const lastMarkerPressAtRef = useRef<number>(0);
    const didInitialCenterOverrideRef = useRef(false);

    const onCenterChangeRef = useRef<typeof onCenterChange>(onCenterChange);
    onCenterChangeRef.current = onCenterChange;

    const placingCheckpointRef = useRef(placingCheckpoint);
    const onPlaceCheckpointAtRef = useRef(onPlaceCheckpointAt);
    const onSelectCheckpointRef = useRef(onSelectCheckpoint);
    const onMapTapRef = useRef(onMapTap);

    placingCheckpointRef.current = placingCheckpoint;
    onPlaceCheckpointAtRef.current = onPlaceCheckpointAt;
    onSelectCheckpointRef.current = onSelectCheckpoint;
    onMapTapRef.current = onMapTap;

    const downloadPolygon = useMemo(() => {
      if (!mapDownload?.active) return null;
      if (!mapDownload.firstCorner || !mapDownload.secondCorner) return null;

      const latMin = Math.min(mapDownload.firstCorner.latitude, mapDownload.secondCorner.latitude);
      const latMax = Math.max(mapDownload.firstCorner.latitude, mapDownload.secondCorner.latitude);
      const lonMin = Math.min(mapDownload.firstCorner.longitude, mapDownload.secondCorner.longitude);
      const lonMax = Math.max(mapDownload.firstCorner.longitude, mapDownload.secondCorner.longitude);

      const tl = { latitude: latMax, longitude: lonMin };
      const tr = { latitude: latMax, longitude: lonMax };
      const br = { latitude: latMin, longitude: lonMax };
      const bl = { latitude: latMin, longitude: lonMin };
      return [tl, tr, br, bl];
    }, [mapDownload?.active, mapDownload?.firstCorner, mapDownload?.secondCorner]);

    useImperativeHandle(
      ref,
      () => ({
        centerOn: (coordinate, options) => {
          const duration = options?.animated === false ? 0 : 450;

          const cameraZoom = typeof options?.zoom === 'number' ? options.zoom : undefined;
          const animateCamera = (mapRef.current as any)?.animateCamera as
            | ((camera: any, opts?: { duration?: number }) => void)
            | undefined;

          if (animateCamera) {
            animateCamera(
              {
                center: { latitude: coordinate.latitude, longitude: coordinate.longitude },
                ...(typeof cameraZoom === 'number' ? { zoom: cameraZoom } : null),
              },
              { duration }
            );
            return;
          }

          const current = lastRegionRef.current;
          const target: Region = {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            latitudeDelta: current?.latitudeDelta ?? 0.012,
            longitudeDelta: current?.longitudeDelta ?? 0.012,
          };
          mapRef.current?.animateToRegion(target, duration);
        },
        getCenter: () => ({
          latitude: lastRegionRef.current.latitude,
          longitude: lastRegionRef.current.longitude,
        }),
      }),
      []
    );

    const locationCoord = userLocation
      ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
      : null;

    const offlinePathTemplate = useMemo(() => {
      if (typeof offlineTileTemplateUri !== 'string') return null;
      // LocalTile expects a filesystem path, not a file:// URI.
      return offlineTileTemplateUri.replace(/^file:\/\//, '');
    }, [offlineTileTemplateUri]);

    useEffect(() => {
      if (didInitialCenterOverrideRef.current) return;
      if (!locationCoord) return;
      if (!mapRef.current?.animateToRegion) return;

      const current = lastRegionRef.current;
      const isStillDefault =
        Math.abs(current.latitude - DEFAULT_REGION.latitude) < 0.0005 &&
        Math.abs(current.longitude - DEFAULT_REGION.longitude) < 0.0005;

      if (!isStillDefault) return;

      const target: Region = {
        latitude: locationCoord.latitude,
        longitude: locationCoord.longitude,
        latitudeDelta: current.latitudeDelta,
        longitudeDelta: current.longitudeDelta,
      };

      mapRef.current.animateToRegion(target, 0);
      didInitialCenterOverrideRef.current = true;
    }, [locationCoord]);

    const markerGroups = (() => {
      const groups = new Map<string, { coordinate: LatLng; checkpoints: Checkpoint[] }>();
      for (const cp of checkpoints) {
        const key = coordKey(cp.coordinate);
        const existing = groups.get(key);
        if (existing) existing.checkpoints.push(cp);
        else groups.set(key, { coordinate: cp.coordinate, checkpoints: [cp] });
      }

      return Array.from(groups.values()).map((g) => {
        const selected =
          selectedCheckpointId != null && g.checkpoints.some((c) => c.id === selectedCheckpointId);
        const representative =
          g.checkpoints
            .slice()
            .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0] ?? g.checkpoints[0];
        return { ...g, selected, representative };
      });
    })();

    const connectionCoords = (() => {
      if (checkpoints.length < 2) return null;
      const seen = new Set<string>();
      const points: Array<{ latitude: number; longitude: number }> = [];
      for (const cp of checkpoints) {
        const key = coordKey(cp.coordinate);
        if (seen.has(key)) continue;
        seen.add(key);
        points.push({ latitude: cp.coordinate.latitude, longitude: cp.coordinate.longitude });
      }
      return points.length >= 2 ? points : null;
    })();

    const computedGrid = useMemo(() => {
      if (!grid?.enabled || !grid.anchor) return null;

      const r = regionForGrid;
      const latMin = r.latitude - r.latitudeDelta / 2;
      const latMax = r.latitude + r.latitudeDelta / 2;
      const lonMin = r.longitude - r.longitudeDelta / 2;
      const lonMax = r.longitude + r.longitudeDelta / 2;
      return computeGrid({ latMin, latMax, lonMin, lonMax }, grid);
    }, [grid, regionForGrid]);

    const gridDensity = useMemo(() => {
      if (!grid?.enabled) return { showMinor: false, showLabels: false };
      const r = regionForGrid;
      const approxMetersWide = Math.max(r.latitudeDelta, r.longitudeDelta) * 111_320;
      const approxMajorCount = approxMetersWide / Math.max(10, grid.majorSpacingMeters);
      return {
        showMinor: approxMajorCount <= 12,
        showLabels: approxMajorCount <= 8,
      };
    }, [grid, regionForGrid]);

    return (
      <MapView
        ref={(r) => {
          mapRef.current = r;
        }}
        style={styles.root}
        initialRegion={initialRegion}
        onRegionChangeComplete={(region) => {
          lastRegionRef.current = region;
          setRegionForGrid(region);
          onCenterChangeRef.current?.({ latitude: region.latitude, longitude: region.longitude });
        }}
        onPress={(e) => {
          if (Date.now() - lastMarkerPressAtRef.current < 250) return;

          const coord = e?.nativeEvent?.coordinate;
          if (!coord) return;

          const tapped = { latitude: coord.latitude, longitude: coord.longitude };
          const onTap = onMapTapRef.current;
          if (onTap) {
            onTap(tapped);
            return;
          }

          if (!placingCheckpointRef.current) return;
          const handler = onPlaceCheckpointAtRef.current;
          if (!handler) return;
          handler(tapped);
        }}
        rotateEnabled
        pitchEnabled
        mapType={'none'}
        minZoomLevel={offlineMapMode === 'offline' ? minZoomLevel : undefined}
        maxZoomLevel={offlineMapMode === 'offline' ? maxZoomLevel : undefined}
      >
        {offlineMapMode === 'offline' && typeof offlinePathTemplate === 'string' && (
          <LocalTile pathTemplate={offlinePathTemplate} tileSize={256} />
        )}

        {offlineMapMode !== 'offline' && baseMap === 'esriWorldImagery' && (
          <UrlTile
            urlTemplate="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maximumZ={19}
            zIndex={-2}
            tileSize={256}
          />
        )}

        {offlineMapMode !== 'offline' && baseMap === 'osm' && (
          <UrlTile
            urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            zIndex={-2}
            tileSize={256}
          />
        )}

        {downloadPolygon && (
          <Polygon
            coordinates={downloadPolygon}
            strokeColor={hexToRgba(theme.colors.success, 0.95)}
            fillColor={hexToRgba(theme.colors.success, 0.18)}
            strokeWidth={2}
            zIndex={0}
          />
        )}

        {computedGrid && (
          <>
            {gridDensity.showMinor && (
              <>
                {computedGrid.minorLonLines.map((lon) => (
                  <Polyline
                    key={`minor-v-${lon.toFixed(6)}`}
                    coordinates={[
                      { latitude: regionForGrid.latitude - regionForGrid.latitudeDelta / 2, longitude: lon },
                      { latitude: regionForGrid.latitude + regionForGrid.latitudeDelta / 2, longitude: lon },
                    ]}
                    strokeColor={gridMinorColor}
                    strokeWidth={1}
                    zIndex={1}
                  />
                ))}

                {computedGrid.minorLatLines.map((lat) => (
                  <Polyline
                    key={`minor-h-${lat.toFixed(6)}`}
                    coordinates={[
                      { latitude: lat, longitude: regionForGrid.longitude - regionForGrid.longitudeDelta / 2 },
                      { latitude: lat, longitude: regionForGrid.longitude + regionForGrid.longitudeDelta / 2 },
                    ]}
                    strokeColor={gridMinorColor}
                    strokeWidth={1}
                    zIndex={1}
                  />
                ))}
              </>
            )}

            {computedGrid.majorLonLines.map((ln) => (
              <React.Fragment key={`major-v-${ln.lon.toFixed(6)}`}>
                <Polyline
                  coordinates={[
                    { latitude: regionForGrid.latitude - regionForGrid.latitudeDelta / 2, longitude: ln.lon },
                    { latitude: regionForGrid.latitude + regionForGrid.latitudeDelta / 2, longitude: ln.lon },
                  ]}
                  strokeColor={gridMajorColor}
                  strokeWidth={1}
                  zIndex={2}
                />
                {gridDensity.showLabels && (
                  <Marker
                    coordinate={{
                      latitude:
                        regionForGrid.latitude +
                        regionForGrid.latitudeDelta / 2 -
                        regionForGrid.latitudeDelta * 0.03,
                      longitude: ln.lon,
                    }}
                    anchor={{ x: 0.5, y: 0 }}
                    tracksViewChanges={false}
                  >
                    <View style={[styles.gridLabelPill, { backgroundColor: gridLabel.bg, borderColor: gridLabel.border }]}>
                      <Text style={[styles.gridLabelText, { color: gridLabel.text }]}>{ln.label}</Text>
                    </View>
                  </Marker>
                )}
              </React.Fragment>
            ))}

            {computedGrid.majorLatLines.map((lt) => (
              <React.Fragment key={`major-h-${lt.lat.toFixed(6)}`}>
                <Polyline
                  coordinates={[
                    { latitude: lt.lat, longitude: regionForGrid.longitude - regionForGrid.longitudeDelta / 2 },
                    { latitude: lt.lat, longitude: regionForGrid.longitude + regionForGrid.longitudeDelta / 2 },
                  ]}
                  strokeColor={gridMajorColor}
                  strokeWidth={1}
                  zIndex={2}
                />
                {gridDensity.showLabels && (
                  <Marker
                    coordinate={{
                      latitude: lt.lat,
                      longitude:
                        regionForGrid.longitude -
                        regionForGrid.longitudeDelta / 2 +
                        regionForGrid.longitudeDelta * 0.03,
                    }}
                    anchor={{ x: 0, y: 0.5 }}
                    tracksViewChanges={false}
                  >
                    <View style={[styles.gridLabelPill, { backgroundColor: gridLabel.bg, borderColor: gridLabel.border }]}>
                      <Text style={[styles.gridLabelText, { color: gridLabel.text }]}>{lt.label}</Text>
                    </View>
                  </Marker>
                )}
              </React.Fragment>
            ))}
          </>
        )}

        {connectionCoords && (
          <Polyline coordinates={connectionCoords} strokeColor="#0f172a" strokeWidth={2} />
        )}

        {locationCoord && (
          <Marker coordinate={locationCoord} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.locationWrap}>
              {typeof userHeadingDeg === 'number' && (
                <View
                  style={[
                    styles.locationNose,
                    {
                      transform: [{ rotateZ: `${userHeadingDeg}deg` }],
                    },
                  ]}
                />
              )}
              <View style={styles.locationOuter}>
                <View style={styles.locationInner} />
              </View>
            </View>
          </Marker>
        )}

        {markerGroups.map((g) => {
          return (
            <Marker
              key={coordKey(g.coordinate)}
              coordinate={{ latitude: g.coordinate.latitude, longitude: g.coordinate.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => {
                lastMarkerPressAtRef.current = Date.now();
                if (placingCheckpointRef.current) {
                  const handler = onPlaceCheckpointAtRef.current;
                  if (handler) handler(g.coordinate);
                  return;
                }

                onSelectCheckpointRef.current(g.representative.id);
              }}
              tracksViewChanges={false}
            >
              <View style={styles.flagWrap}>
                <View style={[styles.flagPole, g.selected && styles.flagPoleActive]} />
                <View style={[styles.flag, g.selected && styles.flagActive]}>
                  <View style={[styles.flagLabelDot, g.selected && styles.flagLabelDotActive]} />
                </View>
                <View style={[styles.flagBase, g.selected && styles.flagBaseActive]} />
              </View>
            </Marker>
          );
        })}
      </MapView>
    );
  }
);

export default MapCanvas;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  locationWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationNose: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#0f172a',
  },
  locationOuter: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0f172a',
  },
  flagWrap: {
    width: 30,
    height: 40,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  flagPole: {
    position: 'absolute',
    left: 14,
    top: 6,
    width: 2,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#64748b',
  },
  flagPoleActive: {
    backgroundColor: '#0f172a',
  },
  flag: {
    position: 'absolute',
    left: 16,
    top: 6,
    width: 14,
    height: 10,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  flagLabelDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#0f172a',
  },
  flagLabelDotActive: {
    backgroundColor: '#ffffff',
  },
  flagBase: {
    position: 'absolute',
    left: 12,
    bottom: 6,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#64748b',
  },
  flagBaseActive: {
    backgroundColor: '#0f172a',
  },

  gridLabelPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    minHeight: 22,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabelText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
    lineHeight: 14,
    includeFontPadding: false,
  },
});
