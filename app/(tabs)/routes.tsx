import { alert as showAlert } from '@/components/alert';
import { useThemeColor } from '@/hooks/use-theme-color';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { FlatList, Modal, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import StyledButton from '@/components/ui/StyledButton';

type RouteItem = { id: string; title: string; subtitle?: string; icon?: string };
const ROUTES_KEY = 'APP_ROUTES';

export default function RoutesScreen() {
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [icon, setIcon] = useState('📍');
  const [modalError, setModalError] = useState<string | null>(null);

  function resetForm() {
    setTitle('');
    setSubtitle('');
    setIcon('📍');
  }

  function extractEmoji(s: string) {
    try {
      const m = s.match(/\p{Extended_Pictographic}/u);
      return m ? m[0] : '';
    } catch (_e) {
      // Fallback: basic emoji-ish characters (digits, punctuation removed)
      return s.replace(/[\w\d\s]/g, '').slice(0, 2);
    }
  }

  function handleAdd() {
    setModalError(null);
    const t = title.trim();
    const ic = icon.trim();
    if (!t) {
      setModalError('Title is required');
      return;
    }
    if (!ic) {
      setModalError('Icon is required');
      return;
    }
    const item: RouteItem = { id: String(Date.now()), title: t, subtitle: subtitle.trim() || undefined, icon: ic || undefined };
    setRoutes((r) => [item, ...r]);
    resetForm();
    setModalError(null);
    setOpen(false);
  }

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ROUTES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as RouteItem[];
          if (Array.isArray(parsed)) setRoutes(parsed);
        }
      } catch (err) {
        void showAlert({ title: 'Routes', message: String(err) });
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
      } catch (err) {
        void showAlert({ title: 'Routes save', message: String(err) });
      }
    })();
  }, [routes]);

  const cardBg = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'icon');

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <View style={styles.headerRow}>
          <ThemedText type="title">Routes</ThemedText>
          <StyledButton variant="primary" onPress={() => setOpen(true)}>Add</StyledButton>
        </View>

        <View style={styles.stackContainer}>
          <FlatList
            data={routes}
            keyExtractor={(i) => i.id}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.card,
                  { backgroundColor: cardBg, marginTop: index === 0 ? 0 : -8, zIndex: routes.length - index, borderColor, borderWidth: 1 },
                ]}
              >
                <View style={styles.cardLeft}>
                  <ThemedText type="title">{item.icon ?? '📍'}</ThemedText>
                </View>
                <View style={styles.cardBody}>
                  <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
                  {item.subtitle ? <ThemedText>{item.subtitle}</ThemedText> : null}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<ThemedText>No routes yet — tap Add to create one.</ThemedText>}
          />
        </View>

        <Modal visible={open} animationType="slide" transparent={true}>
            <View style={styles.modalBackdrop}>
            <View style={[styles.modalContainer, { backgroundColor: cardBg, borderColor, borderWidth: 1 }]}> 
              <ThemedText type="title">New Route</ThemedText>
              <TextInput
                placeholder="Emoji (e.g. 🧭)"
                value={icon}
                onChangeText={(t) => {
                  const e = extractEmoji(t);
                  if (e) setIcon(e);
                  else setIcon('');
                  setModalError(null);
                }}
                style={[styles.input, { color: textColor, borderColor, textAlign: 'left' }]}
                placeholderTextColor={placeholderColor}
                maxLength={2}
                autoCorrect={false}
              />
              <TextInput placeholder="Title" value={title} onChangeText={(t) => { setTitle(t); setModalError(null); }} style={[styles.input, { color: textColor, borderColor }]} placeholderTextColor={placeholderColor} maxLength={80} />
              <TextInput placeholder="Subtitle" value={subtitle} onChangeText={(t) => { setSubtitle(t); setModalError(null); }} style={[styles.input, { color: textColor, borderColor }]} placeholderTextColor={placeholderColor} maxLength={120} />
              {modalError ? <ThemedText style={styles.error}>{modalError}</ThemedText> : null}
              <View style={styles.modalRow}>
                <StyledButton variant="secondary" onPress={() => { resetForm(); setModalError(null); setOpen(false); }}>Cancel</StyledButton>
                <View style={{ width: 12 }} />
                <StyledButton variant="primary" onPress={handleAdd} disabled={!title.trim() || !icon.trim()}>Add</StyledButton>
              </View>
            </View>
          </View>
        </Modal>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stackContainer: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  cardLeft: { width: 48, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', backgroundColor: 'white', padding: 16, borderRadius: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, marginTop: 8 },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  error: { color: 'red', marginTop: 8, marginBottom: 4 },
});
