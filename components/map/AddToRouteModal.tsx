import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WorkspaceRoute } from '@/types';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  routes: WorkspaceRoute[];
  onClose: () => void;
  /** Append the current target to the chosen route. */
  onSelectRoute: (route: WorkspaceRoute) => void;
  /** Create a brand-new workspace route and append the target to it. */
  onCreateNew: () => void;
};

export function AddToRouteModal({ visible, routes, onClose, onSelectRoute, onCreateNew }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const rows = routes.length + 1; // routes + "New route"

  const handleSelect = (route: WorkspaceRoute) => {
    onSelectRoute(route);
    onClose();
  };

  const handleNew = () => {
    onCreateNew();
    onClose();
  };

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
            <Text style={[styles.headerTitle, { color: theme.text }]}>ADD POINT TO ROUTE</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <IconSymbol name="xmark" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Appends the point to the end of the chosen route.
          </Text>

          {routes.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSubtle }]}>
              No routes yet — create one below.
            </Text>
          ) : (
            routes.map((route, index) => {
              const count = route.checkpoints?.length ?? 0;
              return (
                <TouchableOpacity
                  key={route.id}
                  style={[
                    styles.row,
                    { borderBottomColor: theme.divider },
                    index === routes.length - 1 && styles.rowLast,
                  ]}
                  onPress={() => handleSelect(route)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.rowIcon, { borderColor: theme.divider }]}>
                    <View style={[styles.colorDot, { backgroundColor: route.color ?? theme.textMuted }]} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: theme.text }]} numberOfLines={1}>
                      {route.title}
                    </Text>
                    <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                      {count} waypoint{count === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={14} color={theme.textSubtle} />
                </TouchableOpacity>
              );
            })
          )}

          {/* New route row */}
          <TouchableOpacity
            style={[
              styles.row,
              { borderBottomColor: theme.divider },
              rows === 1 && styles.rowLast,
            ]}
            onPress={handleNew}
            activeOpacity={0.7}
          >
            <View style={[styles.rowIcon, { borderColor: theme.primary }]}>
              <IconSymbol name="plus" size={18} color={theme.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: theme.primary }]}>New route</Text>
              <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                Create a route from this point
              </Text>
            </View>
          </TouchableOpacity>
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
  empty: {
    fontSize: 12,
    paddingHorizontal: 14,
    paddingTop: 6,
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
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
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
