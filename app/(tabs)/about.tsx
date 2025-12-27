import { computeGridConvergence, getMagneticDeclination } from '@/components/map/converter';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useGPS } from '@/hooks/gps';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

export default function AboutScreen() {
  const { lastLocation } = useGPS();

  const [declination, setDeclination] = useState<number | null>(null);
  const [convergence, setConvergence] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!lastLocation) {
      setDeclination(null);
      setConvergence(null);
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

      try {
        const g = computeGridConvergence(lat, lon);
        if (active) setConvergence(g);
      } catch (e) {
        if (active) setConvergence(null);
      }
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

  return (
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
              <ThemedText style={styles.mono}>Accuracy: {lastLocation.coords.accuracy ?? '—'}</ThemedText>
              <ThemedText style={styles.mono}>Altitude: {lastLocation.coords.altitude ?? '—'}</ThemedText>
              <ThemedText style={styles.mono}>Magnetic heading: {lastLocation.coords.magHeading ?? '—'}</ThemedText>
              <ThemedText style={styles.mono}>True heading: {lastLocation.coords.trueHeading ?? '—'}</ThemedText>
              <ThemedText style={styles.mono}>Declination: {declination != null ? `${declination.toFixed(2)}°` : '—'}</ThemedText>
              <ThemedText style={styles.mono}>Grid convergence: {convergence != null ? `${convergence.toFixed(2)}°` : '—'}</ThemedText>
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
            <ThemedText type="link" style={styles.link}>Lack-Of-Name — https://github.com/Lack-Of-Name</ThemedText>
          </Pressable>
          <Pressable onPress={() => open('https://github.com/aellul27')}>
            <ThemedText type="link" style={styles.link}>Alexander Ellul — https://github.com/aellul27</ThemedText>
          </Pressable>
        </View>
      </View>
    </ThemedView>
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
  text: { fontSize: 13, color: '#222' },
  link: { color: '#007AFF', fontSize: 13, marginBottom: 6 },
});
