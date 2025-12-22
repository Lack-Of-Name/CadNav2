import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import type { LatLng } from '../app/utils/geo';
import type { GridConfig } from '../app/utils/grid';
import { computeGrid } from '../app/utils/grid';

const leaflet = require('react-leaflet');
const MapContainer = leaflet.MapContainer;
const TileLayer = leaflet.TileLayer;
const Marker = leaflet.Marker;
const CircleMarker = leaflet.CircleMarker;
const Polyline = leaflet.Polyline;
const Polygon = leaflet.Polygon;
const useMap = leaflet.useMap;
const useMapEvents = leaflet.useMapEvents;

const L = require('leaflet');

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
  mapDownload?: { active: boolean; firstCorner: LatLng | null; secondCorner: LatLng | null };
  onMapTap?: (coordinate: LatLng) => void;
  placingCheckpoint?: boolean;
  onPlaceCheckpointAt?: (coordinate: LatLng) => void;
  onSelectCheckpoint: (id: string) => void;
};

function coordKey(coord: LatLng) {
  return `${coord.latitude.toFixed(6)},${coord.longitude.toFixed(6)}`;
}

function useLeafletCss() {
  const addedRef = useRef(false);

  useEffect(() => {
    if (addedRef.current) return;

    const id = 'leaflet-css';
    if (document.getElementById(id)) {
      addedRef.current = true;
      return;
    }

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.crossOrigin = '';
    document.head.appendChild(link);

    addedRef.current = true;
  }, []);
}

const DEFAULT_CENTER: LatLng = { latitude: -36.9962, longitude: 145.0272 };
const DEFAULT_ZOOM = 13;

function toLeafletLatLng(coord: LatLng) {
  return [coord.latitude, coord.longitude] as [number, number];
}

function makeFlagIcon(selected: boolean) {
  const stroke = selected ? '#0f172a' : '#64748b';
  const fill = selected ? '#0f172a' : '#ffffff';
  const text = selected ? '#ffffff' : '#0f172a';

  const html = `
    <div style="position:relative; width:28px; height:38px;">
      <div style="position:absolute; left:12px; top:6px; width:2px; height:22px; background:${stroke}; border-radius:999px;"></div>
      <div style="position:absolute; left:14px; top:6px; width:14px; height:10px; background:${fill}; border:1px solid ${stroke}; border-radius:4px; display:flex; align-items:center; justify-content:center;">
        <div style="font-size:9px; font-weight:800; color:${text}; line-height:9px;">CP</div>
      </div>
      <div style="position:absolute; left:10px; bottom:6px; width:6px; height:6px; background:${stroke}; border-radius:999px;"></div>
    </div>
  `;

  return L.divIcon({
    className: 'leaflet-interactive',
    html,
    iconSize: [28, 38],
    iconAnchor: [13, 32],
  });
}

function makeLocationIcon(headingDeg: number | null | undefined) {
  const safeHeading = typeof headingDeg === 'number' ? headingDeg : 0;
  const html = `
    <div style="position:relative; width:24px; height:24px;">
      <div style="position:absolute; left:50%; top:50%; width:16px; height:16px; transform:translate(-50%,-50%); border-radius:999px; background:#0f172a; border:3px solid #ffffff; box-shadow:0 0 0 1px rgba(226,232,240,1);"></div>
      <div style="position:absolute; left:50%; top:50%; width:0; height:0; transform:translate(-50%,-50%) rotate(${safeHeading}deg);">
        <div style="position:absolute; left:-5px; top:-16px; width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-bottom:10px solid #0f172a;"></div>
      </div>
    </div>
  `;

  return L.divIcon({
    className: '',
    html,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const MapBridge = ({
  onMap,
  onCenter,
  onMapTap,
  placingCheckpoint,
  onPlaceCheckpointAt,
}: {
  onMap: (map: any) => void;
  onCenter: (coord: LatLng) => void;
  onMapTap: ((coordinate: LatLng) => void) | null;
  placingCheckpoint: boolean;
  onPlaceCheckpointAt: ((coordinate: LatLng) => void) | null;
}) => {
  const map = useMap();

  const placingCheckpointRef = useRef(placingCheckpoint);
  const onMapTapRef = useRef(onMapTap);
  const onPlaceCheckpointAtRef = useRef(onPlaceCheckpointAt);

  placingCheckpointRef.current = placingCheckpoint;
  onMapTapRef.current = onMapTap;
  onPlaceCheckpointAtRef.current = onPlaceCheckpointAt;

  useEffect(() => {
    onMap(map);
    const center = map.getCenter();
    onCenter({ latitude: center.lat, longitude: center.lng });
  }, [map, onMap, onCenter]);

  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onCenter({ latitude: center.lat, longitude: center.lng });
    },
    click: (e: any) => {
      const ll = e?.latlng;
      if (!ll) return;

      const tapped = { latitude: ll.lat, longitude: ll.lng };
      const onTap = onMapTapRef.current;
      if (onTap) {
        onTap(tapped);
        return;
      }

      if (!placingCheckpointRef.current) return;
      const handler = onPlaceCheckpointAtRef.current;
      if (!handler) return;
      handler(tapped);
    },
  });

  return null;
};

