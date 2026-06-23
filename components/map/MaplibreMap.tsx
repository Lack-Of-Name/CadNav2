import DownloadProgressOverlay from '@/components/DownloadProgressOverlay';
import { GridReferenceModal } from '@/components/GridReferenceModal';
import { ProjectPointModal } from '@/components/ProjectPointModal';
import { AddToRouteModal } from '@/components/map/AddToRouteModal';
import { CheckpointModeDrawer } from '@/components/map/CheckpointModeDrawer';
import { CompassOverlay } from '@/components/map/CompassOverlay';
import { MapPlacementHud, type PlacementHudMode } from '@/components/map/MapPlacementHud';
import { MAP_TOOL_BUTTON_SIZE, MapToolButton } from '@/components/map/MapToolButton';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useCheckpoints } from '@/hooks/checkpoints';
import { resolveDisplayHeading, useGPS } from '@/hooks/gps';
import { useOfflineMaps } from '@/hooks/offline-maps';
import { getMapStyleUrl, useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useWorkspaceRoutes } from '@/hooks/use-workspace-routes';
import { DEFAULT_ROUTE_COLOR } from '@/constants/routeColors';
import type { Checkpoint, WorkspaceRoute } from '@/types';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '../themed-view';
import { contrastingTextColor } from '@/lib/colorUtils';
import { getMaplibreModule } from '@/lib/maplibreModule';
import { bearingDegrees, haversineMeters } from './MaplibreMap.utils';
import { degreesToMils } from './converter';
import { computeGridCornersFromMapBounds, formatGridReference, generateGridPoints, latLonToGridCoords } from './mapGrid';

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
  const { checkpoints, selectCheckpoint, selectedId, selectedCheckpoint, placementModeRequested, requestPlacementMode, cancelPlacementMode, addCheckpoint, activeRouteColor, activeRouteStart, activeRouteLoop, viewTarget, consumeViewTarget, setActiveRouteStart, setCheckpointLabel, setViewTarget, activeWorkspaceRouteTitle, stashedRouteState, beginTempNavigation, resumeStashedRoute, setActiveWorkspaceRoute, setActiveRouteColor, setActiveRouteLoop, reorderCheckpoints } = useCheckpoints();
  const { angleUnit, mapHeading, mapGridEnabled, mapGridOrigin, gridConvergence, mapGridSubdivisionsEnabled, mapGridNumbersEnabled, mapLayer, gpsMode } = useSettings();
  const { routes: workspaceRoutes, setRoutes: setWorkspaceRoutes, setActiveRouteId: persistActiveRouteId } = useWorkspaceRoutes();
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
  }, [mapStyle, androidStyleRetryToken, apiKey]);
  
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
  const programmaticMoveRef = useRef(false);
  const programmaticMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followingMoveRef = useRef(false);
  const lastRegionStampRef = useRef(0);
  const lastSettledCameraRef = useRef<{ lng: number; lat: number; zoom: number } | null>(null);
  const lastBoundsUpdateRef = useRef(0);
  const pendingViewTargetRef = useRef<{ latitude: number; longitude: number; zoom?: number } | null>(null);
  const pendingLocationRecenterRef = useRef(false);
  const pendingLocationRecenterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setFollowing] = useState(false);
  const [locationRecenterPending, setLocationRecenterPending] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [visibleBounds, setVisibleBounds] = useState<[[number, number], [number, number]] | null>(null);

  const [menuOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [gridPlacementOpen, setGridPlacementOpen] = useState(false);
  const [projectPlacementOpen, setProjectPlacementOpen] = useState(false);
  const [addToRouteOpen, setAddToRouteOpen] = useState(false);
  const [, setMapCenter] = useState<{ latitude: number; longitude: number }>(() => {
    if (lastLocation?.coords) {
      return { latitude: lastLocation.coords.latitude, longitude: lastLocation.coords.longitude };
    }
    return { latitude: -37.8136, longitude: 144.9631 };
  });


  const menuTranslateX = useSharedValue(-300);

  useEffect(() => {
    menuTranslateX.value = withTiming(menuOpen ? 0 : -300, { duration: 250 });
  }, [menuOpen, menuTranslateX]);

  const tempTargetColor = Colors[colorScheme].tempTarget;
  const tempTargetActive = activeRouteColor === tempTargetColor || activeRouteColor === Colors.light.tempTarget;
  const mapGridOriginForRef = mapGridOrigin ?? { latitude: -37.8136, longitude: 144.9631 };
  const toolGap = 8;
  const toolsRight = insets.right + 10;
  const toolsBottom = insets.bottom + 10;
  const hudBottomInset = 118;
  const bannerAccent = activeRouteColor ?? tempTargetColor;
  const bannerAccentText = contrastingTextColor(bannerAccent);
  const compassHeadingDeg = (() => {
    if (!lastLocation) return null;
    // Honour the true/magnetic preference but fall back to whichever the device
    // actually reports. Android has no native trueHeading, so without this the
    // compass dial freezes until a true heading can be computed.
    const resolved = resolveDisplayHeading(
      mapHeading,
      lastLocation.coords.magHeading ?? null,
      lastLocation.coords.trueHeading ?? null,
    );
    return resolved ? resolved.value : null;
  })();

  const compassHeadingRefLabel = (() => {
    if (compassHeadingDeg == null || !lastLocation) return null;
    const resolved = resolveDisplayHeading(
      mapHeading,
      lastLocation.coords.magHeading ?? null,
      lastLocation.coords.trueHeading ?? null,
    );
    // Label reflects what we actually used, so a fallback to magnetic is honest.
    return resolved?.reference === 'true' ? 'True' : 'Magnetic';
  })();

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

  const compassTargetRelativeRotationDeg: number | null = (() => {
    if (compassTargetBearingDeg == null) return null;
    if (compassHeadingDeg == null) return compassTargetBearingDeg;
    return ((compassTargetBearingDeg - compassHeadingDeg) % 360 + 360) % 360;
  })();

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
    ? selectedCheckpoint.label?.trim() || `Waypoint ${selectedIndex + 1}`
    : 'No temp target';
  const targetBearingDescriptor = compassTargetBearingDeg != null
    ? angleUnit === 'mils'
      ? `Brg ${compassBearingMilsText ?? '—'} mils`
      : `Brg ${compassBearingDegreesText ?? '—'}`
    : 'Awaiting GPS fix';
  const summaryAccent = tempTargetActive ? tempTargetColor : (compassTargetColor ?? activeRouteColor ?? tempTargetColor);
  const placementHudMode: PlacementHudMode = placementModeRequested
    ? 'placing'
    : selectedCheckpoint
      ? 'nav'
      : 'idle';
  const activeRouteLabel = activeWorkspaceRouteTitle && !tempTargetActive ? activeWorkspaceRouteTitle : null;
  const idleHudDetail = tempTargetActive
    ? 'Target on map — open compass for full bearing disk'
    : activeRouteLabel
      ? `${checkpoints.length} waypoint${checkpoints.length === 1 ? '' : 's'} · open Routes to edit`
      : 'Quick single-point navigation from the map';

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

  const markProgrammaticCameraMove = useCallback((durationMs: number, isFollowing = false) => {
    const holdMs = Math.max(durationMs + 100, 2500);
    console.log(`[DEBUG] markProgrammaticCameraMove — setting flags durationMs=${durationMs} holdMs=${holdMs} isFollowing=${isFollowing} programmaticMoveRef was=${programmaticMoveRef.current}`);
    programmaticMoveRef.current = true;
    if (isFollowing) followingMoveRef.current = true;
    if (programmaticMoveTimerRef.current) {
      clearTimeout(programmaticMoveTimerRef.current);
    }
    programmaticMoveTimerRef.current = setTimeout(() => {
      console.log(`[DEBUG] markProgrammaticCameraMove timer — clearing programmaticMoveRef (was=${programmaticMoveRef.current}) after ${holdMs}ms — remounting Camera to clear native state`);
      programmaticMoveRef.current = false;
      programmaticMoveTimerRef.current = null;
      setCameraKey((k) => k + 1); // Force Camera remount to clear native commanded position
    }, holdMs);
  }, []);

  useEffect(() => {
    return () => {
      if (programmaticMoveTimerRef.current) {
        clearTimeout(programmaticMoveTimerRef.current);
      }
      if (pendingLocationRecenterTimerRef.current) {
        clearTimeout(pendingLocationRecenterTimerRef.current);
      }
    };
  }, []);

  const stopFollowingFromUserGesture = useCallback((force = false) => {
    console.log(`[DEBUG] stopFollowingFromUserGesture called force=${force} followingMoveRef=${followingMoveRef.current} programmaticMoveRef=${programmaticMoveRef.current}`);
    if (!force && (followingMoveRef.current || programmaticMoveRef.current)) {
      console.log(`[DEBUG] stopFollowingFromUserGesture — bailing (not forced and flags set)`);
      return;
    }
    followingMoveRef.current = false;
    setFollowing((prev) => {
      if (prev) console.log(`[DEBUG] stopFollowingFromUserGesture — setting following=false`);
      return prev ? false : prev;
    });
  }, []);

  const flyCameraTo = useCallback((
    center: [number, number],
    opts?: { zoomLevel?: number; durationMs?: number; isFollowing?: boolean; caller?: string },
  ) => {
    if (!cameraRef.current) {
      console.log(`[DEBUG] flyCameraTo by="${opts?.caller}" — FAILED no cameraRef`);
      return false;
    }
    const durationMs = opts?.durationMs ?? 1000;
    console.log(
      `[ZOOM TO LOCATION] flyCameraTo called by="${opts?.caller ?? 'unknown'}" ` +
      `center=[${center[0].toFixed(6)}, ${center[1].toFixed(6)}] ` +
      `zoom=${opts?.zoomLevel ?? 'unchanged'} duration=${durationMs}ms ` +
      `isFollowing=${!!opts?.isFollowing}\n` +
      (new Error().stack ?? '')
    );
    markProgrammaticCameraMove(durationMs, opts?.isFollowing ?? false);
    console.log(`[DEBUG] flyCameraTo — calling setCamera programmaticMoveRef=${programmaticMoveRef.current} followingMoveRef=${followingMoveRef.current}`);
    cameraRef.current.setCamera({
      centerCoordinate: center,
      ...(opts?.zoomLevel != null ? { zoomLevel: opts.zoomLevel } : {}),
      animationDuration: durationMs,
      animationMode: durationMs === 0 ? 'moveTo' : 'flyTo',
    });
    return true;
  }, [markProgrammaticCameraMove]);

  const applyViewTarget = useCallback((target: { latitude: number; longitude: number; zoom?: number }, caller?: string) => {
    if (!flyCameraTo([target.longitude, target.latitude], { zoomLevel: target.zoom ?? 14, durationMs: 1000, caller: caller ?? 'applyViewTarget' })) {
      pendingViewTargetRef.current = target;
      return;
    }
    pendingViewTargetRef.current = null;
    setFollowing(false);
  }, [flyCameraTo]);

  const clearPendingLocationRecenter = useCallback(() => {
    pendingLocationRecenterRef.current = false;
    setLocationRecenterPending(false);
    if (pendingLocationRecenterTimerRef.current) {
      clearTimeout(pendingLocationRecenterTimerRef.current);
      pendingLocationRecenterTimerRef.current = null;
    }
  }, []);

  const queuePendingLocationRecenter = useCallback(() => {
    pendingLocationRecenterRef.current = true;
    setLocationRecenterPending(true);
    if (pendingLocationRecenterTimerRef.current) {
      clearTimeout(pendingLocationRecenterTimerRef.current);
    }
    pendingLocationRecenterTimerRef.current = setTimeout(() => {
      clearPendingLocationRecenter();
    }, 10000);
  }, [clearPendingLocationRecenter]);

  const centerOnLocation = useCallback((loc: any, caller?: string) => {
    if (!loc?.coords || !cameraRef.current) {
      console.log(`[DEBUG] centerOnLocation by="${caller}" — FAILED noCoords=${!loc?.coords} noCamera=${!cameraRef.current}`);
      return false;
    }
    const { latitude, longitude } = loc.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      console.log(`[DEBUG] centerOnLocation by="${caller}" — FAILED invalid coords lat=${latitude} lon=${longitude}`);
      return false;
    }
    console.log(`[ZOOM TO LOCATION] centerOnLocation called by="${caller ?? 'unknown'}" lat=${latitude.toFixed(6)} lon=${longitude.toFixed(6)}`);
    // Use flyTo (minimum 1ms) on all platforms — moveTo (0ms) triggers native MapLibre oscillation on Android.
    return flyCameraTo([longitude, latitude], { zoomLevel: 14, durationMs: Platform.OS === 'android' ? 1 : 1000, caller: caller ?? 'centerOnLocation' });
  }, [flyCameraTo]);

  const handleRecenterPress = useCallback(() => {
    console.log(`[ZOOM TO LOCATION] handleRecenterPress — user tapped Recenter button hasLocation=${!!lastLocation?.coords} cameraReady=${cameraReady} programmaticMoveRef=${programmaticMoveRef.current} followingMoveRef=${followingMoveRef.current}`);
    if (Platform.OS !== 'android') {
      requestLocation();
    }
    setFollowing(false);
    if (centerOnLocation(lastLocation, 'handleRecenterPress')) {
      console.log('[DEBUG] handleRecenterPress — centerOnLocation succeeded, clearing pending');
      clearPendingLocationRecenter();
      return;
    }
    console.log('[DEBUG] handleRecenterPress — centerOnLocation failed, queuing pending');
    queuePendingLocationRecenter();
  }, [centerOnLocation, clearPendingLocationRecenter, lastLocation, queuePendingLocationRecenter, requestLocation, cameraReady]);

  const openPlacementChooser = () => {
    setChooserOpen(true);
  };

  const startPlacementFlow = async (mode: 'tap' | 'grid' | 'project') => {
    await requestPlacementMode('temp');
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
    await beginTempNavigation();
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

  const handleAddTargetToRoute = (route: WorkspaceRoute) => {
    if (!selectedCheckpoint) return;
    const cp: Checkpoint = selectedCheckpoint;
    const color = route.color ?? DEFAULT_ROUTE_COLOR;
    // Append the temp target to the workspace route's checkpoint list.
    setWorkspaceRoutes((r) =>
      r.map((it) =>
        it.id === route.id
          ? { ...it, checkpoints: [...(it.checkpoints ?? []), cp] }
          : it,
      ),
    );
    // Activate the route and load its (now updated) checkpoints with route colour.
    void setActiveWorkspaceRoute(route.id, route.title);
    persistActiveRouteId(route.id);
    setActiveRouteColor(color);
    setActiveRouteLoop(!!route.isLoop);
    const routeCps = (route.checkpoints ?? []).map((c) => ({ ...c, color }));
    reorderCheckpoints([...routeCps, { ...cp, color }]);
  };

  const handleAddTargetToNewRoute = () => {
    if (!selectedCheckpoint) return;
    const cp: Checkpoint = selectedCheckpoint;
    const title = cp.label?.trim() || 'New route';
    const color = DEFAULT_ROUTE_COLOR;
    const newRoute: WorkspaceRoute = {
      id: String(Date.now()),
      title,
      color,
      checkpoints: [cp],
    };
    setWorkspaceRoutes((r) => [newRoute, ...r]);
    persistActiveRouteId(newRoute.id);
    void setActiveWorkspaceRoute(newRoute.id, newRoute.title);
    setActiveRouteColor(color);
    setActiveRouteLoop(false);
    reorderCheckpoints([{ ...cp, color }]);
  };

  const handleDonePlacing = async () => {
    await cancelPlacementMode();
  };

  const handleCancelPlacing = async () => {
    await cancelPlacementMode();
  };

  const handleMarkerPress = async (id: string) => {
    if (selectedId === id) {
      await selectCheckpoint(null);
      return;
    }
    await selectCheckpoint(id);
  };

  // Initialize offline ambient cache on first mount
  useEffect(() => {
    initOffline();
  }, [initOffline]);

  // Consume viewTarget from routes screen (one-shot fly, never re-applied after user pans)
  useEffect(() => {
    if (!viewTarget || !cameraReady) return;
    let cancelled = false;
    const fly = async () => {
      const target = await consumeViewTarget();
      if (!target || cancelled) return;
      console.log(`[ZOOM TO LOCATION] viewTarget effect — consumed viewTarget lat=${target.latitude.toFixed(6)} lon=${target.longitude.toFixed(6)} zoom=${target.zoom}`);
      applyViewTarget(target, 'viewTarget-effect');
    };
    void fly();
    return () => { cancelled = true; };
  }, [viewTarget, cameraReady, consumeViewTarget, applyViewTarget]);

  // Apply a deferred view target once the native camera ref is attached.
  useEffect(() => {
    if (!cameraReady || !pendingViewTargetRef.current) return;
    const target = pendingViewTargetRef.current;
    pendingViewTargetRef.current = null;
    console.log(`[ZOOM TO LOCATION] deferred pendingViewTarget — applying deferred target lat=${target.latitude.toFixed(6)} lon=${target.longitude.toFixed(6)} zoom=${target.zoom}`);
    applyViewTarget(target, 'pendingViewTarget-deferred');
  }, [cameraReady, applyViewTarget]);

  useEffect(() => {
    if (!pendingLocationRecenterRef.current || !cameraReady || !lastLocation) return;
    console.log('[ZOOM TO LOCATION] pendingLocationRecenter effect — attempting recenter on latest location');
    if (centerOnLocation(lastLocation, 'pendingLocationRecenter-effect')) {
      clearPendingLocationRecenter();
    }
  }, [cameraReady, centerOnLocation, clearPendingLocationRecenter, lastLocation]);

  const setMapCameraRef = useCallback((ref: any) => {
    console.log(`[DEBUG] setMapCameraRef called hasRef=${!!ref}`);
    cameraRef.current = ref;
    if (ref) {
      setCameraReady(true);
    }
  }, []);

  const handleMapTouch = useCallback(() => {
    console.log(`[DEBUG] handleMapTouch — user touched map programmaticMoveRef=${programmaticMoveRef.current} followingMoveRef=${followingMoveRef.current}`);
    clearPendingLocationRecenter();
    stopFollowingFromUserGesture(true);
  }, [clearPendingLocationRecenter, stopFollowingFromUserGesture]);

  const handleRegionWillChange = useCallback((ev: any) => {
    const isUserGesture = ev?.properties?.isUserInteraction ?? ev?.isUserInteraction;
    const coords = ev?.geometry?.coordinates;
    const coordStr = coords && Array.isArray(coords) && coords.length >= 2
      ? `[${Number(coords[0]).toFixed(4)}, ${Number(coords[1]).toFixed(4)}]`
      : '?';
    const zoom = ev?.properties?.zoomLevel ?? ev?.properties?.zoom ?? '?';
    console.log(`[DEBUG] handleRegionWillChange isUserGesture=${isUserGesture} zoom=${zoom} center=${coordStr} prog=${programmaticMoveRef.current} fol=${followingMoveRef.current}`);
    if (isUserGesture === true) {
      clearPendingLocationRecenter();
      stopFollowingFromUserGesture(true);
      return;
    }
    if (programmaticMoveRef.current || followingMoveRef.current) return;
    if (isUserGesture === false) return;
    clearPendingLocationRecenter();
    stopFollowingFromUserGesture();
  }, [clearPendingLocationRecenter, stopFollowingFromUserGesture]);

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
    const resolved = resolveDisplayHeading(
      mapHeading,
      lastLocation.coords.magHeading ?? null,
      lastLocation.coords.trueHeading ?? null,
    );
    const orientation = resolved ? resolved.value : null;
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
        onTouchStart={handleMapTouch}
        onTouchMove={handleMapTouch}
        onRegionWillChange={handleRegionWillChange}


        onRegionDidChange={(ev: any) => {
          const zoom = ev?.properties?.zoomLevel ?? ev?.properties?.zoom;
          const coords = ev?.geometry?.coordinates;
          const coordStr = coords && Array.isArray(coords) && coords.length >= 2
            ? `[${Number(coords[0]).toFixed(4)}, ${Number(coords[1]).toFixed(4)}]`
            : '?';
          const lng = coords?.[0] as number | undefined;
          const lat = coords?.[1] as number | undefined;
          console.log(`[DEBUG] onRegionDidChange — zoom=${zoom} center=${coordStr} prog=${programmaticMoveRef.current} fol=${followingMoveRef.current}`);

          // Skip if position hasn't meaningfully changed since last settled event.
          if (
            !programmaticMoveRef.current &&
            typeof zoom === 'number' && typeof lng === 'number' && typeof lat === 'number' &&
            lastSettledCameraRef.current
          ) {
            const prev = lastSettledCameraRef.current;
            if (
              Math.abs(zoom - prev.zoom) < 0.001 &&
              Math.abs(lng - prev.lng) < 1e-6 &&
              Math.abs(lat - prev.lat) < 1e-6
            ) {
              console.log(`[DEBUG] onRegionDidChange — skipped (same position)`);
              return;
            }
          }
          lastSettledCameraRef.current = lng != null && lat != null && typeof zoom === 'number'
            ? { lng, lat, zoom }
            : lastSettledCameraRef.current;

          // Debounce rapid repeated onRegionDidChange (native oscillation guard).
          const now = Date.now();
          if (now - lastRegionStampRef.current < 300 && !programmaticMoveRef.current) {
            console.log(`[DEBUG] onRegionDidChange — skipped (debounce, ${now - lastRegionStampRef.current}ms since last)`);
            return;
          }
          lastRegionStampRef.current = now;

          clearPendingLocationRecenter();
          // Don't call clearProgrammaticCameraMove here — let the timer in
          // markProgrammaticCameraMove handle it (2500ms hold) so that any
          // delayed native region-change events see programmaticMoveRef=true.

          const z = ev?.properties?.zoomLevel ?? ev?.properties?.zoom ?? ev?.zoomLevel;
          if (typeof z === 'number' && Number.isFinite(z) && z !== zoomLevel) {
            setZoomLevel(z);
          }
          
          // Update map center coordinate (skip if unchanged to avoid pointless re-renders)
          if (coords && Array.isArray(coords) && coords.length >= 2) {
            const newLng = coords[0];
            const newLat = coords[1];
            setMapCenter((prev: any) => {
              if (prev && Math.abs(prev.longitude - newLng) < 1e-7 && Math.abs(prev.latitude - newLat) < 1e-7) {
                return prev; // same reference = no re-render
              }
              return { longitude: newLng, latitude: newLat };
            });
          }

          // Keep bounds updated for the grid overlay (throttled to avoid oscillation).
          if (now - lastBoundsUpdateRef.current > 500) {
            lastBoundsUpdateRef.current = now;
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
          }
        }}
        onRegionIsChanging={(ev: any) => {
          const coords = ev?.geometry?.coordinates;
          if (coords && Array.isArray(coords) && coords.length >= 2) {
            setMapCenter({ longitude: coords[0], latitude: coords[1] });
          }

          const isUserGesture = ev?.properties?.isUserInteraction ?? ev?.isUserInteraction;
          const coordStr = coords && Array.isArray(coords) && coords.length >= 2
            ? `[${Number(coords[0]).toFixed(4)}, ${Number(coords[1]).toFixed(4)}]`
            : '?';
          const zoom = ev?.properties?.zoomLevel ?? ev?.properties?.zoom ?? '?';
          console.log(`[DEBUG] onRegionIsChanging isUserGesture=${isUserGesture} zoom=${zoom} center=${coordStr} prog=${programmaticMoveRef.current}`);
          if (isUserGesture === true) {
            clearPendingLocationRecenter();
            stopFollowingFromUserGesture(true);
            return;
          }
          if (programmaticMoveRef.current || followingMoveRef.current) return;
          if (isUserGesture === false) return;
          clearPendingLocationRecenter();
          stopFollowingFromUserGesture();
        }}
      >
        <Camera key={cameraKey} ref={setMapCameraRef} {...(Platform.OS === 'android' ? {} : { followUserLocation: false })} />

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

      <MapPlacementHud
        colorScheme={colorScheme}
        mode={placementHudMode}
        accentColor={summaryAccent}
        textColor={String(textColor)}
        mutedColor={String(borderColor)}
        rightInset={MAP_TOOL_BUTTON_SIZE + toolGap}
        title={activeRouteLabel && placementHudMode === 'idle' ? activeRouteLabel : targetTitle}
        routeLabel={activeRouteLabel}
        detail={placementHudMode === 'nav' ? targetBearingDescriptor : idleHudDetail}
        canResumeRoute={!!stashedRouteState}
        onResumeRoute={() => { void resumeStashedRoute(); }}
        onOpenRoutes={() => router.push('/routes')}
        canAddToRoute={!!selectedCheckpoint}
        onAddToRoute={() => setAddToRouteOpen(true)}
        bearingMils={compassBearingMilsText}
        bearingDegreesText={compassBearingDegreesText}
        bearingRotationDeg={compassTargetRelativeRotationDeg}
        distanceText={compassDistanceText}
        gridRefText={targetGridRefText}
        angleUnit={angleUnit}
        onSetTarget={openPlacementChooser}
        onDonePlacing={() => { void handleDonePlacing(); }}
        onCancelPlacing={() => { void handleCancelPlacing(); }}
        onPrevTarget={handlePrevTarget}
        onNextTarget={handleNextTarget}
        showTargetStepper={!tempTargetActive && checkpoints.length > 1}
        approachProgress={
          placementHudMode === 'nav' && startDistance != null && startDistance > 0 ? currentProgress : null
        }
      />

      <MapToolButton
        icon="location.fill.viewfinder"
        label={locationRecenterPending ? 'Waiting for location' : 'Recenter map'}
        onPress={handleRecenterPress}
        colorScheme={colorScheme}
        active={locationRecenterPending}
        accentColor={String(tint)}
        style={{ position: 'absolute', right: toolsRight, bottom: toolsBottom, zIndex: 50 }}
      />
      <MapToolButton
        icon="safari.fill"
        label="Compass"
        onPress={() => setCompassOpen(true)}
        colorScheme={colorScheme}
        active={compassOpen}
        accentColor={String(tint)}
        style={{
          position: 'absolute',
          right: toolsRight,
          bottom: toolsBottom + MAP_TOOL_BUTTON_SIZE + toolGap,
          zIndex: 50,
        }}
      />
      <MapToolButton
        icon="mappin.and.ellipse"
        label="Set temp target"
        onPress={openPlacementChooser}
        colorScheme={colorScheme}
        active={tempTargetActive || placementModeRequested}
        accentColor={tempTargetColor}
        style={{
          position: 'absolute',
          right: toolsRight,
          bottom: toolsBottom + 2 * (MAP_TOOL_BUTTON_SIZE + toolGap),
          zIndex: 50,
        }}
      />

      <CheckpointModeDrawer
        visible={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onTap={() => { void startPlacementFlow('tap'); }}
        onGrid={() => { void startPlacementFlow('grid'); }}
        onProject={() => { void startPlacementFlow('project'); }}
        disableTap={gpsMode === 'super'}
      />

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

      <AddToRouteModal
        visible={addToRouteOpen}
        routes={workspaceRoutes}
        onClose={() => setAddToRouteOpen(false)}
        onSelectRoute={handleAddTargetToRoute}
        onCreateNew={handleAddTargetToNewRoute}
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
          left: insets.left + 10,
          right: insets.right + 10,
          bottom: insets.bottom + hudBottomInset,
        }}
      />

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
    backgroundColor: 'transparent',
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
