import { alert as showAlert } from '@/components/alert';
import { degreesToMils } from '@/components/map/converter';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
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

export default function MapLibreMap() {
  const { apiKey, loading } = useMapTilerKey();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const lastLocationRef = useRef<typeof lastLocation | null>(null);
  const lastLocationLossTimer = useRef<number | null>(null);
  const errorReportedRef = useRef(false);
  const { lastLocation, requestLocation } = useGPS();
  const { angleUnit, mapHeading } = useSettings();
  const { checkpoints, selectedCheckpoint, selectCheckpoint, addCheckpoint } = useCheckpoints();
  const colorScheme = useColorScheme() ?? 'light';
  const iconColor = useThemeColor({}, 'tabIconDefault');
  const tabIconSelected = useThemeColor({}, 'tabIconSelected');
  const tint = useThemeColor({}, 'tint');
  const markerPole = Colors.light.text;
  const [following, setFollowing] = useState(false);
  const buttonIconColor = following ? tabIconSelected : (colorScheme === 'light' ? tint : iconColor);
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [orientation, setOrientation] = useState<number | null>(null);
  const [mapBearing, setMapBearing] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [placementMode, setPlacementMode] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const placementModeRef = useRef(false);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateViewport = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);
  
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

  // Normalize degrees to [0,360)
  const normalizeDegrees = (d: number) => ((d % 360) + 360) % 360;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const bearingDegrees = (fromLat: number, fromLon: number, toLat: number, toLon: number) => {
    const phi1 = toRad(fromLat);
    const phi2 = toRad(toLat);
    const deltaLambda = toRad(toLon - fromLon);
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    return normalizeDegrees(toDeg(Math.atan2(y, x)));
  };

  const haversineMeters = (fromLat: number, fromLon: number, toLat: number, toLon: number) => {
    const R = 6371000;
    const phi1 = toRad(fromLat);
    const phi2 = toRad(toLat);
    const deltaPhi = toRad(toLat - fromLat);
    const deltaLambda = toRad(toLon - fromLon);
    const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const currentHeading = (() => {
    const useMag = mapHeading === 'magnetic';
    return useMag ? lastLocation?.coords.magHeading : lastLocation?.coords.trueHeading;
  })();

  const checkpointBearing =
    lastLocation && selectedCheckpoint
      ? bearingDegrees(
          lastLocation.coords.latitude,
          lastLocation.coords.longitude,
          selectedCheckpoint.latitude,
          selectedCheckpoint.longitude
        )
      : null;

  const relativeArrowRotation =
    checkpointBearing == null
      ? null
      : normalizeDegrees(checkpointBearing - (currentHeading ?? 0) - mapBearing);

  const checkpointDistanceMeters =
    lastLocation && selectedCheckpoint
      ? haversineMeters(
          lastLocation.coords.latitude,
          lastLocation.coords.longitude,
          selectedCheckpoint.latitude,
          selectedCheckpoint.longitude
        )
      : null;

  // Small subcomponents keep the return() markup readable
  function RecenterButton({ onPress }: { onPress: () => void }) {
    return (
      <div onClick={onPress} role="button" aria-label="Recenter map" style={overlayStyles.recenter(following)}>
        <IconSymbol size={28} name="location.fill.viewfinder" color={String(buttonIconColor)} />
      </div>
    );
  }

  function CompassButton() {
    return (
      <div onClick={() => setCompassOpen((v) => !v)} role="button" aria-label="Compass" style={overlayStyles.floatingButton(12 + 58, compassOpen)}>
        <IconSymbol size={26} name="location.north.line" color={String(compassOpen ? tabIconSelected : buttonIconColor)} />
      </div>
    );
  }

  function PlacementButton() {
    return (
      <div
        onClick={() => {
          setPlacementMode((v) => !v);
          if (!placementModeRef.current) {
            setCompassOpen(false);
          }
        }}
        role="button"
        aria-label="Placement mode"
        style={overlayStyles.floatingButton(12 + 58 + 58, placementMode)}
      >
        <IconSymbol size={26} name="flag.fill" color={String(placementMode ? tabIconSelected : buttonIconColor)} />
      </div>
    );
  }

  function CompassOverlay() {
    if (!compassOpen) return null;
    const hasTarget = !!(selectedCheckpoint && lastLocation);

    const useMag = mapHeading === 'magnetic';
    const heading = currentHeading;
    const headingText =
      heading == null
        ? '—'
        : angleUnit === 'mils'
          ? `${Math.round(degreesToMils(heading, { normalize: true }))} mils`
          : `${heading.toFixed(0)}°`;

    const bearingText =
      checkpointBearing == null
        ? '—'
        : angleUnit === 'mils'
          ? `${Math.round(degreesToMils(checkpointBearing, { normalize: true }))} mils`
          : `${checkpointBearing.toFixed(0)}°`;

    const distanceText =
      checkpointDistanceMeters == null
        ? '—'
        : checkpointDistanceMeters >= 1000
          ? `${(checkpointDistanceMeters / 1000).toFixed(2)} km`
          : `${Math.round(checkpointDistanceMeters)} m`;

    const bg = colorScheme === 'dark' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)';
    const fg = colorScheme === 'dark' ? 'white' : 'black';
    const subtle = colorScheme === 'dark' ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)';

    const vw = viewport.w || (typeof window !== 'undefined' ? window.innerWidth : 9999);
    const vh = viewport.h || (typeof window !== 'undefined' ? window.innerHeight : 9999);
    const panelWidth = Math.max(240, Math.min(360, vw - 24));

    const dialSize = Math.max(160, Math.min(220, panelWidth - 140, vh - 240));
    const center = dialSize / 2;
    const scale = dialSize / 220;
    const outerPad = 6 * scale;

    const ticks = Array.from({ length: 36 }, (_, i) => i * 10);
    const ringRotation = heading == null ? 0 : -heading;

    return (
      <div
        style={{
          position: 'absolute',
          left: vw < 420 ? 12 : 12 + 58,
          right: vw < 420 ? 12 : undefined,
          bottom: 12 + 58,
          zIndex: 60,
          padding: 14,
          borderRadius: 18,
          border: `1.5px solid ${String(tint)}`,
          width: panelWidth,
          backgroundColor: bg,
          color: fg,
          fontFamily: String(Fonts.sans),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexDirection: 'row' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Compass</div>
            <div style={{ marginTop: 2, fontSize: 13, color: subtle, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hasTarget
                ? `Target: ${selectedCheckpoint?.label?.trim() ? selectedCheckpoint.label.trim() : 'Checkpoint'}`
                : 'No checkpoint selected'}
            </div>
          </div>

          <div
            onClick={() => setCompassOpen(false)}
            role="button"
            aria-label="Close compass"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: `1.5px solid ${String(tint)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none',
              color: fg,
            }}
          >
            <span style={{ fontSize: 22, lineHeight: '22px', marginTop: -2 }}>×</span>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg
            width={dialSize}
            height={dialSize}
            viewBox={`0 0 ${dialSize} ${dialSize}`}
            style={{ fontFamily: String(Fonts.sans) }}
          >
            <circle cx={center} cy={center} r={center - 2} fill={bg} stroke={String(tint)} strokeWidth={1.5} />

            <g transform={`rotate(${ringRotation} ${center} ${center})`}>
              {ticks.map((deg) => {
                const isCardinal = deg % 90 === 0;
                const isMajor = deg % 30 === 0;
                const len = (isCardinal ? 16 : isMajor ? 12 : 7) * scale;
                const stroke = isCardinal || isMajor ? fg : subtle;
                const strokeWidth = (isCardinal ? 3 : isMajor ? 2 : 1) * scale;

                const label =
                  deg === 0
                    ? 'N'
                    : deg === 90
                      ? 'E'
                      : deg === 180
                        ? 'S'
                        : deg === 270
                          ? 'W'
                          : deg % 30 === 0
                            ? String(deg)
                            : null;

                return (
                  <g key={deg} transform={`rotate(${deg} ${center} ${center})`}>
                    <line
                      x1={center}
                      y1={outerPad}
                      x2={center}
                      y2={outerPad + len}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />
                    {label ? (
                      <text
                        x={center}
                        y={28 * scale}
                        textAnchor="middle"
                        fontSize={(deg % 90 === 0 ? 14 : 10) * scale}
                        fontWeight={800}
                        fill={deg % 90 === 0 ? fg : subtle}
                      >
                        {label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>

            {/* Fixed north needle */}
            <line x1={center} y1={center} x2={center} y2={26 * scale} stroke={String(tint)} strokeWidth={3 * scale} strokeLinecap="round" />

            {/* Target pointer */}
            {hasTarget && relativeArrowRotation != null ? (
              <g transform={`rotate(${relativeArrowRotation} ${center} ${center})`}>
                <path d={`M ${center} ${34 * scale} L ${center - 10 * scale} ${54 * scale} L ${center} ${48 * scale} L ${center + 10 * scale} ${54 * scale} Z`} fill={String(tint)} />
              </g>
            ) : null}
          </svg>
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: subtle }}>Heading</div>
              <div style={{ marginTop: 2, fontSize: 16, fontWeight: 800, color: fg }}>{headingText}</div>
              <div style={{ marginTop: 1, fontSize: 12, fontWeight: 700, color: subtle }}>{useMag ? 'Magnetic' : 'True'}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: subtle }}>Bearing</div>
              <div style={{ marginTop: 2, fontSize: 16, fontWeight: 800, color: fg }}>{bearingText}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: subtle }}>Distance</div>
              <div style={{ marginTop: 2, fontSize: 16, fontWeight: 800, color: fg }}>{distanceText}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function LocationMarker({ x, y, orientation }: { x: number; y: number; orientation: number | null }) {
    return (
      <div style={{ position: 'absolute', left: x - 12, top: y - 12, pointerEvents: 'none' }}>
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

  function InfoBox() {
    if (!lastLocation) return null;
    const useMag = mapHeading === 'magnetic';
    const h = useMag ? lastLocation.coords.magHeading : lastLocation.coords.trueHeading;
    const headingText = h == null
      ? '—'
      : `${angleUnit === 'mils' ? `${Math.round(degreesToMils(h, { normalize: true }))} mils` : `${h.toFixed(0)}°`} — ${useMag ? 'Magnetic' : 'True'}`;

    return (
      <div style={{ position: 'absolute', top: placementMode ? 72 : 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 6 }}>
        <Text style={styles.locationText}>Lat: {lastLocation.coords.latitude.toFixed(6)}</Text>
        <br />
        <Text style={styles.locationText}>Lon: {lastLocation.coords.longitude.toFixed(6)}</Text>
        <br />
        <Text style={styles.locationText}>Alt: {lastLocation.coords.altitude == null ? '—' : `${lastLocation.coords.altitude.toFixed(0)} m`}</Text>
        <br />
        <Text style={styles.locationText}>Heading: {headingText}</Text>
      </div>
    );
  }

  // Sleep helper function
  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  useEffect(() => {
    placementModeRef.current = placementMode;
  }, [placementMode]);

  // Manage maplibre-gl Marker instances for checkpoints
  const checkpointMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const CHECKPOINT_MARKER_VERSION = '5';

  useEffect(() => {
    if (!map.current) return;

    const svgNS = 'http://www.w3.org/2000/svg';

    const applyStyle = (el: HTMLElement, flagColor: string, poleColor: string, selected: boolean, labelText: string | null, showLabel: boolean) => {
      const svg = el.querySelector('svg[data-checkpoint-flag="1"]') as SVGSVGElement | null;
      if (!svg) return;
      const flag = svg.querySelector('#flag') as SVGPathElement | null;
      const label = el.querySelector('[data-checkpoint-label="1"]') as HTMLDivElement | null;
      if (flag) {
        flag.setAttribute('fill', flagColor);
        flag.setAttribute('stroke', 'none');
      }
      if (label) {
        label.textContent = labelText ?? '';
        label.style.display = showLabel ? 'block' : 'none';
        label.style.border = selected ? `1.5px solid ${poleColor}` : `1px solid ${poleColor}`;
      }
    };

    const markers = checkpointMarkersRef.current;
    const current = checkpoints;
    const currentIds = new Set(current.map((c) => c.id));

    // Remove markers that no longer exist (or that were rendered with an older layout/anchor)
    for (const [id, marker] of markers.entries()) {
      const el = marker.getElement();
      const version = el?.getAttribute('data-checkpoint-marker-version');
      if (!currentIds.has(id) || version !== CHECKPOINT_MARKER_VERSION) {
        marker.remove();
        markers.delete(id);
      }
    }

    // Add missing markers
    for (const cp of current) {
      if (markers.has(cp.id)) continue;

      const poleColor = String(markerPole);
      const flagColor = poleColor;

      const labelText = cp.label?.trim() ? cp.label.trim() : null;
      const showLabel = zoomLevel >= 14 && !!labelText;

      const el = document.createElement('div');
      el.setAttribute('data-checkpoint-marker-version', CHECKPOINT_MARKER_VERSION);
      el.style.width = '32px';
      el.style.height = '32px';
      // IMPORTANT: don't override the `position: absolute` styling from maplibre-gl's
      // `.maplibregl-marker` class. If we set `position: relative` here, the marker
      // participates in normal layout and each additional marker can shift others.
      // `position: absolute` also works as a containing block for our absolutely-positioned
      // children.
      el.style.position = 'absolute';
      el.style.display = 'block';
      el.style.cursor = 'pointer';

      const label = document.createElement('div');
      label.setAttribute('data-checkpoint-label', '1');
      label.style.maxWidth = '160px';
      label.style.padding = '4px 8px';
      label.style.borderRadius = '8px';
      label.style.background = 'rgba(0,0,0,1)';
      label.style.color = 'white';
      label.style.fontSize = '12px';
      label.style.fontWeight = '600';
      label.style.whiteSpace = 'nowrap';
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      label.style.position = 'absolute';
      // Place label above and to the right of the pole base.
      label.style.left = '22px';
      label.style.bottom = '24px';
      label.style.display = showLabel ? 'block' : 'none';
      label.textContent = labelText ?? '';

      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('data-checkpoint-flag', '1');
      svg.setAttribute('width', '32');
      svg.setAttribute('height', '32');
      svg.setAttribute('viewBox', '0 0 447.514 447.514');
      svg.style.display = 'block';
      svg.style.position = 'absolute';
      svg.style.left = '0';
      svg.style.bottom = '0';

      const flag = document.createElementNS(svgNS, 'path');
      flag.setAttribute('id', 'flag');
      flag.setAttribute('d', 'M389.183,10.118c-3.536-2.215-7.963-2.455-11.718-0.634l-50.653,24.559c-35.906,17.409-77.917,16.884-113.377-1.418c-38.094-19.662-83.542-18.72-120.789,2.487V20c0-11.046-8.954-20-20-20s-20,8.954-20,20v407.514c0,11.046,8.954,20,20,20s20-8.954,20-20V220.861c37.246-21.207,82.694-22.148,120.789-2.487c35.46,18.302,77.47,18.827,113.377,1.418l56.059-27.18c7.336-3.557,11.995-10.993,11.995-19.146V20.385C394.866,16.212,392.719,12.333,389.183,10.118z');
      flag.setAttribute('fill', flagColor);

      svg.appendChild(flag);
      el.appendChild(label);
      el.appendChild(svg);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        void selectCheckpoint(cp.id);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom-left', offset: [-4, 0] as any })
        .setLngLat([cp.longitude, cp.latitude])
        .addTo(map.current!);
      markers.set(cp.id, marker);
    }

    // Update styling for existing markers (selection/theme changes)
    for (const cp of current) {
      const marker = markers.get(cp.id);
      if (!marker) continue;
      const el = marker.getElement();
      const selected = selectedCheckpoint?.id === cp.id;
      const poleColor = String(markerPole);
      const flagColor = poleColor;
      const labelText = cp.label?.trim() ? cp.label.trim() : null;
      const showLabel = zoomLevel >= 14 && !!labelText;
      applyStyle(el, flagColor, poleColor, selected, labelText, showLabel);
    }
  }, [checkpoints, selectedCheckpoint?.id, selectCheckpoint, markerPole, zoomLevel]);

  // Placement mode: click map to drop a checkpoint
  useEffect(() => {
    if (loading || !apiKey) return;
    if (map.current) return; // stops map from initializing more than once
    if (!mapContainer.current) return;
    if (!mapDiv.current) return;

    const mapStyle = `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${apiKey}`;

    map.current = new maplibregl.Map({
      container: mapDiv.current,
      style: mapStyle,
      center: [0, 0],
      zoom: 1
    });

    // Update bearing and projected screen position when map events fire
    const update = () => {
      if (!map.current) return;
      try {
        const b = typeof map.current.getBearing === 'function' ? map.current.getBearing() : 0;
        setMapBearing(b);
        const z = typeof map.current.getZoom === 'function' ? map.current.getZoom() : 1;
        if (Number.isFinite(z)) setZoomLevel(z);
      } catch (err) {
        if (!errorReportedRef.current) {
          errorReportedRef.current = true;
          void showAlert({ title: 'MapLibreMap', message: String(err) });
        }
      }
      const ll = lastLocationRef.current;
      if (ll && map.current) {
          try {
            const p = map.current.project([ll.coords.longitude, ll.coords.latitude]);
            setScreenPos({ x: p.x, y: p.y });
          } catch (err) {
            if (!errorReportedRef.current) {
              errorReportedRef.current = true;
              void showAlert({ title: 'MapLibreMap', message: String(err) });
            }
            setScreenPos(null);
          }
      }
    };

    map.current.on('load', update);
    map.current.on('move', update);
    map.current.on('zoom', update);

    map.current.on('click', (e) => {
      if (!placementModeRef.current) return;
      const lng = e.lngLat?.lng;
      const lat = e.lngLat?.lat;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      void addCheckpoint(lat, lng);
      setCompassOpen(true);
    });
    // initial update
    setTimeout(update, 0);

    // Lock map orientation to north-up: disable user rotation and force bearing 0
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
      // ignore if methods are unavailable
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
  }, [apiKey, loading, addCheckpoint]);

  // Dashed route line between checkpoints
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;

    const sourceId = 'checkpoint-route';
    const layerId = 'checkpoint-route-line';
    const data = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: checkpoints.map((cp) => [cp.longitude, cp.latitude]),
      },
    } as const;

    const ensure = () => {
      try {
        const existing = m.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        if (!existing) {
          m.addSource(sourceId, { type: 'geojson', data } as any);
        } else {
          existing.setData(data as any);
        }

        if (!m.getLayer(layerId)) {
          m.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': String(markerPole),
              'line-width': 2,
              'line-opacity': 0.9,
              'line-dasharray': [1.5, 1.5],
            },
          } as any);
        }
      } catch {
        // ignore if map not ready yet
      }
    };

    if (typeof m.isStyleLoaded === 'function' && !m.isStyleLoaded()) {
      m.once('load', ensure);
    } else {
      ensure();
    }

    // Hide the line when fewer than 2 checkpoints.
    try {
      if (m.getLayer(layerId)) {
        m.setLayoutProperty(layerId, 'visibility', checkpoints.length >= 2 ? 'visible' : 'none');
      }
    } catch {
      // ignore
    }
  }, [checkpoints, markerPole]);

  // keep a ref copy of lastLocation so event handlers see latest value
  useEffect(() => {
    lastLocationRef.current = lastLocation;
  }, [lastLocation]);

  useEffect(() => {
    // If lastLocation is present, cancel any pending clear and update immediately
    if (lastLocation) {
      if (lastLocationLossTimer.current) {
        window.clearTimeout(lastLocationLossTimer.current);
        lastLocationLossTimer.current = null;
      }
      if (!map.current) return;
      try {
        const p = map.current.project([lastLocation.coords.longitude, lastLocation.coords.latitude]);
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
  }, [lastLocation]);

  useEffect(() => {
    if (!following || !lastLocation || !map.current) return;
    const { latitude, longitude } = lastLocation.coords;
    try {
      map.current.flyTo({ center: [longitude, latitude] });
    } catch (err) {
      if (!errorReportedRef.current) {
        errorReportedRef.current = true;
        void showAlert({ title: 'MapLibreMap', message: String(err) });
      }
      // ignore
    }
  }, [lastLocation, following]);

  // Compute the orientation (degrees) for the arrow based on device heading
  useEffect(() => {
    if (!lastLocation) {
      setOrientation(null);
      return;
    }
    const useMag = mapHeading === 'magnetic';
    const h = useMag ? lastLocation.coords.magHeading : lastLocation.coords.trueHeading;
    if (h == null) {
      setOrientation(null);
      return;
    }
    // Use the device heading directly (no inversion) and subtract map bearing
    const raw = h - mapBearing;
    const normalized = normalizeDegrees(raw);
    setOrientation(normalized);
  }, [lastLocation, mapBearing, mapHeading]);

  const handleRecenterPress = async () => {
    if (!lastLocation) {
      requestLocation();
      return;
    }
    const enabling = !following;
    if (enabling && lastLocation && map.current) {
      const { latitude, longitude } = lastLocation.coords;
      try {
        map.current.flyTo({ center: [longitude, latitude], zoom: 16, duration: 1000, essential: true });
      } catch (err) {
        if (!errorReportedRef.current) {
          errorReportedRef.current = true;
          void showAlert({ title: 'MapLibreMap', message: String(err) });
        }
        // ignore
      }
    }
    await sleep(1000)
    setFollowing(enabling);
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
      <div ref={mapContainer} style={{ width: '100%', height: '100%', position: 'relative' }}>
        <div ref={mapDiv} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 0 }} />
        <RecenterButton onPress={handleRecenterPress} />
        <CompassButton />
        <PlacementButton />
        {placementMode ? (
          <div
            onClick={() => setPlacementMode(false)}
            role="button"
            aria-label="Exit placement mode"
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              zIndex: 60,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                pointerEvents: 'auto',
                alignSelf: 'center',
                maxWidth: Math.max(260, Math.min(360, (viewport.w || 9999) - 24)),
                padding: '10px 12px',
                borderRadius: 12,
                border: `1.5px solid ${String(tint)}`,
                background: colorScheme === 'dark' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)',
                color: colorScheme === 'dark' ? 'white' : 'black',
                fontFamily: String(Fonts.sans),
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Placement mode · click map to add checkpoints · tap here to exit
            </div>
          </div>
        ) : null}
        <CompassOverlay />
        {screenPos && <LocationMarker x={screenPos.x} y={screenPos.y} orientation={orientation} />}
        <InfoBox />
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
