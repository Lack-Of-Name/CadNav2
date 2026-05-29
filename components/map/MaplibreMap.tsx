import DownloadProgressOverlay from '@/components/DownloadProgressOverlay';
import { CompassOverlay } from '@/components/map/CompassOverlay';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { GridReferenceModal } from '@/components/GridReferenceModal';
import { ProjectPointModal } from '@/components/ProjectPointModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useGPS } from '@/hooks/gps';
import { useOfflineMaps } from '@/hooks/offline-maps';
import { getMapStyleUrl, useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View, ScrollView, Platform, Linking, useWindowDimensions } from 'react-native';
import { ThemeSwitch } from '../ui/ThemeSwitch';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '../themed-view';
import { bearingDegrees, CompassButton, formatHeading, haversineMeters, RecenterButton, sleep } from './MaplibreMap.utils';
import { degreesToMils } from './converter';
import { computeGridCornersFromMapBounds, formatGridReference, generateGridPoints, latLonToGridCoords } from './mapGrid';

let maplibreModule: any | undefined | null;

function getMaplibreModule() {
  if (maplibreModule !== undefined) return maplibreModule;
  try {
    // Avoid hard-crashing Expo Go when the native module isn't available.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    maplibreModule = require('@maplibre/maplibre-react-native');
  } catch {
    maplibreModule = null;
  }
  return maplibreModule;
}

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

const arrowSvg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L19 21 L12 17 L5 21 Z" fill="white" /></svg>`;
const dotSvg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5" fill="white" /></svg>`;

const gridLinesStyle = { 
  lineColor: 'rgba(0,0,0,0.8)', 
  lineWidth: 1.5,
  lineOpacity: ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1]
};
const gridSublinesStyle = { 
  lineColor: 'rgba(0,0,0,0.3)', 
  lineWidth: 1,
  lineOpacity: ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1]
};
const gridNumbersStyle = {
  textField: ['get', 'label'],
  textSize: 14,
  textColor: 'rgba(0,0,0,1)',
  textHaloColor: 'rgba(255,255,255,0.8)',
  textHaloWidth: 2,
  textOpacity: ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1]
};
const gridOriginCircleStyle = {
  circleRadius: 6,
  circleColor: 'transparent',
  circleStrokeWidth: 2,
  circleStrokeColor: 'rgba(0,0,0,0.8)',
  circleStrokeOpacity: ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1]
};
const gridOriginDotStyle = { 
  circleRadius: 2, 
  circleColor: 'rgba(0,0,0,0.8)',
  circleOpacity: ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1]
};

const checkpointsOuterStyle = {
  circleRadius: 12,
  circleColor: 'rgba(255,255,255,0.8)',
  circleStrokeWidth: 1,
  circleStrokeColor: 'rgba(0,0,0,0.1)',
};
const checkpointsInnerStyle = { circleRadius: 8, circleColor: '#fff' };
const checkpointsDotStyle = { circleRadius: 6, circleColor: ['get', 'color'] };

