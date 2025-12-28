import { useThemeColor } from '@/hooks/use-theme-color';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { alert } from '@/components/alert';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import StyledButton from '@/components/ui/StyledButton';
import { Colors } from '@/constants/theme';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const safeBg = useThemeColor({}, 'background');
  const { angleUnit, mapHeading, setSetting } = useSettings();
  const { gridConvergence } = useSettings();
  const { apiKey, clearApiKey } = useMapTilerKey();

  const [inputConvergence, setInputConvergence] = useState<string>('');
  useEffect(() => {
    setInputConvergence(gridConvergence != null ? String(gridConvergence) : '');
  }, [gridConvergence]);

  const isMils = angleUnit === 'mils';
  const isTrue = mapHeading === 'true';
  const switchTrackOn = colorScheme === 'dark' ? 'rgba(255,255,255,0.22)' : Colors[colorScheme].tint;
  const switchThumb = colorScheme === 'dark' ? Colors.dark.tabIconSelected : Colors[colorScheme].background;

  async function handleReset() {
    await alert({
      title: 'Reset MapTiler API Key',
      message: 'Delete the stored MapTiler API key and enter a new one?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: async () => await clearApiKey() },
      ],
    });
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: safeBg }]}> 
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView>
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
          <ThemedText type="subtitle">Grid Convergence</ThemedText>
          <ThemedText>
            Grid convergence is the angle between true north and grid north for a map sheet. You can
            usually find it printed on the back of your topographic map. Enter the convergence in
            degrees (positive when grid north is east of true north) and save — the value will be
            used to convert between grid and magnetic bearings.
          </ThemedText>
          <View style={[styles.row, { marginTop: 8 }]}>
            <TextInput
              style={styles.input}
              placeholder="e.g. -1.23"
              keyboardType="numeric"
              value={typeof inputConvergence === 'string' ? inputConvergence : inputConvergence}
              onChangeText={setInputConvergence}
            />
            <StyledButton
              variant="primary"
              onPress={async () => {
                const v = inputConvergence.trim();
                const n = parseFloat(v);
                if (!v) {
                  await setSetting('gridConvergence', null);
                } else if (!Number.isFinite(n)) {
                  await alert({ title: 'Invalid', message: 'Please enter a valid number for convergence.' });
                } else {
                  await setSetting('gridConvergence', n);
                }
              }}
            >
              Save
            </StyledButton>
          </View>
          <ThemedText>
            Current: {gridConvergence != null ? `${gridConvergence}°` : 'Not set'}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 16,
  },
  scroll: {
    flex: 1,
  },
  section: {
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 6,
    minWidth: 120,
    marginRight: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});