const GridOverlay = ({ grid }: { grid: GridConfig | null }) => {
  const map = useMap();
  const layerRef = useRef<any | null>(null);

  useEffect(() => {
    if (!layerRef.current) {
      layerRef.current = L.layerGroup();
      layerRef.current.addTo(map);
    }
    return () => {
      try {
        layerRef.current?.remove();
      } catch {
        // ignore
      }
      layerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const draw = () => {
      try {
        layer.clearLayers();
      } catch {
        // ignore
      }

      if (!grid?.enabled || !grid.anchor) return;

      const b = map.getBounds();
      const north = b.getNorth();
      const south = b.getSouth();
      const west = b.getWest();
      const east = b.getEast();

      const computed = computeGrid(
        { latMin: south, latMax: north, lonMin: west, lonMax: east },
        grid
      );
      if (!computed) return;

      // Density controls (keep UX clean at low zoom).
      const size = map.getSize();
      const metersWide = map.distance([south, west], [south, east]);
      const metersPerPx = metersWide > 0 && size?.x ? metersWide / size.x : 999;
      const majorPx = grid.majorSpacingMeters / Math.max(0.001, metersPerPx);
      const showMinor = majorPx >= 90;
      const showLabels = majorPx >= 55;

      const majorStyle = { color: '#0f172a', weight: 1, opacity: 0.55, interactive: false };
      const minorStyle = { color: '#0f172a', weight: 1, opacity: 0.14, interactive: false };

      const latPad = Math.max(0, (north - south) * 0.05);
      const lonPad = Math.max(0, (east - west) * 0.05);

      if (showMinor) {
        for (const lon of computed.minorLonLines) {
          L.polyline(
            [
              [south, lon],
              [north, lon],
            ],
            minorStyle
          ).addTo(layer);
        }
        for (const lat of computed.minorLatLines) {
          L.polyline(
            [
              [lat, west],
              [lat, east],
            ],
            minorStyle
          ).addTo(layer);
        }
      }

      for (const ln of computed.majorLonLines) {
        L.polyline(
          [
            [south, ln.lon],
            [north, ln.lon],
          ],
          majorStyle
        ).addTo(layer);

        if (showLabels) {
          const icon = L.divIcon({
            className: '',
            html: `<div style="transform:translate(-50%,0); padding:1px 6px; background:rgba(255,255,255,0.92); color:#0f172a; font-weight:900; font-size:11px;">${ln.label}</div>`,
          });
          L.marker([north - latPad, ln.lon], { icon, interactive: false, zIndexOffset: 1000 }).addTo(layer);
        }
      }

      for (const lt of computed.majorLatLines) {
        L.polyline(
          [
            [lt.lat, west],
            [lt.lat, east],
          ],
          majorStyle
        ).addTo(layer);

        if (showLabels) {
          const icon = L.divIcon({
            className: '',
            html: `<div style="transform:translate(0,-50%); padding:1px 6px; background:rgba(255,255,255,0.92); color:#0f172a; font-weight:900; font-size:11px;">${lt.label}</div>`,
          });
          L.marker([lt.lat, west + lonPad], { icon, interactive: false, zIndexOffset: 1000 }).addTo(layer);
        }
      }
    };

    draw();
    map.on('moveend', draw);
    map.on('zoomend', draw);
    return () => {
      map.off('moveend', draw);
      map.off('zoomend', draw);
    };
  }, [grid, map]);

  return null;
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
      baseMap = 'osm',
      initialCenter = null,
      onCenterChange,
      mapDownload,
      onMapTap,
      placingCheckpoint = false,
      onPlaceCheckpointAt,
      onSelectCheckpoint,
    },
    ref
  ) => {
    useLeafletCss();

    const placingCheckpointRef = useRef(placingCheckpoint);
    const onPlaceCheckpointAtRef = useRef(onPlaceCheckpointAt);
    const onSelectCheckpointRef = useRef(onSelectCheckpoint);

    placingCheckpointRef.current = placingCheckpoint;
    onPlaceCheckpointAtRef.current = onPlaceCheckpointAt;
    onSelectCheckpointRef.current = onSelectCheckpoint;

    const mapRef = useRef<any | null>(null);
    const centerRef = useRef<LatLng>(initialCenter ?? DEFAULT_CENTER);
    const didInitialCenterOverrideRef = useRef(false);
    const onCenterChangeRef = useRef<typeof onCenterChange>(onCenterChange);

    onCenterChangeRef.current = onCenterChange;

    useImperativeHandle(
      ref,
      () => ({
        centerOn: (coordinate, options) => {
          const map = mapRef.current;
          if (!map) return;
          const zoom = typeof options?.zoom === 'number' ? options.zoom : map.getZoom();
          map.setView(toLeafletLatLng(coordinate), zoom, { animate: options?.animated ?? true });
        },
        getCenter: () => centerRef.current ?? null,
      }),
      []
    );

    useEffect(() => {
      if (didInitialCenterOverrideRef.current) return;
      if (!userLocation) return;
      const map = mapRef.current;
      if (!map?.setView) return;

      const current = centerRef.current;
      const isStillDefault =
        Math.abs(current.latitude - DEFAULT_CENTER.latitude) < 0.0005 &&
        Math.abs(current.longitude - DEFAULT_CENTER.longitude) < 0.0005;

      if (!isStillDefault) return;

      try {
        map.setView(toLeafletLatLng(userLocation), map.getZoom?.() ?? DEFAULT_ZOOM, { animate: false });
        centerRef.current = userLocation;
        onCenterChangeRef.current?.(userLocation);
        didInitialCenterOverrideRef.current = true;
      } catch {
        // Ignore; map may not be ready yet.
      }
    }, [userLocation]);

    const locationIcon = useMemo(() => makeLocationIcon(userHeadingDeg), [userHeadingDeg]);

    const markerGroups = useMemo(() => {
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
    }, [checkpoints, selectedCheckpointId]);

    const connectionPositions = useMemo(() => {
      if (checkpoints.length < 2) return null;

      const seen = new Set<string>();
      const points: [number, number][] = [];

      for (const cp of checkpoints) {
        const key = coordKey(cp.coordinate);
        if (seen.has(key)) continue;
        seen.add(key);
        points.push(toLeafletLatLng(cp.coordinate));
      }

      return points.length >= 2 ? points : null;
    }, [checkpoints]);

    const downloadPolygon = useMemo(() => {
      if (!mapDownload?.active) return null;
      if (!mapDownload.firstCorner || !mapDownload.secondCorner) return null;

      const latMin = Math.min(mapDownload.firstCorner.latitude, mapDownload.secondCorner.latitude);
      const latMax = Math.max(mapDownload.firstCorner.latitude, mapDownload.secondCorner.latitude);
      const lonMin = Math.min(mapDownload.firstCorner.longitude, mapDownload.secondCorner.longitude);
      const lonMax = Math.max(mapDownload.firstCorner.longitude, mapDownload.secondCorner.longitude);

      const tl: [number, number] = [latMax, lonMin];
      const tr: [number, number] = [latMax, lonMax];
      const br: [number, number] = [latMin, lonMax];
      const bl: [number, number] = [latMin, lonMin];
      return [tl, tr, br, bl] as [number, number][];
    }, [mapDownload?.active, mapDownload?.firstCorner, mapDownload?.secondCorner]);

    const showBaseLayer = offlineMapMode !== 'offline';

    return (
      <View style={styles.root}>
        <MapContainer
          center={toLeafletLatLng(initialCenter ?? DEFAULT_CENTER)}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          {showBaseLayer && (
            <TileLayer
              url={
                baseMap === 'esriWorldImagery'
                  ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
              }
              attribution={
                baseMap === 'esriWorldImagery'
                  ? 'Tiles &copy; Esri'
                  : '&copy; OpenStreetMap contributors'
              }
            />
          )}

          <MapBridge
            onMap={(map) => {
              mapRef.current = map;
            }}
            onCenter={(center) => {
              centerRef.current = center;
              onCenterChangeRef.current?.(center);
            }}
            onMapTap={onMapTap ?? null}
            placingCheckpoint={placingCheckpoint}
            onPlaceCheckpointAt={onPlaceCheckpointAt ?? null}
          />

          <GridOverlay grid={grid} />

          {downloadPolygon && (
            <Polygon
              positions={downloadPolygon}
              pathOptions={{ color: '#16a34a', weight: 2, opacity: 0.95, fillColor: '#16a34a', fillOpacity: 0.18 }}
            />
          )}

          {userLocation && (
            <Marker position={toLeafletLatLng(userLocation)} icon={locationIcon} />
          )}

          {connectionPositions && (
            <Polyline positions={connectionPositions} pathOptions={{ color: '#0f172a', weight: 2, opacity: 0.9 }} />
          )}

          {markerGroups.map((g) => {
            const icon = makeFlagIcon(g.selected);
            return (
              <Marker
                key={coordKey(g.coordinate)}
                position={toLeafletLatLng(g.coordinate)}
                icon={icon}
                eventHandlers={{
                  click: (e: any) => {
                    try {
                      if (e?.originalEvent) {
                        L.DomEvent.stopPropagation(e.originalEvent);
                      }
                    } catch {
                      // ignore
                    }
                    if (placingCheckpointRef.current) {
                      const handler = onPlaceCheckpointAtRef.current;
                      if (handler) handler(g.coordinate);
                      return;
                    }

                    onSelectCheckpointRef.current(g.representative.id);
                  },
                }}
              />
            );
          })}

          {/* Simple accuracy halo when available later (kept as placeholder).
              Leaving CircleMarker import here makes it easy to enable. */}
          {false && userLocation && (
            <CircleMarker center={toLeafletLatLng(userLocation)} radius={10} />
          )}
        </MapContainer>
      </View>
    );
  }
);

export default MapCanvas;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f8fafc',
  },
});
