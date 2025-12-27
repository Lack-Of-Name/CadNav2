import { CompassOverlay } from '@/components/map/CompassOverlay';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
// checkpoints removed — compass kept
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Camera, MapView, UserLocation } from "@maplibre/maplibre-react-native";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '../themed-view';
import { formatHeading, getCompassHeadingDeg, sleep } from './MaplibreMap.general';

export default function MapLibreMap() {
  const { apiKey, loading } = useMapTilerKey();
  const { lastLocation } = useGPS();
  const { angleUnit, mapHeading } = useSettings();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const iconColor = useThemeColor({}, 'tabIconDefault');
  const tabIconSelected = useThemeColor({}, 'tabIconSelected');
  const tint = useThemeColor({}, 'tint');
  const markerPole = Colors.light.text;
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const background = useThemeColor({}, 'background');
  const cameraRef = React.useRef<any>(null);
  const [following, setFollowing] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const buttonIconColor = following ? tabIconSelected : (colorScheme === 'light' ? tint : iconColor);

  const currentHeading = getCompassHeadingDeg(lastLocation);

  const compassHeadingDeg = currentHeading ?? null;
  const compassTargetBearingDeg = null;
  const compassTargetLabel = null;
  const compassHeadingRefLabel = 'Magnetic';
  const compassBearingText = null;
  const compassDistanceText = null;

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

  // map press handler removed (placement/checkpoints removed)

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

  // checkpoint route removed

  return (
    <ThemedView style={styles.page}>
      <StatusBar animated={true} barStyle="dark-content" />

      <MapView
        style={styles.map}
        mapStyle={mapStyle}
        logoEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        compassEnabled={false}
        // checkpoint interaction removed
        onRegionDidChange={(ev: any) => {
          const z = ev?.properties?.zoomLevel ?? ev?.properties?.zoom ?? ev?.zoomLevel;
          if (typeof z === 'number' && Number.isFinite(z)) setZoomLevel(z);
        }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [0, 0],
            zoomLevel: 1,
          }}
        />

        {/* checkpoints removed */}

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
            borderWidth: 1.5,
            borderColor: following ? String(tint) : 'transparent',
          },
        ]}
      >
        <IconSymbol size={28} name="location.fill.viewfinder" color={String(buttonIconColor)} />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setCompassOpen(true)}
        accessibilityLabel="Compass"
        style={[
          styles.recenterButton,
          {
            bottom: insets.bottom + 12 + 58,
            left: insets.left + 12,
            backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0)' : 'rgba(255,255,255)',
            borderWidth: 1.5,
            borderColor: compassOpen ? String(tint) : 'transparent',
          },
        ]}
      >
        <IconSymbol size={26} name="safari.fill" color={String(compassOpen ? tabIconSelected : buttonIconColor)} />
      </TouchableOpacity>

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
          bottom: insets.bottom + 12 + 58,
        }}
      />

      {/* placement mode removed */}

      {/* Compass overlay replaced by CompassOverlay */}

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
          <Text style={styles.locationText}>Heading: {formatHeading(lastLocation, mapHeading, angleUnit)}</Text>
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
  placementBannerWrap: {
    position: 'absolute',
    zIndex: 60,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  placementBanner: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    maxWidth: 280,
  },
  placementBannerText: {
    fontSize: 12,
    opacity: 0.9,
  },
  placementBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  placementBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  placementBannerHint: {
    marginLeft: 'auto',
    fontSize: 12,
    opacity: 0.8,
  },
  compassOverlay: {
    // (unused)
  },
  checkpointMarker: {
    position: 'relative',
    width: 28,
    height: 56,
  },
  checkpointPole: {
    position: 'absolute',
    left: 13,
    bottom: 0,
    width: 2,
    height: 28,
    borderRadius: 1,
  },
  checkpointFlag: {
    position: 'absolute',
    left: 14,
    bottom: 0,
    width: 14,
    height: 12,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    borderTopLeftRadius: 1,
    borderBottomLeftRadius: 1,
  },
  checkpointLabelWrap: {
    position: 'absolute',
    left: 10,
    right: -110,
    bottom: 18,
    maxWidth: 140,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,1)',
  },
  checkpointLabelText: {
    color: 'white',
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
