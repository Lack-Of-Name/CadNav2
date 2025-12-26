import { alert } from '@/components/alert';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

function formatLatLon(n: number) {
  return n.toFixed(6);
}

export default function CheckpointsScreen() {
  const {
    checkpoints,
    selectedId,
    selectedCheckpoint,
    savedRoutes,
    selectCheckpoint,
    removeCheckpoint,
    setCheckpointLabel,
    clearActiveRoute,
    saveRoute,
    loadRoute,
    deleteRoute,
    isLoaded,
  } = useCheckpoints();
  const textColor = useThemeColor({}, 'text');
  const subtleColor = useThemeColor({}, 'tabIconDefault');
  const tint = useThemeColor({}, 'tint');
  const background = useThemeColor({}, 'background');

  const [routeName, setRouteName] = React.useState('');

  if (!isLoaded) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Checkpoints</ThemedText>
        <ThemedText style={styles.subtle}>Loading…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerRow}>
        <ThemedText type="title">Checkpoints</ThemedText>
        <ThemedText style={[styles.count, { color: String(subtleColor) }]}>{checkpoints.length}</ThemedText>
      </View>

      <View style={[styles.actionsCard, { borderColor: String(subtleColor), backgroundColor: String(background) }]}>
        <View style={styles.actionsRow}>
          <TextInput
            value={routeName}
            onChangeText={setRouteName}
            placeholder="Route name"
            placeholderTextColor={String(subtleColor)}
            style={[styles.routeNameInput, { color: String(textColor), borderColor: String(subtleColor) }]}
            autoCorrect={false}
            autoCapitalize="words"
          />
          <Pressable
            onPress={() => {
              void (async () => {
                try {
                  const r = await saveRoute(routeName);
                  setRouteName('');
                  await alert({ title: 'Saved', message: `Saved route “${r.name}” (${r.checkpoints.length} checkpoints).` });
                } catch (e) {
                  await alert({ title: 'Could not save route', message: String(e) });
                }
              })();
            }}
            style={[styles.actionButton, { borderColor: String(tint) }]}
          >
            <ThemedText type="defaultSemiBold" style={{ color: String(tint) }}>Save</ThemedText>
          </Pressable>
        </View>

        <View style={styles.actionsRowBottom}>
          <Pressable
            onPress={() => {
              void (async () => {
                await clearActiveRoute();
                await alert({ title: 'Cleared', message: 'Active route cleared (not saved).' });
              })();
            }}
            style={[styles.actionButtonSmall, { borderColor: String(subtleColor) }]}
          >
            <ThemedText style={{ color: String(subtleColor) }}>Clear active</ThemedText>
          </Pressable>

          <View style={{ flex: 1 }} />

          <ThemedText style={[styles.subtleInline, { color: String(subtleColor) }]}>
            Active route is not saved automatically
          </ThemedText>
        </View>

        <View style={styles.savedRoutesWrap}>
          <Collapsible title={`Saved routes (${savedRoutes.length})`}>
            {savedRoutes.length === 0 ? (
              <ThemedText style={{ color: String(subtleColor) }}>No saved routes yet.</ThemedText>
            ) : (
              savedRoutes.map((r) => (
                <View key={r.id} style={[styles.routeRow, { borderColor: String(subtleColor) }]}> 
                  <Pressable
                    onPress={() => {
                      void (async () => {
                        try {
                          await loadRoute(r.id);
                        } catch (e) {
                          await alert({ title: 'Could not load route', message: String(e) });
                        }
                      })();
                    }}
                    style={styles.routeRowMain}
                  >
                    <View style={styles.routeRowTitleLine}>
                      <IconSymbol size={14} name="flag.fill" color={String(tint)} />
                      <ThemedText type="defaultSemiBold" numberOfLines={1}>{r.name}</ThemedText>
                    </View>
                    <ThemedText style={[styles.routeRowMeta, { color: String(subtleColor) }]} numberOfLines={1}>
                      {r.checkpoints.length} checkpoints · {new Date(r.createdAt).toLocaleString()}
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      void alert({
                        title: 'Delete route?',
                        message: `Delete “${r.name}”?`,
                        buttons: [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => void deleteRoute(r.id),
                          },
                        ],
                      });
                    }}
                    style={[styles.deleteButton, { borderColor: String(subtleColor) }]}
                  >
                    <ThemedText style={{ color: String(subtleColor) }}>Delete</ThemedText>
                  </Pressable>
                </View>
              ))
            )}
          </Collapsible>
        </View>
      </View>

      {selectedCheckpoint ? (
        <View style={[styles.editor, { borderColor: String(subtleColor), backgroundColor: String(background) }]}>
          <View style={styles.editorTopRow}>
            <IconSymbol size={18} name="flag.fill" color={String(tint)} />
            <ThemedText type="defaultSemiBold">Selected</ThemedText>
            <ThemedText style={[styles.editorCoords, { color: String(subtleColor) }]}>
              {formatLatLon(selectedCheckpoint.latitude)}, {formatLatLon(selectedCheckpoint.longitude)}
            </ThemedText>
          </View>
          <TextInput
            value={selectedCheckpoint.label ?? ''}
            onChangeText={(t) => void setCheckpointLabel(selectedCheckpoint.id, t)}
            placeholder="Label (optional)"
            placeholderTextColor={String(subtleColor)}
            style={[styles.editorInput, { color: String(textColor), borderColor: String(subtleColor) }]}
            autoCorrect={false}
            autoCapitalize="sentences"
            clearButtonMode="while-editing"
          />
        </View>
      ) : (
        <ThemedText style={[styles.emptySelected, { color: String(subtleColor) }]}>Select a checkpoint to edit its label.</ThemedText>
      )}

      {checkpoints.length === 0 ? (
        <ThemedText style={[styles.emptyState, { color: String(subtleColor) }]}>No checkpoints yet. Use placement mode on the map to add one.</ThemedText>
      ) : (
        <FlatList
          data={checkpoints}
          keyExtractor={(cp) => cp.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: cp, index }) => {
            const selected = cp.id === selectedId;
            return (
              <Pressable
                onPress={() => void selectCheckpoint(cp.id)}
                style={[
                  styles.row,
                  { borderBottomColor: String(subtleColor) },
                ]}
              >
                <View style={styles.rowLeft}>
                  <IconSymbol size={16} name="flag.fill" color={String(tint)} />
                </View>
                <View style={styles.rowMain}>
                  <ThemedText type={selected ? 'defaultSemiBold' : 'default'} numberOfLines={1}>
                    {cp.label?.trim() ? cp.label.trim() : `Checkpoint ${index + 1}`}
                  </ThemedText>
                  <ThemedText style={[styles.rowMeta, { color: String(subtleColor) }]} numberOfLines={1}>
                    {formatLatLon(cp.latitude)}, {formatLatLon(cp.longitude)}
                  </ThemedText>
                </View>
                <View style={styles.rowRight}>
                  <Pressable
                    onPress={() => {
                      void alert({
                        title: 'Delete checkpoint?',
                        message: cp.label?.trim()
                          ? `Delete “${cp.label.trim()}”?`
                          : `Delete Checkpoint ${index + 1}?`,
                        buttons: [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => void removeCheckpoint(cp.id),
                          },
                        ],
                      });
                    }}
                    style={[styles.deleteCheckpointButton, { borderColor: String(subtleColor) }]}
                  >
                    <ThemedText style={{ color: String(subtleColor) }}>Delete</ThemedText>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  count: {
    fontSize: 18,
    fontWeight: '600',
  },
  actionsCard: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionsRowBottom: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeNameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  actionButton: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonSmall: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtleInline: {
    fontSize: 12,
  },
  savedRoutesWrap: {
    marginTop: 10,
  },
  routeRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  routeRowMain: {
    flex: 1,
  },
  routeRowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeRowMeta: {
    marginTop: 4,
    fontSize: 12,
  },
  deleteButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  editor: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  editorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editorCoords: {
    marginLeft: 'auto',
    fontSize: 12,
  },
  editorInput: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  emptySelected: {
    marginTop: 10,
    paddingHorizontal: 4,
    fontSize: 13,
  },
  emptyState: {
    marginTop: 12,
    paddingHorizontal: 4,
    fontSize: 13,
  },
  list: {
    paddingTop: 6,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    marginTop: 6,
  },
  rowLeft: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: {
    flex: 1,
    paddingRight: 10,
  },
  rowRight: {
    minWidth: 64,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteCheckpointButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  selectedPill: {
    fontSize: 12,
    fontWeight: '600',
  },
});
