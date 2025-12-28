import { alert as showAlert } from '@/components/alert';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useThemeColor } from '@/hooks/use-theme-color';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddRoutePanel } from '@/components/AddRoutePanel';
import { GridReferenceModal } from '@/components/GridReferenceModal';
import { ProjectPointModal } from '@/components/ProjectPointModal';
import { SavedRoutesModal } from '@/components/SavedRoutesModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import StyledButton from '@/components/ui/StyledButton';
import { Colors } from '@/constants/theme';
import { SavedRoute } from '@/hooks/checkpoints';
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
  const [addPanelVisible, setAddPanelVisible] = useState(false);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [referenceModalVisible, setReferenceModalVisible] = useState(false);
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [savedRoutesModalVisible, setSavedRoutesModalVisible] = useState(false);
  const [originModalVisible, setOriginModalVisible] = useState(false);
  const [originChoice, setOriginChoice] = useState<'origin' | 'reference'>('origin');
  const [easting, setEasting] = useState('');
  const [northing, setNorthing] = useState('');
  const [originError, setOriginError] = useState<string | null>(null);

  function handleAddPanelSelect(option: string) {
    setAddPanelVisible(false);
    
    if (option === 'place') {
        void requestPlacementMode();
        router.push('/');
        setActiveRouteId(null);
    } else if (option === 'reference') {
        setReferenceModalVisible(true);
    } else if (option === 'project') {
        setProjectModalVisible(true);
    } else if (option === 'saved') {
        setSavedRoutesModalVisible(true);
    }
  }

  function handleAddPoint(location: { latitude: number; longitude: number }) {
      addCheckpoint(location.latitude, location.longitude);
      setReferenceModalVisible(false);
      setProjectModalVisible(false);
      setActiveRouteId(null);
      router.push('/');
  }

  function handleAddSavedRoute(route: SavedRoute) {
      // Add all checkpoints from the saved route
      // We do this sequentially to preserve order if addCheckpoint is async/state-dependent
      // Although addCheckpoint updates global store synchronously, it's safer to just loop.
      route.checkpoints.forEach(cp => {
          addCheckpoint(cp.latitude, cp.longitude);
      });
      
      setSavedRoutesModalVisible(false);
      setActiveRouteId(null);
      router.push('/');
  }

  function parseGridComponent(s: string): number | null {
    // Accept only 3 or 4 digits. First two digits are km, remaining digits are decimal part of km.
    if (!/^[0-9]{3,4}$/.test(s)) return null;
    const kmPart = parseInt(s.slice(0, 2), 10);
    const decPart = s.slice(2);
    const dec = decPart ? Number('0.' + decPart) : 0;
    return kmPart + dec;
  }

  function handleConfirmOrigin() {
    if (!lastLocation) {
      setOriginError('Current location unavailable');
      return;
    }

    const lat = lastLocation.coords.latitude;
    const lon = lastLocation.coords.longitude;

    if (originChoice === 'origin') {
      void setSetting('mapGridOrigin', { latitude: lat, longitude: lon });
      setOriginModalVisible(false);
      setActiveRouteId(null);
      return;
    }

    // reference chosen
    const e = parseGridComponent(easting);
    const n = parseGridComponent(northing);
    if (e === null || n === null) {
      setOriginError('Eastings and northings must be 3 or 4 digits');
      return;
    }

    // Convert km offsets to degrees
    const kmPerDegLat = 111.32; // approximate
    const kmPerDegLon = 111.32 * Math.cos((lat * Math.PI) / 180);

    // According to spec: if easting is 023, origin is 02.3 km LEFT of current -> longitude decreases
    const originLon = lon - e / kmPerDegLon;
    // if northing is 2134, origin is 21.34 km DOWN of current -> latitude decreases
    const originLat = lat - n / kmPerDegLat;

    void setSetting('mapGridOrigin', { latitude: originLat, longitude: originLon });
    setOriginModalVisible(false);
    setActiveRouteId(null);
  }

  

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
                  setOriginChoice('origin');
                  setEasting('');
                  setNorthing('');
                  setOriginError(null);
                  setOriginModalVisible(true);
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
                        setActiveRouteId(item.id);
                        setAddPanelVisible(true);
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

        <AddRoutePanel 
          visible={addPanelVisible} 
          onClose={() => { setAddPanelVisible(false); setActiveRouteId(null); }} 
          onSelect={handleAddPanelSelect} 
        />

        <GridReferenceModal 
            visible={referenceModalVisible} 
            onClose={() => { setReferenceModalVisible(false); setActiveRouteId(null); }}
            onAdd={handleAddPoint}
        />

        <ProjectPointModal 
            visible={projectModalVisible} 
            onClose={() => { setProjectModalVisible(false); setActiveRouteId(null); }}
            onAdd={handleAddPoint}
        />

        <SavedRoutesModal 
            visible={savedRoutesModalVisible} 
            onClose={() => { setSavedRoutesModalVisible(false); setActiveRouteId(null); }}
            onSelect={handleAddSavedRoute}
        />

        <Modal visible={originModalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContainer, { backgroundColor: cardBg, borderColor, borderWidth: 1 }]}> 
              <ThemedText type="title">Use current location as</ThemedText>

              <View style={{ marginTop: 8 }}>
                <TouchableOpacity onPress={() => setOriginChoice('origin')} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
                  <View style={[styles.radioOuter, originChoice === 'origin' && styles.radioOuterSelected]}>
                    {originChoice === 'origin' ? <View style={styles.radioInner} /> : null}
                  </View>
                  <ThemedText style={{ marginLeft: 8 }}>Origin (set current as origin)</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setOriginChoice('reference')} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
                  <View style={[styles.radioOuter, originChoice === 'reference' && styles.radioOuterSelected]}>
                    {originChoice === 'reference' ? <View style={styles.radioInner} /> : null}
                  </View>
                  <ThemedText style={{ marginLeft: 8 }}>Grid reference (enter eastings & northings)</ThemedText>
                </TouchableOpacity>
              </View>

              {originChoice === 'reference' ? (
                <View style={{ marginTop: 8 }}>
                  <ThemedText type="defaultSemiBold">Eastings</ThemedText>
                  <TextInput
                    placeholder="e.g. 023 or 1023"
                    value={easting}
                    onChangeText={(t) => { setEasting(t.replace(/[^0-9]/g, '')); setOriginError(null); }}
                    style={[styles.input, { color: textColor ?? Colors.light.text, borderColor }]}
                    placeholderTextColor={placeholderColor}
                    maxLength={4}
                    keyboardType="numeric"
                  />

                  <ThemedText type="defaultSemiBold" style={{ marginTop: 8 }}>Northings</ThemedText>
                  <TextInput
                    placeholder="e.g. 213 or 2134"
                    value={northing}
                    onChangeText={(t) => { setNorthing(t.replace(/[^0-9]/g, '')); setOriginError(null); }}
                    style={[styles.input, { color: textColor ?? Colors.light.text, borderColor }]}
                    placeholderTextColor={placeholderColor}
                    maxLength={4}
                    keyboardType="numeric"
                  />

                  <ThemedText style={{ marginTop: 6, fontSize: 12 }}>Enter 3 or 4 digits. First two digits are km; remaining digits are decimals of km.</ThemedText>
                </View>
              ) : null}

              {originError ? <ThemedText style={styles.error}>{originError}</ThemedText> : null}

              <View style={styles.modalRow}>
                <StyledButton variant="secondary" onPress={() => { setOriginModalVisible(false); }}>{'Cancel'}</StyledButton>
                <View style={{ width: 12 }} />
                <StyledButton variant="primary" onPress={handleConfirmOrigin}>{'Set'}</StyledButton>
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
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#999', alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: '#007AFF' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#007AFF' },
});
