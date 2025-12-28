import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AboutContent from '@/components/AboutContent';
import { alert } from '@/components/alert';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import StyledButton from '@/components/ui/StyledButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const safeBg = useThemeColor({}, 'background');
  const { angleUnit, mapHeading, gridConvergence, setSetting } = useSettings();
  const { apiKey, clearApiKey } = useMapTilerKey();
  const [infoOpen, setInfoOpen] = useState(false);
  const [convergenceModalOpen, setConvergenceModalOpen] = useState(false);
  
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#999', dark: '#666' }, 'text');
  const sectionHeaderColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');
  const rowBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const separatorColor = useThemeColor({ light: '#e5e5ea', dark: '#38383a' }, 'icon');

  const [inputConvergence, setInputConvergence] = useState<string>('');
  useEffect(() => {
    setInputConvergence(gridConvergence != null ? String(gridConvergence) : '');
  }, [gridConvergence]);

  const isMils = angleUnit === 'mils';
  const isTrue = mapHeading === 'true';
  const switchTrackOn = Colors[colorScheme].tint;
  const switchThumb = '#fff'; // Standard iOS look

  async function handleResetApiKey() {
    await alert({
      title: 'Reset MapTiler API Key',
      message: 'Delete the stored MapTiler API key and enter a new one?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: async () => await clearApiKey() },
      ],
    });
  }

  async function saveConvergence() {
    const v = inputConvergence.trim();
    const n = parseFloat(v);
    if (!v) {
      await setSetting('gridConvergence', null);
      setConvergenceModalOpen(false);
    } else if (!Number.isFinite(n)) {
      await alert({ title: 'Invalid', message: 'Please enter a valid number for convergence.' });
    } else {
      await setSetting('gridConvergence', n);
      setConvergenceModalOpen(false);
    }
  }

  const SettingsSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: sectionHeaderColor }]}>{title.toUpperCase()}</ThemedText>
      <View style={[styles.sectionContent, { backgroundColor: rowBg, borderColor: separatorColor }]}>
        {children}
      </View>
    </View>
  );

  const SettingsRow = ({ 
    icon, 
    label, 
    value, 
    onPress, 
    rightElement,
    isLast = false,
    color
  }: { 
    icon: string; 
    label: string; 
    value?: string; 
    onPress?: () => void; 
    rightElement?: React.ReactNode;
    isLast?: boolean;
    color?: string;
  }) => (
    <TouchableOpacity 
      onPress={onPress} 
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: separatorColor }]}
    >
      <View style={[styles.iconContainer, { backgroundColor: color ?? Colors[colorScheme].tint }]}>
        <IconSymbol name={icon as any} size={18} color="#fff" />
      </View>
      <View style={styles.rowContent}>
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        <View style={styles.rowRight}>
          {value && <ThemedText style={styles.rowValue}>{value}</ThemedText>}
          {rightElement}
          {onPress && !rightElement && (
            <IconSymbol name="chevron.right" size={20} color={Colors[colorScheme].tabIconDefault} style={{ marginLeft: 8 }} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: safeBg }]}> 
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <ThemedText type="title" style={styles.pageTitle}>Settings</ThemedText>

        <SettingsSection title="Navigation">
          <SettingsRow 
            icon="ruler.fill" 
            label="Angle Units" 
            color="#FF9500"
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ThemedText style={styles.rowValue}>{isMils ? 'Mils' : 'Degrees'}</ThemedText>
                <Switch
                  value={isMils}
                  onValueChange={(v) => setSetting('angleUnit', v ? 'mils' : 'degrees')}
                  trackColor={{ false: '#e9e9ea', true: switchTrackOn }}
                  thumbColor={switchThumb}
                />
              </View>
            }
          />
          <SettingsRow 
            icon="compass.drawing" 
            label="North Reference" 
            color="#007AFF"
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ThemedText style={styles.rowValue}>{isTrue ? 'True' : 'Magnetic'}</ThemedText>
                <Switch
                  value={isTrue}
                  onValueChange={(v) => setSetting('mapHeading', v ? 'true' : 'magnetic')}
                  trackColor={{ false: '#e9e9ea', true: switchTrackOn }}
                  thumbColor={switchThumb}
                />
              </View>
            }
          />
          <SettingsRow 
            icon="square.grid.3x3" 
            label="Grid Convergence" 
            color="#AF52DE"
            value={gridConvergence != null ? `${gridConvergence}°` : 'Not set'}
            onPress={() => setConvergenceModalOpen(true)}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Map">
          <SettingsRow 
            icon="map.fill" 
            label="MapTiler API Key" 
            color="#34C759"
            value={apiKey ? 'Configured' : 'Missing'}
            onPress={handleResetApiKey}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="App">
          <SettingsRow 
            icon="info.circle.fill" 
            label="About CadNav" 
            color="#8E8E93"
            onPress={() => setInfoOpen(true)}
            isLast
          />
        </SettingsSection>

        <ThemedText style={styles.footerText}>CadNav v1.0.0</ThemedText>
      </ScrollView>

      {/* Grid Convergence Modal */}
      <Modal visible={convergenceModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <ThemedView style={[styles.modalContainer, { backgroundColor: String(background), borderColor: String(borderColor) }]}>
            <ThemedText type="subtitle">Grid Convergence</ThemedText>
            <ThemedText style={{ marginTop: 8, marginBottom: 16 }}>
              Enter the angle between true north and grid north (found on your map). Positive if grid north is east of true north.
            </ThemedText>
            
            <TextInput
              style={[styles.input, { borderColor: String(borderColor), color: String(textColor) }]}
              placeholder="e.g. -1.23"
              placeholderTextColor={String(placeholderColor)}
              keyboardType="numeric"
              value={inputConvergence}
              onChangeText={setInputConvergence}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <StyledButton variant="secondary" onPress={() => setConvergenceModalOpen(false)}>Cancel</StyledButton>
              <View style={{ width: 12 }} />
              <StyledButton variant="primary" onPress={saveConvergence}>Save</StyledButton>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* About Modal */}
      <Modal visible={infoOpen} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <ThemedView style={[styles.modalContainer, { backgroundColor: String(background), borderColor: String(borderColor), height: '80%' }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title">About</ThemedText>
              <StyledButton variant="secondary" onPress={() => setInfoOpen(false)}>Close</StyledButton>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <AboutContent />
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    marginBottom: 20,
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 16,
    opacity: 0.8,
  },
  sectionContent: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 17,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 17,
    opacity: 0.6,
    marginRight: 4,
  },
  footerText: {
    textAlign: 'center',
    opacity: 0.4,
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalScroll: {
    paddingBottom: 20,
  },
  input: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});