import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { alert } from '@/components/alert';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import AboutContent from '@/components/AboutContent';
import StyledButton from '@/components/ui/StyledButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { angleUnit, mapHeading, setSetting } = useSettings();
  const { apiKey, clearApiKey } = useMapTilerKey();
  const [infoOpen, setInfoOpen] = useState(false);
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const background = useThemeColor({}, 'background');

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
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <View style={styles.headerRow}>
          <ThemedText type="title">Settings</ThemedText>
          <Pressable
            onPress={() => setInfoOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Info"
            style={({ pressed }) => [styles.infoButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <IconSymbol size={22} name="info.circle" color={String(borderColor)} />
          </Pressable>
        </View>

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

        <Modal visible={infoOpen} animationType="slide" transparent={true}>
          <View style={styles.modalBackdrop}>
            <ThemedView style={[styles.modalContainer, { backgroundColor: String(background), borderColor: String(borderColor) }]}
            >
              <View style={styles.modalHeader}>
                <ThemedText type="title">Info</ThemedText>
                <StyledButton variant="secondary" onPress={() => setInfoOpen(false)}>Close</StyledButton>
              </View>
              <ScrollView contentContainerStyle={styles.modalScroll}>
                <AboutContent />
              </ScrollView>
            </ThemedView>
          </View>
        </Modal>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoButton: {
    padding: 8,
    borderRadius: 16,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalContainer: {
    width: '95%',
    maxHeight: '90%',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalScroll: {
    paddingBottom: 16,
  },
});