import { ThemedText } from '@/components/themed-text';
import { useOfflineMaps } from '@/hooks/offline-maps';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

/**
 * A compact floating progress pill that shows on the map screen
 * whenever a background offline map download is in progress.
 * Renders nothing when there is no active download.
 */
export default function DownloadProgressOverlay() {
  const colorScheme = useColorScheme() ?? 'light';
  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const { activeDownload } = useOfflineMaps();

  if (!activeDownload) return null;

  const pct = Math.min(activeDownload.progress, 100);

  // On web this feature is disabled, but guard anyway
  if (Platform.OS === 'web') return null;

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)',
          borderColor: String(borderColor),
        },
      ]}
    >
      <ActivityIndicator size="small" style={{ marginRight: 8 }} />
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.label} numberOfLines={1}>
          Downloading {activeDownload.presetLabel}…
        </ThemedText>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
      </View>
      <ThemedText style={styles.pct}>{pct.toFixed(0)}%</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    top: 12,
    left: 60,
    right: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 80,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  barBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.2)',
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#34C759',
  },
  pct: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
    opacity: 0.7,
  },
});
