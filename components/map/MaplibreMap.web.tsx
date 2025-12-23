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

    // center on the user a bit
    try {
      map.current.easeTo({ center: [lastLocation.coords.longitude, lastLocation.coords.latitude], zoom: 13 });
    } catch (e) {
      // ignore
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
    };
    map.current.on('move', update);
    map.current.on('zoom', update);

    return () => {
      map.current?.off('move', update);
      map.current?.off('zoom', update);
      setScreenPos(null);
    };
  }, [lastLocation]);

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
            <div style={{ width: 10, height: 10, borderRadius: 5, background: 'white' }} />
          </div>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 24, height: 24, borderRadius: 12, boxShadow: '0 0 0 6px rgba(0,122,255,0.15)', animation: 'pulse 2s infinite' }} />
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
});
