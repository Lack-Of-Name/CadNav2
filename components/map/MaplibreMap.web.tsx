import { alert as showAlert } from '@/components/alert';
import { CompassOverlay } from '@/components/map/CompassOverlay';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { CompassButton, bearingDegrees, haversineMeters, InfoBox, normalizeDegrees, RecenterButton, sleep } from './MaplibreMap.general';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { degreesToMils } from './converter';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ThemedView } from '../themed-view';
import { buildMapGridGeoJSON, buildMapGridNumbersGeoJSON, buildMapGridSubdivisionsGeoJSON } from './mapGrid';

const GRID_LINE_COLOR = '#111111';

export default function MapLibreMap() {
  const { apiKey, loading } = useMapTilerKey();
  const [webLastLocation, setWebLastLocation] = useState<any | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const lastLocationRef = useRef<typeof lastLocation | null>(null);
  const lastLocationLossTimer = useRef<number | null>(null);
  const errorReportedRef = useRef(false);
  const { lastLocation, requestLocation } = useGPS();
  const { angleUnit, mapHeading, mapGridEnabled, mapGridSubdivisionsEnabled, mapGridNumbersEnabled, mapGridOrigin } = useSettings();
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
  const colorScheme = useColorScheme() ?? 'light';
  const iconColor = useThemeColor({}, 'tabIconDefault');
  const tabIconSelected = useThemeColor({}, 'tabIconSelected');
  const tint = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const background = useThemeColor({}, 'background');
  const [following, setFollowing] = useState(false);
  const buttonIconColor = following ? tabIconSelected : (colorScheme === 'light' ? tint : iconColor);
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [orientation, setOrientation] = useState<number | null>(null);
  const [mapBearing, setMapBearing] = useState<number>(0);
  const [compassOpen, setCompassOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const compassButtonColor = compassOpen ? tabIconSelected : (colorScheme === 'light' ? tint : iconColor);
  const initialZoomDone = useRef(false);
  
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

  const effectiveLastLocation = lastLocation ?? webLastLocation;
  // Use shared CompassOverlay component for web as well
  const compassHeadingDeg = (() => {
    if (!effectiveLastLocation) return null;
    const useMag = mapHeading !== 'true';
    const h = useMag ? effectiveLastLocation.coords.magHeading : effectiveLastLocation.coords.trueHeading;
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
    effectiveLastLocation && selectedCheckpoint
      ? bearingDegrees(
          effectiveLastLocation.coords.latitude,
          effectiveLastLocation.coords.longitude,
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
    effectiveLastLocation && selectedCheckpoint
      ? (() => {
          const meters = haversineMeters(
            effectiveLastLocation.coords.latitude,
            effectiveLastLocation.coords.longitude,
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

  const checkpointSourceId = 'checkpoints-source';
  const checkpointOuterLayerId = 'checkpoints-outer';
  const checkpointInnerLayerId = 'checkpoints-inner';
  const checkpointDotLayerId = 'checkpoints-dot';
  const checkpointLabelLayerId = 'checkpoints-label';
  const routeLineSourceId = 'route-line-source';
  const routeLineLayerId = 'route-line-layer';

  function LocationMarker({ x, y, orientation }: { x: number; y: number; orientation: number | null }) {
    return (
      <div style={{ position: 'absolute', left: x - 12, top: y - 12, pointerEvents: 'none', zIndex: 20 }}>
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

  useEffect(() => {
    if (loading || !apiKey) return;
    if (map.current) return; // stops map from initializing more than once
    if (!mapDiv.current) return;

    const mapStyle = `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${apiKey}`;

    map.current = new maplibregl.Map({
      container: mapDiv.current,
      style: mapStyle,
      center: [0, 0],
      zoom: 1,
    });

    const update = () => {
      if (!map.current) return;
      try {
        const bearing = typeof map.current.getBearing === 'function' ? map.current.getBearing() : 0;
        setMapBearing(bearing);

        const ll = lastLocationRef.current;
        if (ll) {
          const p = map.current.project([ll.coords.longitude, ll.coords.latitude]);
          setScreenPos({ x: p.x, y: p.y });
        }
      } catch (err) {
        if (!errorReportedRef.current) {
          errorReportedRef.current = true;
          void showAlert({ title: 'MapLibreMap', message: String(err) });
        }
      }
    };

    map.current.on('load', () => {
      update();
      setMapReady(true);
    });
    map.current.on('move', update);
    map.current.on('zoom', update);
    setTimeout(update, 0);

    // Lock map orientation to north-up
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

  useEffect(() => {
    if (!map.current || !mapReady) return;

    const stopFollowing = () => setFollowing(false);
    const m = map.current;
    m.on('dragstart', stopFollowing);
    m.on('zoomstart', stopFollowing);
    m.on('mousedown', stopFollowing);
    m.on('touchstart', stopFollowing);

    return () => {
      if (!map.current) return;
      m.off('dragstart', stopFollowing);
      m.off('zoomstart', stopFollowing);
      m.off('mousedown', stopFollowing);
      m.off('touchstart', stopFollowing);
    };
  }, [mapReady]);

  // Map grid overlay (GeoJSON source + line layer)
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const majorSourceId = 'map-grid-source';
    const majorLayerId = 'map-grid-layer';
    const minorSourceId = 'map-grid-minor-source';
    const minorLayerId = 'map-grid-minor-layer';
    const labelSourceId = 'map-grid-labels-source';
    const labelLayerId = 'map-grid-labels-layer';

    const ensureAdded = () => {
      if (!m) return;
      if (!mapGridEnabled) return;
      if (!m.getSource(majorSourceId)) {
        m.addSource(majorSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        } as any);
      }
        if (!m.getLayer(majorLayerId)) {
        m.addLayer({
          id: majorLayerId,
          type: 'line',
          source: majorSourceId,
          paint: {
            'line-color': GRID_LINE_COLOR,
            'line-opacity': 0.55,
            'line-width': 2,
          },
        } as any);
      } else {
        try {
          m.setPaintProperty(majorLayerId, 'line-color', GRID_LINE_COLOR);
        } catch {
          // ignore
        }
      }

      if (!m.getSource(minorSourceId)) {
        m.addSource(minorSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        } as any);
      }
      if (!m.getLayer(minorLayerId)) {
        m.addLayer({
          id: minorLayerId,
          type: 'line',
          source: minorSourceId,
          paint: {
            'line-color': GRID_LINE_COLOR,
            'line-opacity': 0.12,
            'line-width': 1.5,
          },
        } as any);
      } else {
        try {
          m.setPaintProperty(minorLayerId, 'line-color', GRID_LINE_COLOR);
        } catch {
          // ignore
        }
      }

      if (!m.getSource(labelSourceId)) {
        m.addSource(labelSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        } as any);
      }
      if (!m.getLayer(labelLayerId)) {
        m.addLayer({
          id: labelLayerId,
          type: 'symbol',
          source: labelSourceId,
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 12,
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': GRID_LINE_COLOR,
            'text-halo-color': 'rgba(255,255,255,0.85)',
            'text-halo-width': 1,
          },
        } as any);
      }
    };

    const updateGrid = () => {
      if (!m) return;
      if (!mapGridEnabled) return;
      const majorSrc = m.getSource(majorSourceId) as any;
      const minorSrc = m.getSource(minorSourceId) as any;
      const labelSrc = m.getSource(labelSourceId) as any;
      if (!majorSrc || !minorSrc || !labelSrc) return;

      const safeSet = (src: any, data: any) => {
        try {
          src.setData(data as any);
        } catch {
          // ignore
        }
      };

      const b = m.getBounds();
      const west = b.getWest();
      const south = b.getSouth();
      const east = b.getEast();
      const north = b.getNorth();
      const z = typeof m.getZoom === 'function' ? m.getZoom() : 1;
      const origin = mapGridOrigin ? { latitude: mapGridOrigin.latitude, longitude: mapGridOrigin.longitude } : null;

      // Only show grid at zoom >= 15
      if (typeof z !== 'number' || z < 12) {
        const empty = { type: 'FeatureCollection', features: [] } as any;
        safeSet(majorSrc, empty);
        safeSet(minorSrc, empty);
        safeSet(labelSrc, empty);
        return;
      }

      const geo = buildMapGridGeoJSON({ west, south, east, north }, z, origin);
      const minorGeo = mapGridSubdivisionsEnabled ? buildMapGridSubdivisionsGeoJSON({ west, south, east, north }, z, origin) : { type: 'FeatureCollection', features: [] };
      const labelGeo = mapGridNumbersEnabled ? buildMapGridNumbersGeoJSON({ west, south, east, north }, z, origin) : { type: 'FeatureCollection', features: [] };

      safeSet(majorSrc, geo);
      safeSet(minorSrc, minorGeo);
      safeSet(labelSrc, labelGeo);
    };

    const remove = () => {
      if (!m) return;
      try {
        if (m.getLayer(minorLayerId)) m.removeLayer(minorLayerId);
      } catch {
        // ignore
      }
      try {
        if (m.getLayer(majorLayerId)) m.removeLayer(majorLayerId);
      } catch {
        // ignore
      }

      try {
        if (m.getLayer(labelLayerId)) m.removeLayer(labelLayerId);
      } catch {
        // ignore
      }

      try {
        if (m.getSource(minorSourceId)) m.removeSource(minorSourceId);
      } catch {
        // ignore
      }

      try {
        if (m.getSource(labelSourceId)) m.removeSource(labelSourceId);
      } catch {
        // ignore
      }

      try {
        if (m.getSource(majorSourceId)) m.removeSource(majorSourceId);
      } catch {
        // ignore
      }
    };

    const onMove = () => updateGrid();

    const onLoad = () => {
      if (!m) return;
      if (!mapGridEnabled) {
        remove();
        return;
      }
      ensureAdded();
      updateGrid();
    };

    if (mapGridEnabled) {
      if (m.isStyleLoaded()) {
        ensureAdded();
        updateGrid();
      } else {
        m.once('load', onLoad);
      }
      // Update grid continuously while the map is moving/zooming so lines follow camera.
      m.on('move', onMove);
      m.on('zoom', onMove);
      m.on('movestart', onMove);
      m.on('zoomstart', onMove);
    } else {
      remove();
    }

    return () => {
      try {
        m.off('move', onMove);
        m.off('zoom', onMove);
        m.off('movestart', onMove);
        m.off('zoomstart', onMove);
      } catch {
        // ignore
      }
    };
  }, [mapGridEnabled, mapGridSubdivisionsEnabled, mapGridNumbersEnabled, mapGridOrigin]);

  // keep a ref copy of lastLocation so event handlers see latest value
  useEffect(() => {
    lastLocationRef.current = effectiveLastLocation;
  }, [effectiveLastLocation]);

  // Try a lightweight web-only fallback to seed location quickly when `useGPS` is not returning
  // a value on some desktop browsers. This will not replace the hook but helps UI appear.
  useEffect(() => {
    if (effectiveLastLocation) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    let mounted = true;
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mounted) return;
          setWebLastLocation({
            coords: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy ?? null,
              altitude: pos.coords.altitude ?? null,
              magHeading: null,
              trueHeading: null,
            },
            timestamp: pos.timestamp ?? Date.now(),
          });
        },
        () => {
          /* ignore */
        },
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8000 }
      );
    } catch {
      // ignore
    }
    return () => {
      mounted = false;
    };
  }, [effectiveLastLocation]);

  useEffect(() => {
    if (effectiveLastLocation && !initialZoomDone.current && map.current && mapReady) {
      initialZoomDone.current = true;
      const { latitude, longitude } = effectiveLastLocation.coords;
      map.current.flyTo({ center: [longitude, latitude], zoom: 12 });
      setFollowing(true);
    }
  }, [effectiveLastLocation, mapReady]);

  useEffect(() => {
    // If lastLocation (or web fallback) is present, cancel any pending clear and update immediately
    if (effectiveLastLocation) {
      if (lastLocationLossTimer.current) {
        window.clearTimeout(lastLocationLossTimer.current);
        lastLocationLossTimer.current = null;
      }
      if (!map.current) return;
      try {
        const p = map.current.project([effectiveLastLocation.coords.longitude, effectiveLastLocation.coords.latitude]);
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
  }, [effectiveLastLocation]);

  useEffect(() => {
    if (!following || !effectiveLastLocation || !map.current) return;
    const { latitude, longitude } = effectiveLastLocation.coords;
    try {
      map.current.flyTo({ center: [longitude, latitude] });
    } catch (err) {
      if (!errorReportedRef.current) {
        errorReportedRef.current = true;
        void showAlert({ title: 'MapLibreMap', message: String(err) });
      }
      // ignore
    }
  }, [effectiveLastLocation, following]);

  useEffect(() => {
    if (!map.current || !mapReady) return;

    const m = map.current;
    const features = checkpoints.map((cp) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [cp.longitude, cp.latitude],
      },
      properties: {
        id: cp.id,
        label: cp.label ?? '',
        selected: cp.id === selectedId,
        color: cp.color ?? activeRouteColor ?? null,
      },
    }));

    const data = {
      type: 'FeatureCollection',
      features,
    } as GeoJSON.FeatureCollection;

    if (!m.getSource(checkpointSourceId)) {
      m.addSource(checkpointSourceId, {
        type: 'geojson',
        data,
      });

      m.addLayer({
        id: checkpointOuterLayerId,
        type: 'circle',
        source: checkpointSourceId,
        paint: {
          'circle-radius': 10,
          'circle-color': [
            'case',
            ['boolean', ['get', 'selected'], false],
            String(tabIconSelected),
            String(tint),
          ],
          'circle-opacity': 0.95,
          'circle-pitch-alignment': 'map',
        },
      });

      m.addLayer({
        id: checkpointInnerLayerId,
        type: 'circle',
        source: checkpointSourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': colorScheme === 'dark' ? 'rgba(16,18,20,0.96)' : 'rgba(255,255,255,0.98)',
          'circle-stroke-width': 1,
          'circle-stroke-color': colorScheme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)',
          'circle-pitch-alignment': 'map',
        },
      });

      m.addLayer({
        id: checkpointDotLayerId,
        type: 'circle',
        source: checkpointSourceId,
        paint: {
          'circle-radius': 2.5,
          'circle-color': ['coalesce', ['get', 'color'], String(tint)],
          'circle-pitch-alignment': 'map',
        },
      });

      m.addLayer({
        id: checkpointLabelLayerId,
        type: 'symbol',
        source: checkpointSourceId,
        layout: {
          'text-field': ['coalesce', ['get', 'label'], ''],
          'text-size': 12,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': String(textColor),
          'text-halo-color': colorScheme === 'dark' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
          'text-halo-width': 1,
        },
      });
    } else {
      const source = m.getSource(checkpointSourceId) as maplibregl.GeoJSONSource;
      source.setData(data as any);
      m.setPaintProperty(checkpointOuterLayerId, 'circle-color', [
        'case',
        ['boolean', ['get', 'selected'], false],
        String(tabIconSelected),
        String(tint),
      ]);
      m.setPaintProperty(checkpointDotLayerId, 'circle-color', ['coalesce', ['get', 'color'], String(tint)]);
      m.setPaintProperty(checkpointInnerLayerId, 'circle-color', colorScheme === 'dark' ? 'rgba(16,18,20,0.96)' : 'rgba(255,255,255,0.98)');
      m.setPaintProperty(checkpointInnerLayerId, 'circle-stroke-color', colorScheme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)');
      m.setPaintProperty(checkpointLabelLayerId, 'text-color', String(textColor));
      m.setPaintProperty(checkpointLabelLayerId, 'text-halo-color', colorScheme === 'dark' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)');
    }

    if (activeRouteColor && (checkpoints.length > 1 || (activeRouteStart && checkpoints.length > 0))) {
      const lineCoords = checkpoints.map((cp) => [cp.longitude, cp.latitude]);
      if (activeRouteStart) {
        lineCoords.unshift([activeRouteStart.longitude, activeRouteStart.latitude]);
      }
      if (activeRouteLoop && lineCoords.length > 1) {
        lineCoords.push(lineCoords[0]);
      }
      if (lineCoords.length < 2) return;
      const lineData = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: lineCoords,
            },
            properties: {},
          },
        ],
      } as GeoJSON.FeatureCollection;

      if (!m.getSource(routeLineSourceId)) {
        m.addSource(routeLineSourceId, {
          type: 'geojson',
          data: lineData,
        });
        m.addLayer({
          id: routeLineLayerId,
          type: 'line',
          source: routeLineSourceId,
          paint: {
            'line-color': String(activeRouteColor),
            'line-width': 3,
            'line-opacity': 0.75,
          },
        });
      } else {
        const source = m.getSource(routeLineSourceId) as maplibregl.GeoJSONSource;
        source.setData(lineData as any);
        m.setPaintProperty(routeLineLayerId, 'line-color', String(activeRouteColor));
      }
    } else if (m.getSource(routeLineSourceId)) {
      m.removeLayer(routeLineLayerId);
      m.removeSource(routeLineSourceId);
    }
  }, [checkpoints, selectedId, mapReady, colorScheme, textColor, tint, tabIconSelected, activeRouteColor, activeRouteStart, activeRouteLoop]);

  useEffect(() => {
    if (!map.current || !mapReady) return;
    const m = map.current;

    const handleClick = async (e: maplibregl.MapMouseEvent) => {
      if (!m) return;

      if (placementModeRequested) {
        await addCheckpoint(e.lngLat.lat, e.lngLat.lng);
        await consumePlacementModeRequest();
        return;
      }

      const features = m.queryRenderedFeatures(e.point, { layers: [checkpointOuterLayerId, checkpointInnerLayerId, checkpointDotLayerId] });
      if (features && features.length > 0) {
        const id = features[0]?.properties?.id;
        if (typeof id === 'string') {
          if (selectedId === id) {
            await selectCheckpoint(null);
          } else {
            await selectCheckpoint(id);
          }
          return;
        }
      }

      if (selectedId) {
        await selectCheckpoint(null);
      }
    };

    m.on('click', handleClick);
    return () => {
      m.off('click', handleClick);
    };
  }, [mapReady, placementModeRequested, selectedId, addCheckpoint, selectCheckpoint, consumePlacementModeRequest]);

  // Compute the orientation (degrees) for the arrow based on device heading
  useEffect(() => {
    if (!effectiveLastLocation) {
      setOrientation(null);
      return;
    }
    const useMag = mapHeading === 'magnetic';
    const h = useMag ? effectiveLastLocation.coords.magHeading : effectiveLastLocation.coords.trueHeading;
    if (h == null) {
      setOrientation(null);
      return;
    }
    // Use the device heading directly (no inversion) and subtract map bearing
    const raw = h - mapBearing;
    const normalized = normalizeDegrees(raw);
    setOrientation(normalized);
  }, [effectiveLastLocation, mapBearing, mapHeading]);

  const handleRecenterPress = async () => {
    // Follow on single press. User interaction stops following.
    requestLocation();
    const loc = effectiveLastLocation;
    if (loc && map.current) {
      const { latitude, longitude } = loc.coords;
      try {
        map.current.flyTo({ center: [longitude, latitude], zoom: 16, duration: 1000, essential: true });
        await sleep(1000);
      } catch (err) {
        if (!errorReportedRef.current) {
          errorReportedRef.current = true;
          void showAlert({ title: 'MapLibreMap', message: String(err) });
        }
        // ignore
      }
    }
    setFollowing(true);
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
        <RecenterButton onPress={handleRecenterPress} style={overlayStyles.recenter(following)} color={buttonIconColor} renderAs="web" />
        <CompassButton onPress={() => setCompassOpen(true)} style={overlayStyles.floatingButton(12 + 58, compassOpen)} color={compassButtonColor} active={compassOpen} renderAs="web" />
        {placementModeRequested && (
          <View style={[styles.placementBannerWrap, { top: 60, left: 12, right: 12 }]}> 
            <View
              style={[
                styles.placementBanner,
                {
                  backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.95)',
                  borderColor: String(borderColor),
                },
              ]}
            >
              <Text style={[styles.placementBannerTitle, { color: textColor }]}>Placement mode</Text>
              <Text style={[styles.placementBannerText, { color: textColor }]}>Tap map to place checkpoint</Text>
              <TouchableOpacity onPress={() => consumePlacementModeRequest()} style={styles.placementBannerAction}>
                <Text style={[styles.placementBannerHint, { color: String(tint) }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
            zIndex: 70,
          }}
        />
        {screenPos && <LocationMarker x={screenPos.x} y={screenPos.y} orientation={orientation} />}
        <InfoBox lastLocation={effectiveLastLocation} mapHeading={mapHeading} angleUnit={angleUnit} containerStyle={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 6 }} textStyle={styles.locationText} renderAs="web" />
        {selectedCheckpoint && (
          <View
            style={[
              styles.checkpointActions,
              {
                right: 12,
                bottom: 12 + 58,
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
