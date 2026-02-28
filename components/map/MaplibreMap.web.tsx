import { alert as showAlert } from '@/components/alert';
import { CompassOverlay } from '@/components/map/CompassOverlay';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ThemedView } from '../themed-view';
import { bearingDegrees, CompassButton, HudButton, haversineMeters, InfoBox, normalizeDegrees, RecenterButton, sleep } from './MaplibreMap.general';
import { degreesToMils } from './converter';
import { computeGridCornersFromMapBounds, generateGridPoints } from './mapGrid';

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

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
  const { angleUnit, mapHeading, mapGridOrigin, mapGridEnabled, mapGridSubdivisionsEnabled, mapGridNumbersEnabled, gridConvergence } = useSettings();
  const { checkpoints, selectCheckpoint, selectedId, selectedCheckpoint, placementModeRequested, consumePlacementModeRequest, cancelPlacementMode, addCheckpoint, activeRouteColor, activeRouteStart, activeRouteLoop, viewTarget, consumeViewTarget } = useCheckpoints();
  const [placedCount, setPlacedCount] = useState(0);
  const colorScheme = useColorScheme() ?? 'light';
  const iconColor = useThemeColor({}, 'tabIconDefault');
  const tabIconSelected = useThemeColor({}, 'tabIconSelected');
  const tint = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const background = useThemeColor({}, 'background');
  const [following, setFollowing] = useState(false);
  const buttonIconColor = following ? tabIconSelected : (colorScheme === 'light' ? tint : iconColor);
  const [orientation, setOrientation] = useState<number | null>(null);
  const [mapBearing, setMapBearing] = useState<number>(0);
  const [compassOpen, setCompassOpen] = useState(false);
  const [hudMode, setHudMode] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [visibleBounds, setVisibleBounds] = useState<[[number, number], [number, number]] | null>(null);
  const compassButtonColor = compassOpen ? tabIconSelected : (colorScheme === 'light' ? tint : iconColor);
  const bannerAccent = activeRouteColor ?? (colorScheme === 'dark' ? '#0A84FF' : String(tint));
  const bannerAccentText = isLightColor(bannerAccent) ? '#000' : '#fff';
  const initialZoomDone = useRef(false);
  const checkpointMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  
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
    hudButton: (bottom: number, active: boolean) => ({
      position: 'absolute' as const,
      bottom,
      left: 12,
      padding: 10,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
      display: 'flex',
      cursor: 'pointer',
      backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)',
      border: `1.5px solid ${active ? bannerAccent : 'transparent'}`,
    }) as any,
  };

  const effectiveLastLocation = lastLocation ?? webLastLocation;
  const compassHeadingDeg = (() => {
    if (!effectiveLastLocation) return null;
    const useMag = mapHeading === 'magnetic';
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

  const compassTargetColor = selectedCheckpoint?.color || activeRouteColor;

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

  const emptyGeo = React.useMemo(() => ({ type: 'FeatureCollection', features: [] } as any), []);

  const buildRouteLineGeoJSON = React.useCallback(() => {
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
  }, [activeRouteColor, checkpoints, activeRouteStart, activeRouteLoop, emptyGeo]);

  const buildLocationMarkerGeoJSON = React.useCallback(() => {
    if (!effectiveLastLocation) return emptyGeo;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [effectiveLastLocation.coords.longitude, effectiveLastLocation.coords.latitude],
          },
          properties: {
            kind: 'locationMarker',
            orientation: orientation ?? 0,
            hasOrientation: orientation != null,
          },
        },
      ],
    } as any;
  }, [effectiveLastLocation, orientation, emptyGeo]);

  useEffect(() => {
    if (!map.current || !mapReady) return;
    const sourceId = 'location-marker-source';
    const data = buildLocationMarkerGeoJSON();

    const existingSource = map.current.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(data);
    } else {
      map.current.addSource(sourceId, { type: 'geojson', data });
    }

    const pulseLayerId = 'location-marker-pulse';
    if (!map.current.getLayer(pulseLayerId)) {
      map.current.addLayer({
        id: pulseLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 12,
          'circle-color': 'rgba(0,122,255,0.15)',
          'circle-stroke-width': 6,
          'circle-stroke-color': 'rgba(0,122,255,0.15)',
        },
      });
    }

    const bgLayerId = 'location-marker-bg';
    if (!map.current.getLayer(bgLayerId)) {
      map.current.addLayer({
        id: bgLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 12,
          'circle-color': '#007AFF',
        },
      });
    }

    const iconLayerId = 'location-marker-icon';
    if (!map.current.getLayer(iconLayerId)) {
      // We need to add images for the icons if they don't exist
      if (!map.current.hasImage('location-arrow')) {
        const arrowSvg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L19 21 L12 17 L5 21 Z" fill="white" /></svg>`;
        const arrowImg = new Image(24, 24);
        arrowImg.src = 'data:image/svg+xml;base64,' + btoa(arrowSvg);
        arrowImg.onload = () => {
          if (map.current && !map.current.hasImage('location-arrow')) {
            map.current.addImage('location-arrow', arrowImg);
          }
        };
      }
      if (!map.current.hasImage('location-dot')) {
        const dotSvg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5" fill="white" /></svg>`;
        const dotImg = new Image(24, 24);
        dotImg.src = 'data:image/svg+xml;base64,' + btoa(dotSvg);
        dotImg.onload = () => {
          if (map.current && !map.current.hasImage('location-dot')) {
            map.current.addImage('location-dot', dotImg);
          }
        };
      }

      map.current.addLayer({
        id: iconLayerId,
        type: 'symbol',
        source: sourceId,
        layout: {
          'icon-image': ['case', ['get', 'hasOrientation'], 'location-arrow', 'location-dot'],
          'icon-size': 1,
          'icon-rotate': ['get', 'orientation'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
    }
  }, [mapReady, buildLocationMarkerGeoJSON]);

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

        const z = typeof map.current.getZoom === 'function' ? map.current.getZoom() : 1;
        setZoomLevel(z);

        const bounds = map.current.getBounds();
        if (bounds) {
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          setVisibleBounds([[ne.lng, ne.lat], [sw.lng, sw.lat]]);
        }

        const ll = lastLocationRef.current;
        if (ll) {
          map.current.project([ll.coords.longitude, ll.coords.latitude]);
        }

        // grid computation moved to GridOverlay component
      } catch (err) {
        if (!errorReportedRef.current) {
          errorReportedRef.current = true;
          void showAlert({ title: 'MapLibreMap', message: String(err) });
        }
      }
    };

    const handleLoad = () => {
      update();
      setMapReady(true);
    };
    const handleUserInteraction = () => {
      setFollowing(false);
    };

    map.current.on('load', handleLoad);
    map.current.on('move', update);
    map.current.on('zoom', update);
    map.current.on('dragstart', handleUserInteraction);
    map.current.on('zoomstart', handleUserInteraction);
    map.current.on('rotatestart', handleUserInteraction);
    map.current.on('pitchstart', handleUserInteraction);
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
        map.current.off('load', handleLoad);
        map.current.off('move', update);
        map.current.off('zoom', update);
        map.current.off('dragstart', handleUserInteraction);
        map.current.off('zoomstart', handleUserInteraction);
        map.current.off('rotatestart', handleUserInteraction);
        map.current.off('pitchstart', handleUserInteraction);
        map.current.remove();
      }
      map.current = null;
    };
  }, [apiKey, loading]);

  useEffect(() => {
    if (!map.current || !mapReady) return;
    const sourceId = 'route-line-source';
    const layerId = 'route-line';
    const data = buildRouteLineGeoJSON();

    const existingSource = map.current.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(data);
    } else {
      map.current.addSource(sourceId, { type: 'geojson', data });
    }

    if (!map.current.getLayer(layerId)) {
      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': activeRouteColor ?? 'transparent',
          'line-opacity': activeRouteColor ? 0.75 : 0,
          'line-width': 3,
        },
      });
    } else {
      map.current.setPaintProperty(layerId, 'line-color', activeRouteColor ?? 'transparent');
      map.current.setPaintProperty(layerId, 'line-opacity', activeRouteColor ? 0.75 : 0);
    }
  }, [mapReady, checkpoints, activeRouteColor, activeRouteStart, activeRouteLoop, buildRouteLineGeoJSON]);

  const gridShape = React.useMemo(() => {
    if (!mapGridEnabled || zoomLevel < 12 || !visibleBounds) return emptyGeo;
    const originPt = mapGridOrigin ?? { latitude: -37.8136, longitude: 144.9631 };
    const sw = { latitude: visibleBounds[1][1], longitude: visibleBounds[1][0] };
    const ne = { latitude: visibleBounds[0][1], longitude: visibleBounds[0][0] };

    const gridOffsets = computeGridCornersFromMapBounds(originPt, sw, ne, 1000, gridConvergence ?? 0);
    const intersections = generateGridPoints(originPt, gridOffsets.offsets, 1000, gridConvergence ?? 0);

    const es = Array.from(new Set(intersections.map((p) => p.e))).sort((a, b) => a - b);
    const ns = Array.from(new Set(intersections.map((p) => p.n))).sort((a, b) => a - b);

    const key = (e: number, n: number) => `${e}:${n}`;
    const ptMap = new Map<string, { latitude: number; longitude: number; e: number; n: number }>();
    for (const p of intersections) ptMap.set(key(p.e, p.n), p);

    const features: any[] = [];

    // Main grid lines
    for (const e of es) {
      const coords = ns.map((n) => {
        const p = ptMap.get(key(e, n));
        return p ? [p.longitude, p.latitude] : null;
      }).filter(Boolean);
      if (coords.length > 1) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { kind: 'gridLine' },
        });
      }
    }

    for (const n of ns) {
      const coords = es.map((e) => {
        const p = ptMap.get(key(e, n));
        return p ? [p.longitude, p.latitude] : null;
      }).filter(Boolean);
      if (coords.length > 1) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { kind: 'gridLine' },
        });
      }
    }

    // Subdivisions
    if (mapGridSubdivisionsEnabled && es.length >= 2 && ns.length >= 2) {
      const parts = 10;
      for (let i = 0; i < es.length - 1; i++) {
        const eA = es[i];
        const eB = es[i + 1];
        for (let k = 1; k < parts; k++) {
          const t = k / parts;
          const coords: any[] = [];
          for (const n of ns) {
            const a = ptMap.get(key(eA, n));
            const b = ptMap.get(key(eB, n));
            if (!a || !b) continue;
            const lon = a.longitude + (b.longitude - a.longitude) * t;
            const lat = a.latitude + (b.latitude - a.latitude) * t;
            coords.push([lon, lat]);
          }
          if (coords.length > 1) {
            features.push({
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: coords },
              properties: { kind: 'gridSubLine' },
            });
          }
        }
      }

      for (let j = 0; j < ns.length - 1; j++) {
        const nA = ns[j];
        const nB = ns[j + 1];
        for (let k = 1; k < parts; k++) {
          const t = k / parts;
          const coords: any[] = [];
          for (const e of es) {
            const a = ptMap.get(key(e, nA));
            const b = ptMap.get(key(e, nB));
            if (!a || !b) continue;
            const lon = a.longitude + (b.longitude - a.longitude) * t;
            const lat = a.latitude + (b.latitude - a.latitude) * t;
            coords.push([lon, lat]);
          }
          if (coords.length > 1) {
            features.push({
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: coords },
              properties: { kind: 'gridSubLine' },
            });
          }
        }
      }
    }

    // Grid numbers
    if (mapGridNumbersEnabled && es.length >= 2 && ns.length >= 2) {
      for (let i = 0; i < es.length - 1; i++) {
        for (let j = 0; j < ns.length - 1; j++) {
          const e0 = es[i];
          const n0 = ns[j];
          const e1 = es[i + 1];
          const n1 = ns[j + 1];
          const p00 = ptMap.get(key(e0, n0));
          const p10 = ptMap.get(key(e1, n0));
          const p01 = ptMap.get(key(e0, n1));
          const p11 = ptMap.get(key(e1, n1));
          if (p00 && p10 && p01 && p11) {
            const centerLon = (p00.longitude + p10.longitude + p01.longitude + p11.longitude) / 4;
            const centerLat = (p00.latitude + p10.latitude + p01.latitude + p11.latitude) / 4;
            const eStr = (e0 < 0 ? '-' : '') + Math.floor(Math.abs(e0) / 1000).toString().padStart(2, '0').slice(-2);
            const nStr = (n0 < 0 ? '-' : '') + Math.floor(Math.abs(n0) / 1000).toString().padStart(2, '0').slice(-2);
            features.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [centerLon, centerLat] },
              properties: { kind: 'gridNumber', label: `${eStr} ${nStr}` },
            });
          }
        }
      }
    }

    return { type: 'FeatureCollection', features };
  }, [mapGridEnabled, zoomLevel, visibleBounds, mapGridOrigin, gridConvergence, mapGridSubdivisionsEnabled, mapGridNumbersEnabled, emptyGeo]);

  const gridOriginShape = React.useMemo(() => {
    if (!mapGridEnabled || !mapGridOrigin) return emptyGeo;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [mapGridOrigin.longitude, mapGridOrigin.latitude] },
          properties: { kind: 'gridOrigin' },
        },
      ],
    };
  }, [mapGridEnabled, mapGridOrigin, emptyGeo]);

  useEffect(() => {
    if (!map.current || !mapReady) return;
    const sourceId = 'grid-source';
    const data = gridShape;

    const existingSource = map.current.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(data);
    } else {
      map.current.addSource(sourceId, { type: 'geojson', data });
    }

    const sublinesLayerId = 'grid-sublines';
    if (!map.current.getLayer(sublinesLayerId)) {
      map.current.addLayer({
        id: sublinesLayerId,
        type: 'line',
        source: sourceId,
        filter: ['==', 'kind', 'gridSubLine'],
        paint: {
          'line-color': 'rgba(0,0,0,0.3)',
          'line-width': 1,
        },
      });
    } else {
      map.current.setPaintProperty(sublinesLayerId, 'line-color', 'rgba(0,0,0,0.3)');
    }

    const linesLayerId = 'grid-lines';
    if (!map.current.getLayer(linesLayerId)) {
      map.current.addLayer({
        id: linesLayerId,
        type: 'line',
        source: sourceId,
        filter: ['==', 'kind', 'gridLine'],
        paint: {
          'line-color': 'rgba(0,0,0,0.8)',
          'line-width': 1.5,
        },
      });
    } else {
      map.current.setPaintProperty(linesLayerId, 'line-color', 'rgba(0,0,0,0.8)');
    }

    const numbersLayerId = 'grid-numbers';
    if (!map.current.getLayer(numbersLayerId)) {
      map.current.addLayer({
        id: numbersLayerId,
        type: 'symbol',
        source: sourceId,
        filter: ['==', 'kind', 'gridNumber'],
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 14,
        },
        paint: {
          'text-color': 'rgba(0,0,0,1)',
          'text-halo-color': 'rgba(255, 255, 255, 0.8)',
          'text-halo-width': 2,
        },
      });
    } else {
      map.current.setPaintProperty(numbersLayerId, 'text-color', 'rgba(0,0,0,1)');
      map.current.setPaintProperty(numbersLayerId, 'text-halo-color', 'rgba(255, 255, 255, 0.8)');
      map.current.setPaintProperty(numbersLayerId, 'text-halo-width', 2);
    }
  }, [mapReady, gridShape]);

  useEffect(() => {
    if (!map.current || !mapReady) return;
    const sourceId = 'grid-origin-source';
    const data = gridOriginShape;

    const existingSource = map.current.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(data);
    } else {
      map.current.addSource(sourceId, { type: 'geojson', data });
    }

    const circleLayerId = 'grid-origin-circle';
    if (!map.current.getLayer(circleLayerId)) {
      map.current.addLayer({
        id: circleLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': 'transparent',
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(0,0,0,0.8)',
        },
      });
    } else {
      map.current.setPaintProperty(circleLayerId, 'circle-stroke-color', 'rgba(0,0,0,0.8)');
    }

    const dotLayerId = 'grid-origin-dot';
    if (!map.current.getLayer(dotLayerId)) {
      map.current.addLayer({
        id: dotLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 2,
          'circle-color': 'rgba(0,0,0,0.8)',
        },
      });
    } else {
      map.current.setPaintProperty(dotLayerId, 'circle-color', 'rgba(0,0,0,0.8)');
    }
  }, [mapReady, gridOriginShape]);

  useEffect(() => {
    if (!map.current || !mapReady) return;
    const handleClick = async (ev: maplibregl.MapMouseEvent) => {
      if (!placementModeRequested) return;
      const { lng, lat } = ev.lngLat;
      await addCheckpoint(lat, lng);
      setPlacedCount(c => c + 1);
      // Stay in placement mode for continuous placement
      await consumePlacementModeRequest();
    };
    map.current.on('click', handleClick);
    return () => {
      map.current?.off('click', handleClick);
    };
  }, [mapReady, placementModeRequested, addCheckpoint, consumePlacementModeRequest]);

  useEffect(() => {
    if (!map.current || !mapReady) return;
    const markers = checkpointMarkersRef.current;

    markers.forEach((marker) => marker.remove());
    markers.clear();

    checkpoints.forEach((cp) => {
      const selected = selectedId === cp.id;
      const dotColor = cp.color ?? activeRouteColor ?? String(tint);

      const root = document.createElement('div');
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
      root.style.alignItems = 'center';
      root.style.cursor = 'pointer';

      const outer = document.createElement('div');
      outer.style.width = '28px';
      outer.style.height = '28px';
      outer.style.borderRadius = '14px';
      outer.style.background = '#000000';
      outer.style.border = '2px solid #FFFFFF';
      outer.style.boxShadow = '0 2px 6px rgba(0,0,0,0.35)';
      outer.style.boxSizing = 'border-box';
      outer.style.display = 'flex';
      outer.style.alignItems = 'center';
      outer.style.justifyContent = 'center';

      const inner = document.createElement('div');
      inner.style.width = '20px';
      inner.style.height = '20px';
      inner.style.borderRadius = '10px';
      inner.style.display = 'flex';
      inner.style.alignItems = 'center';
      inner.style.justifyContent = 'center';

      const dot = document.createElement('div');
      dot.style.width = '8px';
      dot.style.height = '8px';
      dot.style.borderRadius = '4px';
      dot.style.background = String(dotColor);

      inner.appendChild(dot);
      outer.appendChild(inner);
      root.appendChild(outer);

      if (cp.label) {
        const label = document.createElement('div');
        label.textContent = cp.label;
        label.style.marginTop = '6px';
        label.style.padding = '4px 8px';
        label.style.borderRadius = '8px';
        label.style.background = String(background);
        label.style.color = String(textColor);
        label.style.fontSize = '11px';
        label.style.fontWeight = '600';
        label.style.border = `1px solid ${selected ? String(tint) : String(borderColor)}`;
        label.style.whiteSpace = 'nowrap';
        root.appendChild(label);
      }

      root.addEventListener('click', () => {
        if (selected) {
          void selectCheckpoint(null);
        } else {
          void selectCheckpoint(cp.id);
        }
      });

      const marker = new maplibregl.Marker({ element: root, anchor: 'center' })
        .setLngLat([cp.longitude, cp.latitude])
        .addTo(map.current!);

      markers.set(cp.id, marker);
    });

    return () => {
      markers.forEach((marker) => marker.remove());
      markers.clear();
    };
  }, [mapReady, checkpoints, selectedId, tint, tabIconSelected, textColor, borderColor, background, selectCheckpoint, activeRouteColor, colorScheme]);

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
      return;
    }

    // lastLocation became unavailable
    if (lastLocationLossTimer.current) {
      window.clearTimeout(lastLocationLossTimer.current);
    }
    lastLocationLossTimer.current = window.setTimeout(() => {
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

  // Consume viewTarget from routes screen
  useEffect(() => {
    if (!viewTarget || !map.current || !mapReady) return;
    const fly = async () => {
      const target = await consumeViewTarget();
      if (!target) return;
      try {
        map.current!.flyTo({ center: [target.longitude, target.latitude], zoom: target.zoom ?? 14, duration: 1000 });
        setFollowing(false);
      } catch {
        // ignore
      }
    };
    void fly();
  }, [viewTarget, mapReady, consumeViewTarget]);

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
    // Always re-center and enable following. Following stops on user map interaction.
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
        <div ref={mapDiv} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 0, display: hudMode ? 'none' : 'block' }} />
        {hudMode && (
          <div style={{
            position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 10,
            backgroundColor: '#000', color: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 20
          }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              {checkpoints.length > 1 && (
                <button 
                  onClick={() => {
                    const idx = selectedIndex >= 0 ? selectedIndex : 0;
                    const prev = (idx - 1 + checkpoints.length) % checkpoints.length;
                    void selectCheckpoint(checkpoints[prev].id);
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 24, cursor: 'pointer', padding: '10px 20px' }}
                >
                  ◀
                </button>
              )}
              <Text style={{ fontSize: 24, fontWeight: '600', color: '#888', marginHorizontal: 10 }}>
                {compassTargetLabel || 'No Target Selected'}
              </Text>
              {checkpoints.length > 1 && (
                <button 
                  onClick={() => {
                    const idx = selectedIndex >= 0 ? selectedIndex : 0;
                    const next = (idx + 1) % checkpoints.length;
                    void selectCheckpoint(checkpoints[next].id);
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 24, cursor: 'pointer', padding: '10px 20px' }}
                >
                  ▶
                </button>
              )}
            </div>
            
            {compassTargetLabel && compassTargetBearingDeg !== null ? (
              <>
                <Text style={{ fontSize: 18, fontWeight: '500', color: '#aaa', marginBottom: 4 }}>TARGET BEARING</Text>
                <Text style={{ fontSize: 72, fontWeight: 'bold', color: String(bannerAccent), marginBottom: 12 }}>
                  {compassBearingText}
                </Text>

                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#888', marginBottom: 2 }}>CURRENT HEADING</Text>
                    <Text style={{ fontSize: 24, fontWeight: '600', color: '#ccc' }}>
                      {compassHeadingDeg != null ? (angleUnit === 'mils' ? `${Math.round(degreesToMils(compassHeadingDeg, { normalize: true }))} mils` : `${Math.round(compassHeadingDeg)}°`) : '—'}
                    </Text>
                  </div>
                  <div style={{ width: 1, height: 40, backgroundColor: '#333' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#888', marginBottom: 2 }}>DISTANCE</Text>
                    <Text style={{ fontSize: 28, fontWeight: '600', color: '#ddd' }}>
                      {compassDistanceText || '—'}
                    </Text>
                  </div>
                </div>

                <div style={{ marginTop: 20, position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(() => {
                    const relativeRotation = (effectiveLastLocation && orientation != null) 
                      ? normalizeDegrees(compassTargetBearingDeg - (effectiveLastLocation.coords.magHeading || effectiveLastLocation.coords.trueHeading || 0))
                      : 0;
                    return (
                      <div style={{
                        width: 0, height: 0,
                        borderLeft: '30px solid transparent',
                        borderRight: '30px solid transparent',
                        borderBottom: `80px solid ${bannerAccent}`,
                        transform: `rotate(${relativeRotation}deg)`,
                        transition: 'transform 0.3s ease-out'
                      }} />
                    );
                  })()}
                </div>
              </>
            ) : (
              <Text style={{ fontSize: 24, color: '#aaa', textAlign: 'center' }}>
                Select a checkpoint to view navigation metrics
              </Text>
            )}
          </div>
        )}
        {!hudMode && <InfoBox lastLocation={effectiveLastLocation} mapHeading={mapHeading} angleUnit={angleUnit} containerStyle={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 6, zIndex: 100 }} textStyle={styles.locationText} renderAs="web" />}
        {!hudMode && <RecenterButton onPress={handleRecenterPress} style={overlayStyles.recenter(following)} color={buttonIconColor} renderAs="web" />}
        <HudButton 
          onPress={() => setHudMode(!hudMode)} 
          style={overlayStyles.hudButton(12 + 58 + 58, hudMode)} 
          color={hudMode ? bannerAccent : (colorScheme === 'light' ? tint : iconColor)} 
          active={hudMode} 
          renderAs="web" 
        />
        {!hudMode && <CompassButton onPress={() => setCompassOpen(true)} style={overlayStyles.floatingButton(12 + 58, compassOpen)} color={compassButtonColor} active={compassOpen} renderAs="web" />}
        {/* Placement mode banner */}
        {placementModeRequested && (
          <div style={{
            position: 'absolute',
            top: 12,
            left: 0,
            right: 0,
            zIndex: 200,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              pointerEvents: 'auto',
              background: colorScheme === 'dark' ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.97)',
              border: `2px solid ${bannerAccent}`,
              borderRadius: 14,
              padding: '12px 18px',
              maxWidth: 300,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: bannerAccent }} />
                <span style={{ color: String(textColor), fontWeight: 700, fontSize: 15 }}>Placing waypoints</span>
                {placedCount > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: bannerAccent,
                    color: bannerAccentText,
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 11,
                    minWidth: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingLeft: 6,
                    paddingRight: 6,
                  }}>{placedCount}</span>
                )}
              </div>
              <div style={{ color: String(borderColor), fontSize: 13, lineHeight: '18px', marginBottom: 10 }}>
                {placedCount === 0
                  ? 'Click anywhere on the map to place your first waypoint.'
                  : `${placedCount} waypoint${placedCount !== 1 ? 's' : ''} placed. Click to add more.`}
              </div>
              <button
                onClick={() => { void cancelPlacementMode(); setPlacedCount(0); }}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  border: 'none',
                  borderRadius: 999,
                  background: bannerAccent,
                  color: bannerAccentText,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >Done</button>
            </div>
          </div>
        )}
        {!hudMode && (
          <CompassOverlay
            open={compassOpen}
            onToggle={() => setCompassOpen((v) => !v)}
            headingDeg={compassHeadingDeg}
            angleUnit={angleUnit}
            targetBearingDeg={compassTargetBearingDeg}
            targetLabel={compassTargetLabel}
            headingReferenceLabel={compassHeadingDeg == null ? null : compassHeadingRefLabel}
            targetColor={compassTargetColor}
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
        )}
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
