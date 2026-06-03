import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { ThemedText } from './themed-text';
import { IconSymbol } from './ui/icon-symbol';

type AddRoutePanelProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (option: string) => void;
};

const OPTIONS = [
  { id: 'place', label: 'Place on map', desc: 'Tap to set a waypoint', icon: 'mappin.and.ellipse' },
  { id: 'reference', label: 'Grid reference', desc: 'Enter easting / northing', icon: 'square.grid.3x3' },
  { id: 'project', label: 'Project point', desc: 'Bearing and distance', icon: 'safari.fill' },
  { id: 'saved', label: 'Saved library', desc: 'Route or location', icon: 'folder.fill' },
] as const;

export function AddRoutePanel({ visible, onClose, onSelect }: AddRoutePanelProps) {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const iconColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'divider');
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.panel,
            { backgroundColor, borderColor, width: isLargeScreen ? 380 : '92%', maxWidth: 400 },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <ThemedText style={styles.headerTitle}>ADD WAYPOINT</ThemedText>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <IconSymbol name="xmark" size={20} color={iconColor} />
            </TouchableOpacity>
          </View>

          {OPTIONS.map((opt, index) => (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.row,
                { borderBottomColor: borderColor },
                index === OPTIONS.length - 1 && styles.rowLast,
              ]}
              onPress={() => onSelect(opt.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.rowIcon, { borderColor: theme.divider }]}>
                <IconSymbol name={opt.icon as any} size={18} color={theme.text} />
              </View>
              <View style={styles.rowText}>
                <ThemedText style={styles.rowLabel}>{opt.label}</ThemedText>
                <ThemedText style={[styles.rowDesc, { color: theme.textMuted }]}>{opt.desc}</ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={14} color={theme.textSubtle} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 12,
    marginTop: 1,
  },
});