const locationMarkerPulseStyle = {
  circleRadius: 12,
  circleColor: 'rgba(0,122,255,0.15)',
  circleStrokeWidth: 6,
  circleStrokeColor: 'rgba(0,122,255,0.15)',
};
const locationMarkerBgStyle = { circleRadius: 12, circleColor: Colors.light.primary };
const locationMarkerIconStyle = {
  iconImage: ['case', ['get', 'hasOrientation'], 'location-arrow', 'location-dot'],
  iconSize: 1,
  iconRotate: ['get', 'orientation'],
  iconRotationAlignment: 'map',
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

export default function MapLibreMap() {
  const maplibre = getMaplibreModule();
  const { apiKey, loading, promptForKey } = useMapTilerKey();
  const { lastLocation, requestLocation } = useGPS();
  const { checkpoints, selectCheckpoint, selectedId, selectedCheckpoint, placementModeRequested, requestPlacementMode, cancelPlacementMode, addCheckpoint, activeRouteColor, activeRouteStart, activeRouteLoop, viewTarget, consumeViewTarget, setActiveRouteColor, setActiveRouteStart, setActiveRouteLoop, clearActiveRoute, setCheckpointLabel, setViewTarget } = useCheckpoints();
  const { angleUnit, mapHeading, mapGridEnabled, mapGridOrigin, gridConvergence, mapGridSubdivisionsEnabled, mapGridNumbersEnabled, mapLayer, setSetting } = useSettings();
  const { initOffline, packs } = useOfflineMaps();
  const hasOfflinePacks = packs && packs.length > 0;
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  function hexToRgba(hex: string, alpha: number) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const primaryHex = Colors[colorScheme].primary;
  const primaryRgba15 = hexToRgba(primaryHex, 0.15);
  const computedLocationMarkerPulseStyle = {
    circleRadius: 12,
    circleColor: primaryRgba15,
    circleStrokeWidth: 6,
    circleStrokeColor: primaryRgba15,
  };
  const computedLocationMarkerBgStyle = { circleRadius: 12, circleColor: primaryHex };
  const iconColor = useThemeColor({}, 'tabIconDefault');
  const tabIconSelected = useThemeColor({}, 'tabIconSelected');
  const tint = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const background = useThemeColor({}, 'background');
  const mapStyle = getMapStyleUrl(mapLayer, colorScheme, apiKey || '');
  const [androidMapStyle, setAndroidMapStyle] = useState<any | null>(null);
  const [androidStyleLoadFailed, setAndroidStyleLoadFailed] = useState(false);
  const [androidStyleRetryToken, setAndroidStyleRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    if (Platform.OS !== 'android') {
      setAndroidMapStyle(null);
      setAndroidStyleLoadFailed(false);
      clearTimeout(timeoutId);
      return;
    }

    if (!apiKey) {
      setAndroidMapStyle(null);
      setAndroidStyleLoadFailed(true);
      clearTimeout(timeoutId);
      return;
    }

    (async () => {
      try {
        setAndroidStyleLoadFailed(false);
        const res = await fetch(mapStyle, { signal: controller.signal });
        const style = await res.json();
        if (cancelled) return;

        const filteredStyle = {
          ...style,
          layers: Array.isArray(style.layers)
            ? style.layers.filter((layer: any) => layer?.type !== 'symbol')
            : style.layers,
        };

        delete (filteredStyle as any).glyphs;
        setAndroidMapStyle(filteredStyle);
        setAndroidStyleLoadFailed(false);
      } catch {
        if (!cancelled) {
          setAndroidMapStyle(null);
          setAndroidStyleLoadFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [mapStyle, androidStyleRetryToken]);
  
  const mapImages = React.useMemo(() => {
    return {
      'location-arrow': { uri: 'data:image/svg+xml;base64,' + btoa(arrowSvg) },
      'location-dot': { uri: 'data:image/svg+xml;base64,' + btoa(dotSvg) },
    };
  }, []);

  const routeLineStyle = React.useMemo(() => ({
    lineColor: activeRouteColor ?? 'transparent',
    lineOpacity: activeRouteColor ? 0.75 : 0,
    lineWidth: 3,
    lineDasharray: activeRouteColor === Colors[colorScheme].tempTarget ? [0.8, 1.6] : [1],
    lineCap: 'round',
  }), [activeRouteColor, colorScheme]);

  const checkpointsLabelsStyle = React.useMemo(() => ({
    textField: ['get', 'label'],
    textSize: 12,
    textColor: String(textColor),
    textHaloColor: String(background),
    textHaloWidth: 2,
    textOffset: [0, 1.5],
    textAnchor: 'top',
    textOpacity: ['case', ['==', ['get', 'label'], ''], 0, 1],
  }) as any, [textColor, background]);

  const router = useRouter();
  const cameraRef = React.useRef<any>(null);
  const mapRef = React.useRef<any>(null);
  const programmaticMoveRef = React.useRef(false);
  const [following, setFollowing] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [visibleBounds, setVisibleBounds] = useState<[[number, number], [number, number]] | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [stickyHudOpen, setStickyHudOpen] = useState(false);
  const [placementMenuOpen, setPlacementMenuOpen] = useState(false);
  const [gridPlacementOpen, setGridPlacementOpen] = useState(false);
  const [projectPlacementOpen, setProjectPlacementOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number }>(() => {
    if (lastLocation?.coords) {
      return { latitude: lastLocation.coords.latitude, longitude: lastLocation.coords.longitude };
    }
    return { latitude: -37.8136, longitude: 144.9631 };
  });

  const menuTranslateX = useSharedValue(-300);

  useEffect(() => {
    menuTranslateX.value = withTiming(menuOpen ? 0 : -300, { duration: 250 });
  }, [menuOpen]);

  const menuAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: menuTranslateX.value }],
  }));

  useEffect(() => {
    if (lastLocation?.coords && following) {
      setMapCenter({
        latitude: lastLocation.coords.latitude,
        longitude: lastLocation.coords.longitude
      });
    }
  }, [lastLocation, following]);
  const buttonIconColor = following ? tabIconSelected : (colorScheme === 'light' ? tint : iconColor);
  const tempTargetColor = Colors[colorScheme].tempTarget;
  const tempTargetActive = activeRouteColor === tempTargetColor || activeRouteColor === Colors.light.tempTarget;
  const mapGridOriginForRef = mapGridOrigin ?? { latitude: -37.8136, longitude: 144.9631 };
  const { height: screenHeight } = useWindowDimensions();
  const bottomHudVisible = stickyHudOpen;
  const bannerAccent = activeRouteColor ?? tempTargetColor;
  const bannerAccentText = isLightColor(bannerAccent) ? '#000' : '#fff';
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

  const compassTargetColor = selectedCheckpoint?.color || activeRouteColor;

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

  const compassBearingDegreesText =
    typeof compassTargetBearingDeg === 'number'
      ? `${Math.round(compassTargetBearingDeg)}°`
      : null;

  const compassBearingMilsText =
    typeof compassTargetBearingDeg === 'number'
      ? `${Math.round(degreesToMils(compassTargetBearingDeg, { normalize: true }))}`
      : null;

  const compassDistanceMeters = lastLocation && selectedCheckpoint
    ? haversineMeters(
        lastLocation.coords.latitude,
        lastLocation.coords.longitude,
        selectedCheckpoint.latitude,
        selectedCheckpoint.longitude
      )
    : null;

  const compassDistanceText =
    compassDistanceMeters != null
      ? (() => {
          const meters = compassDistanceMeters;
          if (!Number.isFinite(meters)) return null;
          if (meters >= 1000) {
            const km = meters / 1000;
            const decimals = km >= 10 ? 0 : 1;
            return `${km.toFixed(decimals)} km`;
          }
          return `${Math.round(meters)} m`;
        })()
      : null;

  const headingText = formatHeading(lastLocation, mapHeading, angleUnit);
  const currentPositionText = lastLocation
    ? `${lastLocation.coords.latitude.toFixed(5)}, ${lastLocation.coords.longitude.toFixed(5)}`
    : 'No fix yet';
  const targetGridRefText = selectedCheckpoint
    ? (() => {
        const { easting, northing } = latLonToGridCoords(
          mapGridOriginForRef,
          { latitude: selectedCheckpoint.latitude, longitude: selectedCheckpoint.longitude },
          gridConvergence ?? 0
        );
        return formatGridReference(easting, northing);
      })()
    : null;
  const targetTitle = selectedCheckpoint
    ? selectedCheckpoint.label?.trim() || `Checkpoint ${selectedIndex + 1}`
    : bottomHudVisible
      ? 'Checkpoint route'
      : 'No target selected';
  const targetBearingDescriptor = compassTargetBearingDeg != null
    ? angleUnit === 'mils'
      ? `Bearing ${compassBearingMilsText ?? '—'} mils`
      : `Bearing ${compassBearingDegreesText ?? '—'}`
    : null;
  const targetSubtitle = selectedCheckpoint
    ? targetBearingDescriptor && compassDistanceText != null
      ? `${targetBearingDescriptor} · ${compassDistanceText}`
      : 'Waiting for location fix'
    : tempTargetActive
      ? 'Temporary target active'
      : 'Use the placement tools below to add a temp checkpoint.';
  const summaryAccent = tempTargetActive ? tempTargetColor : (compassTargetColor ?? activeRouteColor ?? tempTargetColor);
  const summaryAccentText = isLightColor(summaryAccent) ? '#111' : '#fff';
  const altitudeDeltaText = selectedCheckpoint?.elevation != null && lastLocation?.coords.altitude != null
    ? (() => {
        const delta = selectedCheckpoint.elevation - lastLocation.coords.altitude;
        const arrow = delta >= 0 ? '↑' : '↓';
        return `${arrow} ${Math.round(Math.abs(delta))}m`;
      })()
    : null;

  const [trackedTargetId, setTrackedTargetId] = useState<string | null>(null);
  const [targetStartDistance, setTargetStartDistance] = useState<number | null>(null);

  useEffect(() => {
    if (selectedId && lastLocation && trackedTargetId !== selectedId) {
      const sp = checkpoints.find((c) => c.id === selectedId);
      if (sp) {
        const dist = haversineMeters(
          lastLocation.coords.latitude,
          lastLocation.coords.longitude,
          sp.latitude,
          sp.longitude
        );
        if (Number.isFinite(dist)) {
          setTrackedTargetId(selectedId);
          setTargetStartDistance(dist);
        }
      }
    } else if (!selectedId && trackedTargetId !== null) {
      setTrackedTargetId(null);
      setTargetStartDistance(null);
    }
  }, [selectedId, lastLocation, checkpoints, trackedTargetId]);

  const startDistance = targetStartDistance;
  const currentProgress = (startDistance && compassDistanceMeters != null && startDistance > 0)
    ? Math.max(0, Math.min(1, 1 - (compassDistanceMeters / startDistance)))
    : 0;

  const handleNextTarget = () => {
    if (checkpoints.length <= 1) return;
    const idx = selectedIndex >= 0 ? selectedIndex : 0;
    const next = (idx + 1) % checkpoints.length;
    void selectCheckpoint(checkpoints[next].id);
  };

  const handlePrevTarget = () => {
    if (checkpoints.length <= 1) return;
    const idx = selectedIndex >= 0 ? selectedIndex : 0;
    const prev = (idx - 1 + checkpoints.length) % checkpoints.length;
    void selectCheckpoint(checkpoints[prev].id);
  };

  const centerOnLocation = async (loc: any) => {
    if (!loc || !cameraRef.current) return;
    const { latitude, longitude } = loc.coords;
    programmaticMoveRef.current = true;
    try {
      cameraRef.current.setCamera({
        centerCoordinate: [longitude, latitude],
        zoomLevel: 14,
        animationDuration: 1000,
      });
      await sleep(1000);
    } finally {
      programmaticMoveRef.current = false;
    }
  };

  const handleRecenterPress = async () => {
    // Recenter once, but do not force continuous follow mode.
    requestLocation();
    if (lastLocation) {
      await centerOnLocation(lastLocation);
    }
    setFollowing(false);
  };

  const openPlacementChooser = () => {
    setStickyHudOpen(true);
    setPlacementMenuOpen(true);
  };

  const startPlacementFlow = async (mode: 'tap' | 'grid' | 'project') => {
    setStickyHudOpen(true);
    await requestPlacementMode();
    setPlacementMenuOpen(false);
    if (mode !== 'tap') {
      await cancelPlacementMode();
    }
    setGridPlacementOpen(false);
    setProjectPlacementOpen(false);

    if (mode === 'grid') {
      setGridPlacementOpen(true);
    } else if (mode === 'project') {
      setProjectPlacementOpen(true);
    }
  };

  const placeTemporaryCheckpoint = async (latitude: number, longitude: number) => {
    await setActiveRouteColor(tempTargetColor);
    await setActiveRouteLoop(false);
    await clearActiveRoute();
    await setActiveRouteStart(lastLocation ? { latitude: lastLocation.coords.latitude, longitude: lastLocation.coords.longitude } : null);
    const cp = await addCheckpoint(latitude, longitude);
    await setCheckpointLabel(cp.id, 'Temporary target');
    await setViewTarget({ latitude, longitude, zoom: 15 });
    await cancelPlacementMode();
    setFollowing(false);
  };

  const onMapPress = async (event: any) => {
    if (!placementModeRequested) return;
    let coords;
    if (event?.geometry?.coordinates) coords = event.geometry.coordinates;
    else if (event?.coordinates) coords = event.coordinates;

    if (!coords || !Array.isArray(coords) || coords.length < 2) return;
    
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isNaN(lon) || Number.isNaN(lat)) return;

    await placeTemporaryCheckpoint(lat, lon);
  };

  const handleDonePlacing = async () => {
    await cancelPlacementMode();
    setPlacementMenuOpen(false);
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
      setFollowing(false);
    }
  }, [lastLocation, cameraReady]);

  // Initialize offline ambient cache on first mount
  useEffect(() => {
    initOffline();
  }, [initOffline]);

  const lastLat = lastLocation?.coords.latitude;
  const lastLon = lastLocation?.coords.longitude;

  useEffect(() => {
    if (!following || lastLat == null || lastLon == null || !cameraRef.current) return;
    cameraRef.current.setCamera({
      centerCoordinate: [lastLon, lastLat],
      animationDuration: 800,
    });
  }, [lastLat, lastLon, following]);

  // Consume viewTarget from routes screen
  useEffect(() => {
    if (!viewTarget || !cameraRef.current || !cameraReady) return;
    const fly = async () => {
      const target = await consumeViewTarget();
      if (!target) return;
      cameraRef.current.setCamera({
        centerCoordinate: [target.longitude, target.latitude],
        zoomLevel: target.zoom ?? 14,
        animationDuration: 1000,
      });
      setFollowing(false);
    };
    void fly();
  }, [viewTarget, cameraReady, consumeViewTarget]);

  const emptyGeo = React.useMemo(() => ({ type: 'FeatureCollection', features: [] } as any), []);

  const routeLineShape = React.useMemo(() => {
    if (!activeRouteColor) return emptyGeo;
    const validCps = checkpoints.filter(cp => Number.isFinite(cp.latitude) && Number.isFinite(cp.longitude));
    const coords = validCps.map((cp) => [cp.longitude, cp.latitude]);
    if (activeRouteStart && Number.isFinite(activeRouteStart.longitude) && Number.isFinite(activeRouteStart.latitude)) {
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

  const markerColor = activeRouteColor ?? (colorScheme === 'dark' ? '#0A84FF' : String(tint));
  
  const routeEndpointsShape = React.useMemo(() => {
    if (!checkpoints || checkpoints.length < 2) return emptyGeo;
    const start = checkpoints[0];
    const end = checkpoints[checkpoints.length - 1];
    
    const features = [];
    
    if (Number.isFinite(start.latitude) && Number.isFinite(start.longitude)) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [start.longitude, start.latitude] },
        properties: { 
          kind: 'start',
          label: 'S'
        },
      });
    }
    
    if (!activeRouteLoop && Number.isFinite(end.latitude) && Number.isFinite(end.longitude) && end.id !== start.id) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [end.longitude, end.latitude] },
        properties: {
          kind: 'finish',
          label: 'F'
        }
      });
    }

    return { type: 'FeatureCollection', features };
  }, [checkpoints, emptyGeo, activeRouteLoop]);

  const gridShape = React.useMemo(() => {
    if (!mapGridEnabled || zoomLevel < 10.5 || !visibleBounds) return emptyGeo;
    const originPt = mapGridOrigin ?? { latitude: -37.8136, longitude: 144.9631 };
    
    // Pad the visible bounds to prevent grid lines from popping into existence while panning.
    const latSpan = Math.abs(visibleBounds[0][1] - visibleBounds[1][1]);
    const lngSpan = Math.abs(visibleBounds[0][0] - visibleBounds[1][0]);

    // SANITY CHECK: If map span is huge, we are flying/zoomed out. Skip heavy grid math until bounds catch up!
    if (latSpan > 1.5 || lngSpan > 1.5) return emptyGeo;

    const latPad = Math.min(latSpan * 0.5, 0.5); // cap padding to max 0.5 deg to avoid massive shapes
    const lngPad = Math.min(lngSpan * 0.5, 0.5);
    
    const swLat = Math.min(visibleBounds[0][1], visibleBounds[1][1]);
    const swLng = Math.min(visibleBounds[0][0], visibleBounds[1][0]);
    const neLat = Math.max(visibleBounds[0][1], visibleBounds[1][1]);
    const neLng = Math.max(visibleBounds[0][0], visibleBounds[1][0]);

    const sw = { 
      latitude: swLat - latPad, 
      longitude: swLng - lngPad 
    };
    const ne = { 
      latitude: neLat + latPad, 
      longitude: neLng + lngPad 
    };

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

    // Subdivisions (only process if zoomed in enough! Saves huge amounts of memory)
    // Style opacity hits 0 below zoom 13, so no need to compute geometry below 12.5.
    if (mapGridSubdivisionsEnabled && zoomLevel >= 12.5 && es.length >= 2 && ns.length >= 2) {
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
            const eStr = (e0 < 0 ? '-' : '') + Math.abs(Math.floor(e0 / 1000)).toString().padStart(2, '0').slice(-2);
            const nStr = (n0 < 0 ? '-' : '') + Math.abs(Math.floor(n0 / 1000)).toString().padStart(2, '0').slice(-2);
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

  const checkpointsShape = React.useMemo(() => {
    const validCps = checkpoints.filter(cp => Number.isFinite(cp.latitude) && Number.isFinite(cp.longitude));
    return {
      type: 'FeatureCollection',
      features: validCps.map((cp) => ({
        type: 'Feature',
        id: cp.id,
        geometry: {
          type: 'Point',
          coordinates: [cp.longitude, cp.latitude],
        },
        properties: {
          id: cp.id,
          label: cp.label || '',
          color: cp.color ?? activeRouteColor ?? tint,
          selected: selectedId === cp.id,
        },
      })),
    };
  }, [checkpoints, selectedId, activeRouteColor, tint]);

  const locationMarkerShape = React.useMemo(() => {
    if (!lastLocation) return emptyGeo;
    const useMag = mapHeading === 'magnetic';
    const h = useMag ? lastLocation.coords.magHeading : lastLocation.coords.trueHeading;
    const orientation = typeof h === 'number' ? h : null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lastLocation.coords.longitude, lastLocation.coords.latitude],
          },
          properties: {
            kind: 'locationMarker',
            orientation: orientation ?? 0,
            hasOrientation: orientation != null,
          },
        },
      ],
    } as any;
  }, [lastLocation, mapHeading, emptyGeo]);

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

  if (loading || (!apiKey && !hasOfflinePacks)) {
    return (
      <ThemedView style={[styles.page, { justifyContent: 'center', alignItems: 'center' }]}>
        {loading ? (
          <ActivityIndicator size="large" color={typeof tint === 'string' ? tint : String(bannerAccent)} style={{ marginBottom: 16 }} />
        ) : (
          <IconSymbol name="map.fill" size={64} color={iconColor} style={{ marginBottom: 16, opacity: 0.5 }} />
        )}
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8, color: textColor }}>
          {loading ? 'MapTiler API' : 'Map Unavailable'}
        </Text>
        <Text style={{ fontSize: 14, textAlign: 'center', marginHorizontal: 32, marginBottom: 24, color: textColor, opacity: 0.7 }}>
          {loading ? 'Waiting for MapTiler API key...' : 'No API key configured and no offline maps found. Please add an API key in settings or use downloaded maps.'}
        </Text>
        {!loading && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={{ backgroundColor: bannerAccent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}
              onPress={promptForKey}
            >
              <Text style={{ color: bannerAccentText, fontWeight: '600' }}>Enter API Key</Text>
            </TouchableOpacity>
            <TouchableOpacity 
            style={{ backgroundColor: bannerAccent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Text style={{ color: bannerAccentText, fontWeight: '600' }}>Open Settings</Text>
          </TouchableOpacity>
          </View>
        )}
      </ThemedView>
    );
  }

  const { Camera, LineLayer, CircleLayer, SymbolLayer, MapView, ShapeSource, Images } = maplibre as any;

  if (Platform.OS === 'android' && !androidMapStyle) {
    return (
      <ThemedView style={styles.page}>
        <StatusBar animated={true} barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={typeof tint === 'string' ? tint : String(bannerAccent)} style={{ marginBottom: 16 }} />
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8, color: textColor }}>
            {androidStyleLoadFailed ? 'Map style unavailable' : 'Loading map'}
          </Text>
          <Text style={{ fontSize: 14, textAlign: 'center', marginHorizontal: 32, color: textColor, opacity: 0.7 }}>
            {androidStyleLoadFailed
              ? 'The Android map style did not load. Retry or re-enter the API key.'
              : 'Preparing the native map style.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
            <TouchableOpacity
              style={{ backgroundColor: bannerAccent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 }}
              onPress={() => setAndroidStyleRetryToken((v) => v + 1)}
            >
              <Text style={{ color: bannerAccentText, fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(128,128,128,0.18)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 }}
              onPress={promptForKey}
            >
              <Text style={{ color: textColor, fontWeight: '600' }}>Enter API Key</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>
    );
  }

  const mapContent = (
    <ThemedView style={styles.page}>
      <StatusBar animated={true} barStyle="dark-content" />

      <MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={Platform.OS === 'android' ? androidMapStyle : mapStyle}
        logoEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        compassEnabled={false}
        onPress={onMapPress}
        onRegionDidChange={(ev: any) => {
          const z = ev?.properties?.zoomLevel ?? ev?.properties?.zoom ?? ev?.zoomLevel;
          if (typeof z === 'number' && Number.isFinite(z)) setZoomLevel(z);
          
          // Update map center coordinate
          const coords = ev?.geometry?.coordinates;
          if (coords && Array.isArray(coords) && coords.length >= 2) {
            setMapCenter({ longitude: coords[0], latitude: coords[1] });
          }

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
          if (programmaticMoveRef.current) return;

          // Update map center coordinate while panning for real-time overlay updates
          const coords = ev?.geometry?.coordinates;
          if (coords && Array.isArray(coords) && coords.length >= 2) {
            setMapCenter({ longitude: coords[0], latitude: coords[1] });
          }

          if (following) {
            setFollowing(false);
          }
        }}
      >
        <Camera
          ref={(ref: any) => {
            cameraRef.current = ref;
            if (ref) setCameraReady(true);
          }}
          defaultSettings={{
            centerCoordinate: [0, 0],
            zoomLevel: 1,
          }}
        />

        <Images
          images={mapImages}
        />

        <ShapeSource id="grid-source" shape={gridShape}>
          <LineLayer
            id="grid-lines"
            filter={['==', 'kind', 'gridLine']}
            style={gridLinesStyle}
          />
          <LineLayer
            id="grid-sublines"
            filter={['==', 'kind', 'gridSubLine']}
            style={gridSublinesStyle}
          />
          <SymbolLayer
            id="grid-numbers"
            filter={['==', 'kind', 'gridNumber']}
            style={gridNumbersStyle}
          />
        </ShapeSource>

        <ShapeSource id="grid-origin-source" shape={gridOriginShape}>
          <CircleLayer
            id="grid-origin-circle"
            style={gridOriginCircleStyle}
          />
          <CircleLayer
            id="grid-origin-dot"
            style={gridOriginDotStyle}
          />
        </ShapeSource>

        <ShapeSource id="route-line-source" shape={routeLineShape}>
          <LineLayer
            id="route-line"
            style={routeLineStyle}
          />
        </ShapeSource>

        <ShapeSource id="route-endpoints-source" shape={routeEndpointsShape}>
          <CircleLayer
            id="route-endpoint-circle"
            style={{
              circleRadius: 12,
              circleColor: markerColor,
              circleStrokeColor: '#ffffff',
              circleStrokeWidth: 2,
            }}
          />
          {Platform.OS !== 'android' && (
            <SymbolLayer
              id="route-endpoint-text"
              style={{
                textField: ['get', 'label'],
                textColor: '#ffffff',
                textSize: 14,
                textAllowOverlap: true,
                textIgnorePlacement: true,
              }}
            />
          )}
        </ShapeSource>

        <ShapeSource 
          id="checkpoints-source" 
          shape={checkpointsShape}
          onPress={(event: any) => {
            const feature = event.features[0];
            if (feature && feature.properties && feature.properties.id) {
              handleMarkerPress(feature.properties.id);
            }
          }}
        >
          <CircleLayer
            id="checkpoints-outer"
            style={checkpointsOuterStyle}
          />
          <CircleLayer
            id="checkpoints-inner"
            style={checkpointsInnerStyle}
          />
          <CircleLayer
            id="checkpoints-dot"
            style={checkpointsDotStyle}
          />
          {Platform.OS !== 'android' && (
            <SymbolLayer
              id="checkpoints-labels"
              style={checkpointsLabelsStyle}
            />
          )}
        </ShapeSource>

        <ShapeSource id="location-marker-source" shape={locationMarkerShape}>
          <CircleLayer
            id="location-marker-pulse"
            style={computedLocationMarkerPulseStyle}
          />
          <CircleLayer
            id="location-marker-bg"
            style={computedLocationMarkerBgStyle}
          />
          <SymbolLayer
            id="location-marker-icon"
            style={locationMarkerIconStyle}
          />
        </ShapeSource>
      </MapView>

      <DownloadProgressOverlay />

      {bottomHudVisible ? (
        <View style={[styles.summaryWrap, { left: insets.left + 12 + 58 + 14, right: insets.right + 12, bottom: insets.bottom + 12, maxHeight: Math.max(112, Math.round(screenHeight * 0.2)) }]}> 
          <View style={[styles.summaryCard, { backgroundColor: colorScheme === 'dark' ? 'rgba(17,17,17,0.96)' : 'rgba(255,255,255,0.97)', borderColor: summaryAccent }]}> 
            <View style={styles.summaryHeader}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.summaryTitle, { color: String(textColor) }]} numberOfLines={1}>
                  {placementMenuOpen
                    ? 'Choose add method'
                    : selectedCheckpoint
                      ? 'Navigation'
                      : 'Checkpoint planner'}
                </Text>
                <Text style={[styles.summarySubtitle, { color: String(borderColor) }]} numberOfLines={1}>
                  {placementMenuOpen
                    ? 'Choosing a method clears the current route and opens placement.'
                    : selectedCheckpoint
                      ? (tempTargetActive ? 'Temp target active' : `${checkpoints.length} checkpoint${checkpoints.length === 1 ? '' : 's'} loaded`)
                      : 'Dense temp placement and route control'}
                </Text>
              </View>
              {selectedCheckpoint ? (
                <TouchableOpacity
                  onPress={openPlacementChooser}
                  activeOpacity={0.85}
                  style={[styles.summaryPlusButton, { backgroundColor: summaryAccent }]}
                >
                  <View style={[styles.routeColorDot, { backgroundColor: summaryAccent }]} />
                </TouchableOpacity>
              ) : null}
              {placementMenuOpen ? (
                <View style={[styles.summaryAccentPill, { backgroundColor: 'rgba(127,127,127,0.18)' }]}>
                  <Text style={[styles.summaryAccentPillText, { color: String(textColor) }]}>RESET ON SELECT</Text>
                </View>
              ) : tempTargetActive && checkpoints.length > 1 ? (
                <View style={styles.summaryNavButtons}>
                  <TouchableOpacity onPress={handlePrevTarget} style={[styles.summaryNavButton, { borderColor: summaryAccent }]}>
                    <IconSymbol name="chevron.left" size={16} color={summaryAccent} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleNextTarget} style={[styles.summaryNavButton, { borderColor: summaryAccent }]}>
                    <IconSymbol name="chevron.right" size={16} color={summaryAccent} />
                  </TouchableOpacity>
                </View>
              ) : selectedCheckpoint ? (
                <View style={[styles.summaryAccentPill, { backgroundColor: 'rgba(127,127,127,0.18)' }]}>
                  <Text style={[styles.summaryAccentPillText, { color: String(textColor) }]}>{tempTargetActive ? 'TEMP' : 'NAV'}</Text>
                </View>
              ) : null}
            </View>

            {placementMenuOpen ? (
              <>
                <View style={styles.summaryMenuHeader}>
                  <Text style={[styles.summaryTitle, { color: String(textColor) }]}>Place checkpoint</Text>
                  <Text style={[styles.summarySubtitle, { color: String(borderColor) }]}>Choose one method, clear the current route, then place the temp checkpoint.</Text>
                </View>
                <View style={styles.summaryMenuActions}>
                  <TouchableOpacity onPress={() => { void startPlacementFlow('tap'); }} style={[styles.summaryMenuAction, { borderColor: summaryAccent, backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}> 
                    <IconSymbol name="hand.tap.fill" size={18} color={summaryAccent} />
                    <Text style={[styles.summaryMenuActionText, { color: String(textColor) }]}>Tap map</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { void startPlacementFlow('grid'); }} style={[styles.summaryMenuAction, { borderColor: summaryAccent, backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}> 
                    <IconSymbol name="square.grid.3x3" size={18} color={summaryAccent} />
                    <Text style={[styles.summaryMenuActionText, { color: String(textColor) }]}>Grid ref</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { void startPlacementFlow('project'); }} style={[styles.summaryMenuAction, { borderColor: summaryAccent, backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}> 
                    <IconSymbol name="safari.fill" size={18} color={summaryAccent} />
                    <Text style={[styles.summaryMenuActionText, { color: String(textColor) }]}>Project</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPlacementMenuOpen(false)} style={[styles.summaryMenuAction, { borderColor: summaryAccent, backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}> 
                    <IconSymbol name="chevron.down" size={18} color={summaryAccent} />
                    <Text style={[styles.summaryMenuActionText, { color: String(textColor) }]}>Back</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : selectedCheckpoint ? (
              <>
                <View style={styles.navHeroCompact}>
                  <View style={styles.navRail}>
                    <View style={styles.navRailTop}>
                      <View style={[styles.navArrow, { transform: [{ rotate: `${compassTargetBearingDeg ?? 0}deg` }] }]}>
                        <IconSymbol name="arrow.up" size={28} color={summaryAccent} />
                      </View>
                      <Text style={[styles.navRailBearing, { color: String(textColor) }]} numberOfLines={1}>{compassBearingMilsText || '—'}</Text>
                      <Text style={[styles.navRailLabel, { color: String(borderColor) }]}>MILS</Text>
                    </View>
                    <Text style={[styles.navRailLabel, { color: String(borderColor) }]} numberOfLines={1}>{tempTargetActive ? 'TEMP' : 'NAV'}</Text>
                  </View>

                  <View style={styles.navCopyColumn}>
                    <Text style={[styles.navTitle, { color: String(textColor) }]} numberOfLines={1}>{targetTitle}</Text>
                    <Text style={[styles.navDetail, { color: String(borderColor) }]} numberOfLines={1}>{targetBearingDescriptor || 'Bearing —'} · {compassDistanceText || '—'} · {targetGridRefText || '—'}</Text>
                    <Text style={[styles.navDetail, { color: String(borderColor) }]} numberOfLines={1}>{currentPositionText}</Text>
                    <View style={styles.navActionRow}>
                      <TouchableOpacity onPress={openPlacementChooser} style={[styles.summaryPlusButton, { backgroundColor: summaryAccent }]}> 
                        <IconSymbol name="plus" size={18} color={summaryAccentText} />
                      </TouchableOpacity>
                      <Text style={[styles.navActionHint, { color: String(borderColor) }]} numberOfLines={1}>Choose add method</Text>
                    </View>
                  </View>
                </View>

                {selectedCheckpoint && startDistance != null && startDistance > 0 ? (
                  <View style={[styles.summaryProgressTrack, { marginTop: 8, height: 3 }]}>
                    <View style={[styles.summaryProgressFill, { width: `${currentProgress * 100}%`, backgroundColor: summaryAccent }]} />
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.summaryMetaRow}>
                  <View style={[styles.metricChip, { borderColor: summaryAccent, backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}> 
                    <Text style={[styles.metricLabel, { color: String(borderColor) }]}>STATUS</Text>
                    <Text style={[styles.metricValue, { color: String(textColor) }]} numberOfLines={1}>{checkpoints.length > 0 ? `${checkpoints.length} points` : 'No active target'}</Text>
                  </View>
                  <View style={[styles.metricChip, { borderColor: summaryAccent, backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}> 
                    <Text style={[styles.metricLabel, { color: String(borderColor) }]}>POSITION</Text>
                    <Text style={[styles.metricValue, { color: String(textColor) }]} numberOfLines={1}>{currentPositionText}</Text>
                  </View>
                </View>

                <View style={styles.summaryFooter}>
                  <TouchableOpacity onPress={() => setPlacementMenuOpen(true)} style={[styles.summaryAccentPill, { backgroundColor: summaryAccent, flexDirection: 'row', alignItems: 'center', gap: 6 }]}> 
                    <IconSymbol name="hand.tap.fill" size={14} color={summaryAccentText} />
                    <Text style={[styles.summaryAccentPillText, { color: summaryAccentText }]}>Temp checkpoint</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                </View>
              </>
            )}
          </View>
        </View>
      ) : null}

      <RecenterButton onPress={handleRecenterPress} style={[styles.recenterButton, { bottom: insets.bottom + 12, left: insets.left + 12, backgroundColor: following ? (colorScheme === 'dark' ? 'rgba(9, 63, 81)' : 'rgba(255,255,255)') : (colorScheme === 'dark' ? 'rgba(0,0,0)' : 'rgba(255,255,255)'), borderWidth: 1.5, borderColor: following ? String(tint) : 'transparent' }]} color={buttonIconColor} renderAs="native" />
      <CompassButton onPress={() => setCompassOpen(true)} style={[styles.recenterButton, { bottom: insets.bottom + 12 + 58, left: insets.left + 12, backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0)' : 'rgba(255,255,255)', borderWidth: 1.5, borderColor: compassOpen ? String(tint) : 'transparent' }]} color={compassOpen ? tabIconSelected : buttonIconColor} active={compassOpen} renderAs="native" />

      <TouchableOpacity
        onPress={() => setStickyHudOpen((v) => !v)}
        activeOpacity={0.85}
        accessibilityLabel="Toggle sticky HUD"
        style={[
          styles.recenterButton,
          {
            bottom: insets.bottom + 12 + 58 + 58,
            left: insets.left + 12,
            backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)',
            borderWidth: 1.5,
            borderColor: stickyHudOpen ? summaryAccent : 'transparent',
          },
        ]}
      >
        <IconSymbol name={stickyHudOpen ? 'eye.slash.fill' : 'eye.fill'} size={22} color={stickyHudOpen ? summaryAccent : (colorScheme === 'light' ? tint : iconColor)} />
      </TouchableOpacity>

      <GridReferenceModal
        visible={gridPlacementOpen}
        onClose={() => setGridPlacementOpen(false)}
        onAdd={(location) => { void placeTemporaryCheckpoint(location.latitude, location.longitude); }}
      />

      <ProjectPointModal
        visible={projectPlacementOpen}
        onClose={() => setProjectPlacementOpen(false)}
        onAdd={(location) => { void placeTemporaryCheckpoint(location.latitude, location.longitude); }}
      />

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
          <View style={[styles.placementBanner, { backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.97)', borderColor: bannerAccent }]}>
            <View style={styles.placementBannerRow}>
              <View style={[styles.placementPulse, { backgroundColor: bannerAccent }]} />
              <Text style={[styles.placementBannerTitle, { color: String(textColor) }]}>Temporary checkpoint</Text>
              {checkpoints.length > 0 && (
                <View style={[styles.placedCountBadge, { backgroundColor: bannerAccent }]}>
                  <Text style={[styles.placedCountText, { color: bannerAccentText }]}>ACTIVE</Text>
                </View>
              )}
            </View>
            <Text style={[styles.placementBannerText, { color: String(borderColor) }]}>
              Tap anywhere on the map to place a single temporary checkpoint.
            </Text>
            <TouchableOpacity
              onPress={handleDonePlacing}
              activeOpacity={0.8}
              style={[styles.placementDoneBtn, { backgroundColor: bannerAccent }]}
            >
              <Text style={[styles.placementDoneText, { color: bannerAccentText }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Compass overlay replaced by CompassOverlay */}

    </ThemedView>
  );

  return (
    <View style={{ flex: 1 }}>
      {mapContent}
    </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryWrap: {
    position: 'absolute',
    zIndex: 58,
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  summarySubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  summaryNavButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryNavButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  summaryMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  summaryMenuHeader: {
    marginTop: 2,
  },
  summaryMenuActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  summaryMenuAction: {
    flexGrow: 1,
    minWidth: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  summaryMenuActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricChip: {
    minWidth: 92,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  summaryFooterLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  summaryFooterValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryAccentPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  summaryPlusButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  summaryAccentPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  navHero: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  navReticleShell: {
    width: 128,
    height: 128,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  navReticleRing: {
    position: 'absolute',
    width: 102,
    height: 102,
    borderRadius: 51,
    borderWidth: 1.5,
    opacity: 0.85,
  },
  navReticleLine: {
    position: 'absolute',
    width: 88,
    height: 2,
    borderRadius: 999,
    opacity: 0.6,
  },
  navReticlePointer: {
    position: 'absolute',
    top: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navReticleCenterDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  navReticleReadout: {
    position: 'absolute',
    bottom: 10,
    alignItems: 'center',
  },
  navReticleMils: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  navReticleMilsLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: -2,
  },
  navHeroCopy: {
    flex: 1,
    gap: 8,
  },
  navHeroStat: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  navHeroStatValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 1,
  },
  navHeroStatSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  summaryProgressTrack: {
    marginTop: 8,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(128,128,128,0.16)',
    overflow: 'hidden',
  },
  summaryProgressFill: {
    height: '100%',
    borderRadius: 999,
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
  navHeroCompact: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 6,
  },
  navRail: {
    width: 66,
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  navRailTop: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navArrow: {
    marginBottom: 2,
  },
  navRailBearing: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  navRailLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    opacity: 0.9,
  },
  navCopyColumn: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  navDetail: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  navActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  navActionHint: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  placementBannerWrap: {
    position: 'absolute',
    zIndex: 60,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  placementBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
    maxWidth: 300,
  },
  placementBannerText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  placementBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  placementBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  placementPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  placedCountBadge: {
    marginLeft: 'auto',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  placedCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  placementDoneBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 999,
  },
  placementDoneText: {
    fontSize: 14,
    fontWeight: '700',
  },
  compassOverlay: {
    // (unused)
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
  hamburgerBtn: {
    position: 'absolute',
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  hamburgerLines: {
    gap: 4,
    alignItems: 'center',
  },
  hamburgerLine: {
    height: 2,
    borderRadius: 1,
  },
});
