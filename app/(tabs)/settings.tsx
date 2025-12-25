import React from 'react';
import { Alert, Platform, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import StyledButton from '@/components/ui/StyledButton';
import { Colors } from '@/constants/theme';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { angleUnit, mapHeading, setSetting } = useSettings();
  const { apiKey, clearApiKey } = useMapTilerKey();

  const isMils = angleUnit === 'mils';
  const isTrue = mapHeading === 'true';
  const switchTrackOn = colorScheme === 'dark' ? 'rgba(255,255,255,0.22)' : Colors[colorScheme].tint;
  const switchThumb = colorScheme === 'dark' ? Colors.dark.tabIconSelected : Colors[colorScheme].background;

  async function handleReset() {
    if (Platform.OS === 'web') {
      const ok = window.confirm('Delete the stored MapTiler API key and enter a new one?');
      if (!ok) return;
      await clearApiKey();
      return;
    }

    Alert.alert(
      'Reset MapTiler API Key',
      'Delete the stored MapTiler API key and enter a new one?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: async () => await clearApiKey() },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">Settings</ThemedText>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Angle Units</ThemedText>
          <View style={styles.row}>
            <ThemedText type="defaultSemiBold">Display angles in mils</ThemedText>
            <Switch
              value={isMils}
              onValueChange={(v) => setSetting('angleUnit', v ? 'mils' : 'degrees')}
              trackColor={{
                false: Colors[colorScheme].tabIconDefault,
                true: switchTrackOn,
              }}
              thumbColor={switchThumb}
            />
          </View>
          <ThemedText>
            Current: {isMils ? 'Mils (6400)' : 'Degrees (360°)'}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Map Heading</ThemedText>
          <View style={styles.row}>
            <ThemedText type="defaultSemiBold">Show heading as true north</ThemedText>
            <Switch
              value={isTrue}
              onValueChange={(v) => setSetting('mapHeading', v ? 'true' : 'magnetic')}
              trackColor={{
                false: Colors[colorScheme].tabIconDefault,
                true: switchTrackOn,
              }}
              thumbColor={switchThumb}
            />
          </View>
          <ThemedText>
            Current: {isTrue ? 'True North' : 'Magnetic North'}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">MapTiler</ThemedText>
          <ThemedText>Map tiles API key: {apiKey ? 'Present' : 'Not set'}</ThemedText>
          <View style={[styles.row, { marginTop: 8 }]}>
            <StyledButton variant="secondary" onPress={handleReset}>
              Reset MapTiler API Key
            </StyledButton>
          </View>
        </ThemedView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  section: {
    paddingVertical: 12,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});