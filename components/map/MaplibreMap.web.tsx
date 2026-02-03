import { alert as showAlert } from '@/components/alert';
import { CompassOverlay } from '@/components/map/CompassOverlay';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { bearingDegrees, CompassButton, haversineMeters, InfoBox, normalizeDegrees, RecenterButton, sleep } from './MaplibreMap.general';
import { degreesToMils } from './converter';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ThemedView } from '../themed-view';
// map grid utilities
import GridOverlay from './gridoverlay.web';

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
  const { checkpoints, selectCheckpoint, selectedId, selectedCheckpoint, placementModeRequested, consumePlacementModeRequest, addCheckpoint, activeRouteColor, activeRouteStart, activeRouteLoop } = useCheckpoints();
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

  const emptyGeo = { type: 'FeatureCollection', features: [] } as any;

  const buildRouteLineGeoJSON = () => {
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
  };

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
  }, [mapReady, checkpoints, activeRouteColor, activeRouteStart, activeRouteLoop]);

  // grid overlay removed

  useEffect(() => {
    if (!map.current || !mapReady) return;
    const handleClick = async (ev: maplibregl.MapMouseEvent) => {
      if (!placementModeRequested) return;
      const { lng, lat } = ev.lngLat;
      await addCheckpoint(lat, lng);
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
        <div ref={mapDiv} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 0 }} />
        {effectiveLastLocation && mapGridEnabled && (
          <GridOverlay
            map={map.current}
            origin={mapGridOrigin ?? { latitude: effectiveLastLocation.coords.latitude, longitude: effectiveLastLocation.coords.longitude }}
            subdivisionsEnabled={mapGridSubdivisionsEnabled}
            numbersEnabled={mapGridNumbersEnabled}
            gridConvergence={typeof gridConvergence === 'number' ? gridConvergence : 0}
          />
        )}
        <InfoBox lastLocation={effectiveLastLocation} mapHeading={mapHeading} angleUnit={angleUnit} containerStyle={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 6, zIndex: 100 }} textStyle={styles.locationText} renderAs="web" />
        <RecenterButton onPress={handleRecenterPress} style={overlayStyles.recenter(following)} color={buttonIconColor} renderAs="web" />
        <CompassButton onPress={() => setCompassOpen(true)} style={overlayStyles.floatingButton(12 + 58, compassOpen)} color={compassButtonColor} active={compassOpen} renderAs="web" />
        {/* placement UI removed */}
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
