import { degreesToMils, getMagneticDeclination } from '@/components/map/converter';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { useThemeColor } from '@/hooks/use-theme-color';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const { lastLocation } = useGPS();

  const [declination, setDeclination] = useState<number | null>(null);
  const { angleUnit, gridConvergence } = useSettings();

  const formatAngle = (v: number | null) => {
    if (v == null) return '—';
    if (angleUnit === 'mils') {
      // For signed quantities (declination/convergence) we want signed mils,
      // not the normalized [0, 6400) value used for bearings.
      return `${Math.round(degreesToMils(v, { normalize: false }))} mils`;
    }
    return `${v.toFixed(2)}°`;
  };

  const formatMeters = (v: number | null | undefined) => {
    if (v == null) return '—';
    // show one decimal for <1m, otherwise round
    return v < 1 ? `±${v.toFixed(1)} m` : `±${Math.round(v)} m`;
  };

  useEffect(() => {
    let active = true;
    if (!lastLocation) {
      setDeclination(null);
      return;
    }

    const { latitude: lat, longitude: lon, altitude } = lastLocation.coords;

    (async () => {
      try {
        const altKm = altitude != null ? altitude / 1000 : 0;
        const d = await getMagneticDeclination(lat, lon, new Date(), { altitudeKm: altKm });
        if (active) setDeclination(d);
      } catch (e) {
        if (active) setDeclination(null);
      }

      // Grid convergence is provided by the user in Settings; do not compute automatically.
    })();

    return () => {
      active = false;
    };
  }, [lastLocation]);

  const appName = Constants.manifest?.name ?? (Constants.expoConfig as any)?.name ?? 'CadNav2';
  const appVersion = Constants.manifest?.version ?? (Constants.expoConfig as any)?.version ?? '1.0.0';

  const open = (url: string) => {
    void Linking.openURL(url);
  };

  const safeBg = useThemeColor({}, 'background');

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: safeBg }]}>
      <ThemedView style={styles.container}>
        <View style={styles.card}>
        <ThemedText type="title" style={styles.title}>{appName}</ThemedText>
        <ThemedText type="subtitle" style={styles.subtitle}>Version {appVersion}</ThemedText>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Location</ThemedText>
          {lastLocation ? (
            <ThemedView>
              <ThemedText style={styles.mono}>Latitude: {String(lastLocation.coords.latitude)}</ThemedText>
              <ThemedText style={styles.mono}>Longitude: {String(lastLocation.coords.longitude)}</ThemedText>
              <ThemedText style={styles.mono}>Accuracy: {formatMeters(lastLocation.coords.accuracy)}</ThemedText>
              <ThemedText style={styles.mono}>Altitude: {lastLocation.coords.altitude ?? '—'}</ThemedText>
              <ThemedText style={styles.mono}>Magnetic heading: {lastLocation.coords.magHeading ?? '—'}</ThemedText>
              <ThemedText style={styles.mono}>True heading: {lastLocation.coords.trueHeading ?? '—'}</ThemedText>
              <ThemedText style={styles.mono}>Declination: {formatAngle(declination)}</ThemedText>
              <ThemedText style={styles.mono}>Grid convergence: {formatAngle(gridConvergence)}</ThemedText>
              <ThemedText style={styles.mono}>Grid to magnetic: {declination != null && gridConvergence != null ? formatAngle(declination - gridConvergence) : '—'}</ThemedText>
              <ThemedText style={styles.mono}>Timestamp: {new Date(lastLocation.timestamp).toISOString()}</ThemedText>
            </ThemedView>
          ) : (
            <ThemedText style={styles.text}>No location available.</ThemedText>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Links</ThemedText>
          <Pressable onPress={() => open('https://github.com/Lack-Of-Name/CadNav2')}>
            <ThemedText type="link" style={styles.link}>GitHub repo: https://github.com/Lack-Of-Name/CadNav2</ThemedText>
          </Pressable>
          <Pressable onPress={() => open('https://github.com/Lack-Of-Name/CadNav2/issues')}>
            <ThemedText type="link" style={styles.link}>Report issues</ThemedText>
          </Pressable>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Authors</ThemedText>
          <Pressable onPress={() => open('https://github.com/Lack-Of-Name')}>
            <ThemedText type="link" style={styles.link}>Scott Webster — https://github.com/Lack-Of-Name</ThemedText>
          </Pressable>
          <Pressable onPress={() => open('https://github.com/aellul27')}>
            <ThemedText type="link" style={styles.link}>Alexander Ellul — https://github.com/aellul27</ThemedText>
          </Pressable>
        </View>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { backgroundColor: 'transparent' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  subtitle: { marginBottom: 12, color: '#666' },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  mono: { fontFamily: 'monospace', fontSize: 13},
  text: { fontSize: 13 },
  link: { color: '#007AFF', fontSize: 13, marginBottom: 6 },
});
