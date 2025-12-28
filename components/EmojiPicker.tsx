import { Modal, StyleSheet, TouchableOpacity, View, FlatList, TextInput } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from './ui/icon-symbol';
import { ALL_EMOJIS } from '@/constants/emojis';
import { useState, useMemo } from 'react';

type EmojiPickerProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
};

export function EmojiPicker({ visible, onClose, onSelect }: EmojiPickerProps) {
  const iconColor = useThemeColor({}, 'icon');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'icon');
  const [search, setSearch] = useState('');

  const filteredEmojis = useMemo(() => {
    if (!search) return ALL_EMOJIS;
    const q = search.toLowerCase();
    return ALL_EMOJIS.filter(item => 
      item.emoji.includes(q) || item.keywords.some(k => k.includes(q))
    );
  }, [search]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <ThemedView style={[styles.container, { borderColor, borderWidth: 1 }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Select Icon</ThemedText>
            <TouchableOpacity onPress={onClose}>
              <IconSymbol name="xmark" size={24} color={iconColor} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchContainer, { borderColor }]}>
            <IconSymbol name="magnifyingglass" size={20} color={placeholderColor} style={{ marginRight: 8 }} />
            <TextInput
                style={[styles.input, { color: textColor }]}
                placeholder="Search emojis..."
                placeholderTextColor={placeholderColor}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
            />
            {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                    <IconSymbol name="xmark.circle.fill" size={16} color={placeholderColor} />
                </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            data={filteredEmojis}
            keyExtractor={(item) => item.emoji}
            numColumns={6}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => { onSelect(item.emoji); onClose(); setSearch(''); }}>
                <ThemedText style={{ fontSize: 32 }}>{item.emoji}</ThemedText>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                    <ThemedText style={{ opacity: 0.6 }}>No emojis found</ThemedText>
                </View>
            }
          />
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
    maxHeight: '70%',
    borderRadius: 12,
    padding: 16,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0, // remove default padding on Android
  },
  list: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  item: {
    padding: 8,
    margin: 4,
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
  },
});
