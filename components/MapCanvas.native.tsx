import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import type { LatLng } from '../app/utils/geo';
import type { GridConfig } from '../app/utils/grid';
import { computeGrid } from '../app/utils/grid';

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
      placingCheckpoint = false,
      onPlaceCheckpointAt,
      onSelectCheckpoint,
    },
    ref
  ) => {
    const mapRef = useRef<MapView | null>(null);
    const lastRegionRef = useRef<Region>(DEFAULT_REGION);
    const [regionForGrid, setRegionForGrid] = useState<Region>(DEFAULT_REGION);
    const lastMarkerPressAtRef = useRef<number>(0);

    const placingCheckpointRef = useRef(placingCheckpoint);
    const onPlaceCheckpointAtRef = useRef(onPlaceCheckpointAt);
    const onSelectCheckpointRef = useRef(onSelectCheckpoint);

    placingCheckpointRef.current = placingCheckpoint;
    onPlaceCheckpointAtRef.current = onPlaceCheckpointAt;
    onSelectCheckpointRef.current = onSelectCheckpoint;

    useImperativeHandle(
      ref,
      () => ({
        centerOn: (coordinate, options) => {
          const target: Region = {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          };
          mapRef.current?.animateToRegion(target, options?.animated === false ? 0 : 450);
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
        initialRegion={DEFAULT_REGION}
        onRegionChangeComplete={(region) => {
          lastRegionRef.current = region;
          setRegionForGrid(region);
        }}
        onPress={(e) => {
          if (Date.now() - lastMarkerPressAtRef.current < 250) return;
          if (!placingCheckpointRef.current) return;
          const handler = onPlaceCheckpointAtRef.current;
          if (!handler) return;
          const coord = e?.nativeEvent?.coordinate;
          if (!coord) return;
          handler({ latitude: coord.latitude, longitude: coord.longitude });
        }}
        rotateEnabled
        pitchEnabled
      >
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
                    strokeColor="rgba(15,23,42,0.14)"
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
                    strokeColor="rgba(15,23,42,0.14)"
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
                  strokeColor="rgba(15,23,42,0.55)"
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
                    <View style={styles.gridLabelPill}>
                      <Text style={styles.gridLabelText}>{ln.label}</Text>
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
                  strokeColor="rgba(15,23,42,0.55)"
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
                    <View style={styles.gridLabelPill}>
                      <Text style={styles.gridLabelText}>{lt.label}</Text>
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
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  gridLabelText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
  },
});
