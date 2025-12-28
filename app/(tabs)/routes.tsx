import { alert as showAlert } from '@/components/alert';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useThemeColor } from '@/hooks/use-theme-color';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import StyledButton from '@/components/ui/StyledButton';
import { Collapsible } from '@/components/ui/collapsible';
import { Colors } from '@/constants/theme';
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';

type RouteItem = { id: string; title: string; subtitle?: string; icon?: string };
const ROUTES_KEY = 'APP_ROUTES';

export default function RoutesScreen() {
  const router = useRouter();
  const { requestPlacementMode, selectedCheckpoint, addCheckpoint } = useCheckpoints();
  const { lastLocation, requestLocation } = useGPS();
  const { mapGridEnabled, mapGridSubdivisionsEnabled, mapGridNumbersEnabled, mapGridOrigin, setSetting } = useSettings();
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [icon, setIcon] = useState('📍');
  const [modalError, setModalError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  

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
    // Save new or edited route
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

    if (editingId) {
      setRoutes((r) => r.map((it) => (it.id === editingId ? { ...it, title: t, subtitle: subtitle.trim() || undefined, icon: ic || undefined } : it)));
    } else {
      const item: RouteItem = { id: String(Date.now()), title: t, subtitle: subtitle.trim() || undefined, icon: ic || undefined };
      setRoutes((r) => [item, ...r]);
    }

    resetForm();
    setEditingId(null);
    setModalError(null);
    setOpen(false);
  }

  function handleEdit(item: RouteItem) {
    setModalError(null);
    setTitle(item.title);
    setSubtitle(item.subtitle ?? '');
    setIcon(item.icon ?? '📍');
    setEditingId(item.id);
    setOpen(true);
  }

  function handleRemove(id: string) {
    setRoutes((r) => r.filter((it) => it.id !== id));
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
  const safeBg = useThemeColor({}, 'background');

  const gridOriginLabel = useMemo(() => {
    if (!mapGridOrigin) return 'None';
    return `${mapGridOrigin.latitude.toFixed(6)}, ${mapGridOrigin.longitude.toFixed(6)}`;
  }, [mapGridOrigin]);

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: safeBg }]}> 
      <ThemedView style={styles.container}>
        <View style={styles.headerRow}>
          <ThemedText type="title">Routes</ThemedText>
          <StyledButton variant="primary" onPress={() => { resetForm(); setEditingId(null); setOpen(true); }}>Add</StyledButton>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor, borderWidth: 1, alignSelf: 'center', width: '98%' }]}>
          <Collapsible
            header={
                <View style={{ flexDirection: 'column', justifyContent: 'center', minHeight: 48, paddingVertical: 2 }}>
                  <ThemedText type="defaultSemiBold" style={{ lineHeight: 22 }}>Grid</ThemedText>
                  <ThemedText style={{ lineHeight: 20 }}>Map grid overlays and origin</ThemedText>
                  <ThemedText style={{ lineHeight: 20 }}>(Will not show until zoomed in enough)</ThemedText>
                </View>
            }
          >
            <View style={styles.gridRow}>
              <ThemedText type="defaultSemiBold">Enabled</ThemedText>
              <Switch value={mapGridEnabled} onValueChange={(v) => void setSetting('mapGridEnabled', v)} />
            </View>

            <View style={styles.gridRow}>
              <ThemedText type="defaultSemiBold">Subdivisions</ThemedText>
              <Switch
                value={mapGridSubdivisionsEnabled}
                onValueChange={(v) => void setSetting('mapGridSubdivisionsEnabled', v)}
                disabled={!mapGridEnabled}
              />
            </View>

            <View style={styles.gridRow}>
              <ThemedText type="defaultSemiBold">Grid numbers</ThemedText>
              <Switch
                value={mapGridNumbersEnabled}
                onValueChange={(v) => void setSetting('mapGridNumbersEnabled', v)}
                disabled={!mapGridEnabled}
              />
            </View>

            <View style={{ marginTop: 8 }}>
              <ThemedText type="defaultSemiBold">Origin (0,0)</ThemedText>
              <ThemedText>{gridOriginLabel}</ThemedText>
            </View>

            <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center', gap: 12 }}>
              <StyledButton
                variant="secondary"
                onPress={() => {
                  if (!lastLocation) {
                    requestLocation();
                    return;
                  }
                  void setSetting('mapGridOrigin', { latitude: lastLocation.coords.latitude, longitude: lastLocation.coords.longitude });
                }}
                disabled={!mapGridEnabled}
                style={{ marginBottom: 8 }}
              >
                Use current
              </StyledButton>

              <StyledButton
                variant="secondary"
                onPress={() => {
                  if (!selectedCheckpoint) return;
                  void setSetting('mapGridOrigin', { latitude: selectedCheckpoint.latitude, longitude: selectedCheckpoint.longitude });
                }}
                disabled={!mapGridEnabled || !selectedCheckpoint}
                style={{ marginBottom: 8 }}
              >
                Select point
              </StyledButton>
            </View>

            
          </Collapsible>
        </View>

        <View style={styles.stackContainer}>
          <FlatList
            data={routes}
            keyExtractor={(i) => i.id}
            renderItem={({ item, index }) => (
              <View style={[styles.card, { backgroundColor: cardBg, marginTop: index === 0 ? 0 : -8, zIndex: routes.length - index, borderColor, borderWidth: 1, alignSelf: 'center', width: '98%' }]}> 
                <Collapsible
                  header={
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={styles.cardLeft}>
                        <ThemedText type="title">{item.icon ?? '📍'}</ThemedText>
                      </View>
                      <View style={styles.cardBody}>
                        <ThemedText lightColor={Colors.light.text} darkColor={Colors.dark.text} type="defaultSemiBold">{item.title}</ThemedText>
                        {item.subtitle ? <ThemedText lightColor={Colors.light.text} darkColor={Colors.dark.text}>{item.subtitle}</ThemedText> : null}
                      </View>
                    </View>
                  }
                >
                  <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center', gap: 12 }}>
                    <StyledButton
                      variant="primary"
                      onPress={() => {
                        void requestPlacementMode();
                        router.push('/');
                      }}
                      style={{ marginBottom: 8 }}
                    >
                      Add
                    </StyledButton>
                    <StyledButton variant="secondary" onPress={() => handleEdit(item)} style={{ marginBottom: 8 }}>Edit</StyledButton>
                    <StyledButton variant="secondary" onPress={() => handleRemove(item.id)} style={{ marginBottom: 8 }}>Remove</StyledButton>
                  </View>
                </Collapsible>
              </View>
            )}
            ListEmptyComponent={<ThemedText>No routes yet — tap Add to create one.</ThemedText>}
          />
        </View>

        <Modal visible={open} animationType="slide" transparent={true}>
            <View style={styles.modalBackdrop}>
            <View style={[styles.modalContainer, { backgroundColor: cardBg, borderColor, borderWidth: 1 }]}> 
              <ThemedText type="title">{editingId ? 'Edit Route' : 'New Route'}</ThemedText>
              <TextInput
                placeholder="Emoji (e.g. 🧭)"
                value={icon}
                onChangeText={(t) => {
                  const e = extractEmoji(t);
                  if (e) setIcon(e);
                  else setIcon('');
                  setModalError(null);
                }}
                style={[styles.input, { color: textColor ?? Colors.light.text, borderColor, textAlign: 'left' }]}
                placeholderTextColor={placeholderColor}
                maxLength={2}
                autoCorrect={false}
              />
              <TextInput placeholder="Title" value={title} onChangeText={(t) => { setTitle(t); setModalError(null); }} style={[styles.input, { color: textColor ?? Colors.light.text, borderColor }]} placeholderTextColor={placeholderColor} maxLength={80} />
              <TextInput placeholder="Subtitle" value={subtitle} onChangeText={(t) => { setSubtitle(t); setModalError(null); }} style={[styles.input, { color: textColor ?? Colors.light.text, borderColor }]} placeholderTextColor={placeholderColor} maxLength={120} />
              {modalError ? <ThemedText style={styles.error}>{modalError}</ThemedText> : null}
              <View style={styles.modalRow}>
                <StyledButton variant="secondary" onPress={() => { resetForm(); setModalError(null); setOpen(false); setEditingId(null); }}>Cancel</StyledButton>
                <View style={{ width: 12 }} />
                <StyledButton variant="primary" onPress={handleAdd} disabled={!title.trim() || !icon.trim()}>{editingId ? 'Save' : 'Add'}</StyledButton>
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
  gridRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  stackContainer: { flex: 1, paddingTop: 5 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  cardLeft: { width: 48, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', backgroundColor: 'white', padding: 16, borderRadius: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, marginTop: 8 },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  error: { color: 'red', marginTop: 8, marginBottom: 4 },
});
