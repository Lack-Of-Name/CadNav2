import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  onTap: () => void;
  onGrid: () => void;
  onProject: () => void;
  disableTap?: boolean;
};

const OPTIONS = [
  { id: 'tap', label: 'Tap map', desc: 'Place at touch point', icon: 'hand.tap.fill' },
  { id: 'grid', label: 'Grid reference', desc: 'Easting / northing', icon: 'square.grid.3x3' },
  { id: 'project', label: 'Project point', desc: 'Bearing and distance', icon: 'safari.fill' },
] as const;

export function CheckpointModeDrawer({ visible, onClose, onTap, onGrid, onProject, disableTap }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const handlers = { tap: onTap, grid: onGrid, project: onProject } as const;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.divider,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: theme.divider }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>SET TARGET</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <IconSymbol name="xmark" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Places a navigation target on the map. Clears any existing target.
          </Text>
          {OPTIONS.map((opt, index) => {
            const isTap = opt.id === 'tap';
            const disabled = isTap && disableTap;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.row,
                  { borderBottomColor: theme.divider },
                  index === OPTIONS.length - 1 && styles.rowLast,
                ]}
                onPress={() => {
                  if (disabled) return;
                  handlers[opt.id]();
                  onClose();
                }}
                activeOpacity={disabled ? 1 : 0.7}
              >
                <View style={[styles.rowIcon, { borderColor: theme.divider }]}>
                  <IconSymbol name={opt.icon as any} size={18} color={disabled ? theme.textSubtle : theme.text} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: disabled ? theme.textSubtle : theme.text }]}>{opt.label}</Text>
                  <Text style={[styles.rowDesc, { color: disabled ? theme.textSubtle : theme.textMuted }]}>
                    {disabled ? 'Unavailable — map disabled' : opt.desc}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={14} color={theme.textSubtle} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
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
