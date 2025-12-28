import React from 'react';
import { FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import StyledButton from './ui/StyledButton';
import { useCheckpoints, SavedRoute } from '@/hooks/checkpoints';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from './ui/icon-symbol';

type SavedRoutesModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (route: SavedRoute) => void;
};

export function SavedRoutesModal({ visible, onClose, onSelect }: SavedRoutesModalProps) {
  const { savedRoutes, deleteRoute } = useCheckpoints();
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const iconColor = useThemeColor({}, 'icon');
  const cardColor = useThemeColor({ light: '#f9f9f9', dark: '#202020' }, 'background');

  function handleSelect(route: SavedRoute) {
    onSelect(route);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ThemedView style={[styles.container, { borderColor, borderWidth: 1 }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Saved Routes</ThemedText>
            <TouchableOpacity onPress={onClose}>
              <IconSymbol name="xmark" size={24} color={iconColor} />
            </TouchableOpacity>
          </View>

          {savedRoutes.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText style={{ textAlign: 'center', opacity: 0.6 }}>No saved routes found.</ThemedText>
              <ThemedText style={{ textAlign: 'center', opacity: 0.6, fontSize: 12, marginTop: 4 }}>
                Save a route from the map actions menu first.
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={savedRoutes}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.item, { backgroundColor: cardColor, borderColor }]}
                  onPress={() => handleSelect(item)}
                >
                  <View style={styles.itemContent}>
                    <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                    <ThemedText style={styles.meta}>
                      {new Date(item.createdAt).toLocaleDateString()} • {item.checkpoints.length} points
                    </ThemedText>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={iconColor} />
                </TouchableOpacity>
              )}
            />
          )}

          <View style={styles.footer}>
            <StyledButton variant="secondary" onPress={onClose}>Cancel</StyledButton>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    padding: 20,
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  list: {
    flexGrow: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  itemContent: {
    flex: 1,
  },
  meta: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
});
