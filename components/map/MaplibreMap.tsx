import { degreesToMils } from '@/components/map/converter';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Camera, MapView, UserLocation } from "@maplibre/maplibre-react-native";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '../themed-view';

// Sleep helper function
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function MapLibreMap() {
  const { apiKey, loading } = useMapTilerKey();
  const { lastLocation } = useGPS();
  const { angleUnit, mapHeading } = useSettings();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const iconColor = useThemeColor({}, 'tabIconDefault');
  const tabIconSelected = useThemeColor({}, 'tabIconSelected');
  const tint = useThemeColor({}, 'tint');
  const cameraRef = React.useRef<any>(null);
  const [following, setFollowing] = useState(false);
  const buttonIconColor = following ? tabIconSelected : (colorScheme === 'light' ? tint : iconColor);

  const handleRecenterPress = async () => {
    // toggle following mode
    const enabling = !following;
    // if enabling, immediately center on current location
    if (enabling && lastLocation && cameraRef.current) {
          const { latitude, longitude } = lastLocation.coords;
          cameraRef.current.zoomTo?.(16, 200);
          await sleep(200)
          cameraRef.current.flyTo?.([longitude, latitude], 800);
    }
    await sleep(1000)
    setFollowing(enabling);
    
  };

  useEffect(() => {
    if (!following || !lastLocation || !cameraRef.current) return;
    const { latitude, longitude } = lastLocation.coords;
    cameraRef.current.flyTo([longitude, latitude]);
  }, [lastLocation, following]);

  if (loading || !apiKey) {
    return (
      <ThemedView style={styles.page}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Waiting for MapTiler API key...</Text>
      </ThemedView>
    );
  }

  const mapStyle = `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${apiKey}`;

  return (
    <ThemedView style={styles.page}>
       <StatusBar
          animated={true}
          barStyle="dark-content"
        />
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleRecenterPress}
        style={[
          styles.recenterButton,
          {
            bottom: insets.bottom + 12,
            left: insets.left + 12,
            backgroundColor: following
              ? (colorScheme === 'dark' ? 'rgba(9, 63, 81)' : 'rgba(255,255,255 )')
              : (colorScheme === 'dark' ? 'rgba(0,0,0)' : 'rgba(255,255,255)'),
            borderWidth: following ? 1.5 : 1.5,
            borderColor: following ? String(tint) : 'transparent',
          },
        ]}
      >
        <IconSymbol size={28} name="location.fill.viewfinder" color={String(buttonIconColor)} />
      </TouchableOpacity>
      <MapView
        style={styles.map}
        mapStyle={mapStyle}
        logoEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        compassEnabled={false}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [0, 0],
            zoomLevel: 1,
          }}
        />
        {/* Render the native location puck w/ heading indicator. */}
        {/* @ts-ignore - typing differs across forks */}
        <UserLocation
          visible={true}
          animated={true}
          renderMode="native"
          androidRenderMode="compass"
          showsUserHeadingIndicator={true}
          androidPreferredFramesPerSecond={60}
        />
      </MapView>

      {lastLocation ? (
        <View
          style={[
            styles.locationOverlay,
            {
              top: insets.top + 12,
              right: insets.right + 12,
            },
          ]}
        >
          <Text style={styles.locationText}>Lat: {lastLocation.coords.latitude.toFixed(6)}</Text>
          <Text style={styles.locationText}>Lon: {lastLocation.coords.longitude.toFixed(6)}</Text>
          <Text style={styles.locationText}>
            Alt:{' '}
            {lastLocation.coords.altitude == null
              ? '—'
              : `${lastLocation.coords.altitude.toFixed(0)} m`}
          </Text>
          <Text style={styles.locationText}>
            Heading:{' '}
            {(() => {
              const useMag = mapHeading === 'magnetic';
              const h = useMag ? lastLocation.coords.magHeading : lastLocation.coords.trueHeading;
              if (h == null) return '—';
              const formatted = angleUnit === 'mils' ? `${Math.round(degreesToMils(h, { normalize: true }))} mils` : `${h.toFixed(0)}°`;
              const indicator = useMag ? 'Magnetic' : 'True';
              return `${formatted} — ${indicator}`;
            })()}
          </Text>
        </View>
      ) : null}
    </ThemedView>
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
