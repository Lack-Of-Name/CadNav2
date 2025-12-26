import CompassOverlay from '@/components/map/CompassOverlay';
import { degreesToMils } from '@/components/map/converter';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Camera, LineLayer, MapView, PointAnnotation, ShapeSource, UserLocation } from "@maplibre/maplibre-react-native";
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
  const { checkpoints, selectedCheckpoint, selectCheckpoint, addCheckpoint } = useCheckpoints();
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
  const [placementMode, setPlacementMode] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const buttonIconColor = following ? tabIconSelected : (colorScheme === 'light' ? tint : iconColor);

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

  const checkpointDistanceMeters =
    lastLocation && selectedCheckpoint
      ? haversineMeters(
          lastLocation.coords.latitude,
          lastLocation.coords.longitude,
          selectedCheckpoint.latitude,
          selectedCheckpoint.longitude
        )
      : null;

  const compassHeadingDeg = currentHeading ?? null;
  const compassTargetBearingDeg = checkpointBearing ?? null;
  const compassTargetLabel = selectedCheckpoint?.label?.trim() ? selectedCheckpoint.label.trim() : (selectedCheckpoint ? 'Checkpoint' : null);
  const compassHeadingRefLabel = mapHeading === 'magnetic' ? 'Magnetic' : 'True';

  const compassBearingText = checkpointBearing == null
    ? null
    : angleUnit === 'mils'
      ? `${Math.round(degreesToMils(checkpointBearing, { normalize: true }))} mils`
      : `${checkpointBearing.toFixed(0)}°`;

  const compassDistanceText = checkpointDistanceMeters == null
    ? null
    : checkpointDistanceMeters >= 1000
      ? `${(checkpointDistanceMeters / 1000).toFixed(2)} km`
      : `${Math.round(checkpointDistanceMeters)} m`;

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

  const handleMapPress = async (ev: any) => {
    if (!placementMode) return;
    const coords = ev?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return;
    const [longitude, latitude] = coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    await addCheckpoint(latitude, longitude);
    setCompassOpen(true);
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

  const routeLineFeature = checkpoints.length >= 2
    ? {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: checkpoints.map((cp) => [cp.longitude, cp.latitude]),
        },
      }
    : null;

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
        onPress={handleMapPress}
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

        {routeLineFeature ? (
          <ShapeSource id="checkpoint-route" shape={routeLineFeature as any}>
            <LineLayer
              id="checkpoint-route-line"
              style={{
                lineColor: String(markerPole),
                lineWidth: 2,
                lineOpacity: 0.9,
                lineDasharray: [1.5, 1.5],
              } as any}
            />
          </ShapeSource>
        ) : null}

        {checkpoints.map((cp) => {
          const selected = selectedCheckpoint?.id === cp.id;
          const flagColor = markerPole;
          const showLabel = zoomLevel >= 14 && !!cp.label?.trim();
          return (
          <PointAnnotation
            key={cp.id}
            id={cp.id}
            coordinate={[cp.longitude, cp.latitude]}
            // @ts-ignore - anchor typing differs across forks
            anchor={{ x: 0.5, y: 1.0 }}
            onSelected={() => {
              void selectCheckpoint(cp.id);
              setCompassOpen(true);
            }}
          >
            <View style={styles.checkpointMarker}>
              {showLabel ? (
                <View style={styles.checkpointLabelWrap}>
                  <Text style={styles.checkpointLabelText} numberOfLines={1}>
                    {cp.label!.trim()}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.checkpointPole, { backgroundColor: String(markerPole) }]} />
              <View
                style={[
                  styles.checkpointFlag,
                  {
                    backgroundColor: String(flagColor),
                    borderColor: String(markerPole),
                    borderWidth: selected ? 0 : 0,
                  },
                ]}
              />
            </View>
          </PointAnnotation>
          );
        })}

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

      <CompassOverlay
        open={compassOpen}
        onToggle={() => setCompassOpen((v) => !v)}
        headingDeg={compassHeadingDeg}
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

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          setPlacementMode((v) => !v);
          if (!placementMode) {
            setCompassOpen(false);
          }
        }}
        style={[
          styles.recenterButton,
          {
            bottom: insets.bottom + 12 + 58 + 58,
            left: insets.left + 12,
            backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0)' : 'rgba(255,255,255)',
            borderWidth: 1.5,
            borderColor: placementMode ? String(tint) : 'transparent',
          },
        ]}
      >
        <IconSymbol size={26} name="flag.fill" color={String(placementMode ? tabIconSelected : buttonIconColor)} />
      </TouchableOpacity>

      {placementMode ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.placementBannerWrap,
            {
              top: insets.top + 12,
              left: insets.left + 12,
              right: insets.right + 12,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPlacementMode(false)}
            style={[
              styles.placementBanner,
              {
                borderColor: String(tint),
                backgroundColor: String(background),
              },
            ]}
          >
            <View style={styles.placementBannerRow}>
              <IconSymbol size={16} name="flag.fill" color={String(tint)} />
              <Text style={[styles.placementBannerTitle, { color: String(textColor) }]}>Placement mode</Text>
              <Text style={[styles.placementBannerHint, { color: String(textColor) }]}>Tap to exit</Text>
            </View>
            <Text style={[styles.placementBannerText, { color: String(textColor) }]}>Tap the map to add checkpoints</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
