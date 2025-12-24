import React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { angleUnit, setSetting } = useSettings();

  const isMils = angleUnit === 'mils';

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
                true: Colors[colorScheme].tint,
              }}
              thumbColor={Colors[colorScheme].background}
            />
          </View>

          <ThemedText>
            Current: {isMils ? 'Mils (6400)' : 'Degrees (360°)'}
          </ThemedText>
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