import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { useGPS } from '@/hooks/gps';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ThemedView } from '../themed-view';

export default function MapLibreMap() {
  const { apiKey, loading } = useMapTilerKey();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<HTMLDivElement | null>(null);
  const { lastLocation } = useGPS();
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [orientation, setOrientation] = useState<number | null>(null);
  const [mapBearing, setMapBearing] = useState<number>(0);

  useEffect(() => {
    if (loading || !apiKey) return;
    if (map.current) return; // stops map from initializing more than once
    if (!mapContainer.current) return;

    const mapStyle = `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${apiKey}`;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [0, 0],
      zoom: 1
    });

    // Lock map orientation to north-up: disable user rotation and force bearing 0
    try {
      if (map.current.dragRotate && typeof map.current.dragRotate.disable === 'function') {
        map.current.dragRotate.disable();
      }
      if (map.current.touchZoomRotate && typeof map.current.touchZoomRotate.disableRotation === 'function') {
        map.current.touchZoomRotate.disableRotation();
      }
      map.current.setBearing(0);
    } catch (e) {
      // ignore if methods are unavailable
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [apiKey, loading]);

  useEffect(() => {
    if (!map.current || !lastLocation) return;

    // compute screen position for the user's location and update state
    try {
      const p = map.current.project([lastLocation.coords.longitude, lastLocation.coords.latitude]);
      setScreenPos({ x: p.x, y: p.y });
    } catch (e) {
      setScreenPos(null);
    }

    // update position when the map moves or zooms
    const update = () => {
      if (!map.current || !lastLocation) return;
      try {
        const p = map.current.project([lastLocation.coords.longitude, lastLocation.coords.latitude]);
        setScreenPos({ x: p.x, y: p.y });
      } catch (err) {
        // ignore
      }
      try {
        // Keep bearing locked to north-up
        setMapBearing(0);
      } catch (e) {
        // ignore
      }
    };
    map.current.on('move', update);
    map.current.on('zoom', update);

    return () => {
      map.current?.off('move', update);
      map.current?.off('zoom', update);
      setScreenPos(null);
    };
  }, [lastLocation]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;

    const handler = (ev: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const heading = (ev as any).webkitCompassHeading ?? (ev.alpha) ;
      if (heading == null) return;
      // heading is in degrees (0-360) relative to the device's Z axis.
      // Prefer iOS `webkitCompassHeading` when available.
      setOrientation(heading);
    };

    // Try to listen for deviceorientation events. Some browsers (iOS Safari)
    // require a user gesture to grant permission; we simply attach the
    // listener — the page should prompt if necessary.
    window.addEventListener('deviceorientation', handler as EventListener);
    return () => window.removeEventListener('deviceorientation', handler as EventListener);
  }, []);

  if (loading || !apiKey) {
    return (
      <ThemedView style={styles.container}>
        <Text>Waiting for MapTiler API key...</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%', position: 'relative' }} />
      {screenPos && (
        <div style={{ position: 'absolute', left: screenPos.x - 12, top: screenPos.y - 12, pointerEvents: 'none' }}>
          <div style={{ width: 24, height: 24, borderRadius: 12, background: '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/**
             * Compute arrow rotation so it matches Google Maps heading:
             * - Some devices report `alpha` with the opposite sign, so invert it via (360 - alpha).
             * - Subtract the map bearing so the arrow is relative to the map orientation.
             */}
            {(() => {
              return (
                <svg width="14" height="14" viewBox="0 0 24 24" style={{ transform: `rotate(${orientation}deg)` }}>
                  <path d="M12 2 L19 21 L12 17 L5 21 Z" fill="white" />
                </svg>
              );
            })()}
          </div>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 24, height: 24, borderRadius: 12, boxShadow: '0 0 0 6px rgba(0,122,255,0.15)', animation: 'pulse 2s infinite' }} />
        </div>
      )}
      {lastLocation && (
        <div style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 6 }}>
          <Text style={styles.locationText}>Lat: {lastLocation.coords.latitude.toFixed(6)}</Text>
          <br />
          <Text style={styles.locationText}>Lon: {lastLocation.coords.longitude.toFixed(6)}</Text>
          <br />
          <Text style={styles.locationText}>
            Heading:{' '}
            {lastLocation.coords.heading == null
              ? '—'
              : `${lastLocation.coords.heading.toFixed(0)}°`}
          </Text>
        </div>
      )}
      <style>{`@keyframes pulse { 0% { transform: scale(0.9); opacity: 0.6 } 50% { transform: scale(1.4); opacity: 0.15 } 100% { transform: scale(0.9); opacity: 0.6 } }`}</style>
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
});
