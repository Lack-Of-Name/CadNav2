import { SavedLocation, SavedRoute, useCheckpoints } from '@/hooks/checkpoints';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useState } from 'react';
import { FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { IconSymbol } from './ui/icon-symbol';
import StyledButton from './ui/StyledButton';

type SavedRoutesModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectRoute: (route: SavedRoute) => void;
  onSelectLocation: (location: SavedLocation) => void;
};

export function SavedRoutesModal({ visible, onClose, onSelectRoute, onSelectLocation }: SavedRoutesModalProps) {
  const { savedRoutes, savedLocations } = useCheckpoints();
  const [activeTab, setActiveTab] = useState<'routes' | 'locations'>('routes');
  
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const iconColor = useThemeColor({}, 'icon');
  const cardColor = useThemeColor({ light: '#f9f9f9', dark: '#202020' }, 'background');
  const activeTabBg = useThemeColor({ light: '#e0e0e0', dark: '#333' }, 'background');

  function handleSelectRoute(route: SavedRoute) {
    onSelectRoute(route);
    onClose();
  }

  function handleSelectLocation(location: SavedLocation) {
    onSelectLocation(location);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ThemedView style={[styles.container, { borderColor, borderWidth: 1 }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Saved Items</ThemedText>
            <TouchableOpacity onPress={onClose}>
              <IconSymbol name="xmark" size={24} color={iconColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity 
                style={[styles.tab, activeTab === 'routes' && { backgroundColor: activeTabBg, borderColor }]} 
                onPress={() => setActiveTab('routes')}
            >
                <ThemedText type={activeTab === 'routes' ? 'defaultSemiBold' : 'default'}>Routes</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.tab, activeTab === 'locations' && { backgroundColor: activeTabBg, borderColor }]} 
                onPress={() => setActiveTab('locations')}
            >
                <ThemedText type={activeTab === 'locations' ? 'defaultSemiBold' : 'default'}>Locations</ThemedText>
            </TouchableOpacity>
          </View>

          {activeTab === 'routes' ? (
              savedRoutes.length === 0 ? (
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
                      onPress={() => handleSelectRoute(item)}
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
              )
          ) : (
              savedLocations.length === 0 ? (
                <View style={styles.emptyState}>
                  <ThemedText style={{ textAlign: 'center', opacity: 0.6 }}>No saved locations found.</ThemedText>
                  <ThemedText style={{ textAlign: 'center', opacity: 0.6, fontSize: 12, marginTop: 4 }}>
                    Save locations from the map actions menu first.
                  </ThemedText>
                </View>
              ) : (
                <FlatList
                  data={savedLocations}
                  keyExtractor={(item) => item.id}
                  style={styles.list}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.item, { backgroundColor: cardColor, borderColor }]}
                      onPress={() => handleSelectLocation(item)}
                    >
                      <View style={styles.itemContent}>
                        <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                        {item.description ? <ThemedText style={styles.desc} numberOfLines={1}>{item.description}</ThemedText> : null}
                        <ThemedText style={styles.meta}>
                          {new Date(item.createdAt).toLocaleDateString()} • {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                        </ThemedText>
                      </View>
                      <IconSymbol name="chevron.right" size={20} color={iconColor} />
                    </TouchableOpacity>
                  )}
                />
              )
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
    borderRadius: 14,
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
  tabs: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'transparent',
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
  desc: {
    fontSize: 13,
    opacity: 0.8,
    marginBottom: 2,
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
