import { alert as showAlert } from '@/components/alert';
import StyledButton from '@/components/ui/StyledButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, AppStateStatus, Linking, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

const STORAGE_KEY = 'MAPTILER_API_KEY';

type ContextValue = {
  apiKey: string | null;
  loading: boolean;
  clearApiKey: () => Promise<void>;
  promptForKey: () => void;
};

const MapTilerKeyContext = createContext<ContextValue>({ apiKey: null, loading: true, clearApiKey: async () => {}, promptForKey: () => {} });

export function useMapTilerKey() {
  return useContext(MapTilerKeyContext);
}

function MapTilerKeyProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [orientationModalVisible, setOrientationModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const res = await verifyKey(saved);
          if (res.ok) setApiKey(saved);
          else {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setShowModal(true);
          }
          // if we have a valid saved key, ensure we have location permission
          if (saved && res.ok) {
            const locOk = await requestLocationPermission();
            if (!locOk) setLocationModalVisible(true);
            else {
              const orientOk = await requestOrientationPermission();
              if (!orientOk) setOrientationModalVisible(true);
            }
          }
        } else {
          setShowModal(true);
        }
      } catch (err) {
        setShowModal(true);
        void showAlert({ title: 'MapTilerKeyProvider', message: String(err) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Re-check API key and location permission whenever the app becomes active
  useEffect(() => {
    let mounted = true;
    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        (async () => {
          try {
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            if (saved) {
              const res = await verifyKey(saved);
              if (!res.ok) {
                await AsyncStorage.removeItem(STORAGE_KEY);
                if (!mounted) return;
                setApiKey(null);
                setShowModal(true);
                return;
              }
              if (!mounted) return;
              setApiKey(saved);
              if (!locationModalVisible) {
                const locOk = await requestLocationPermission();
                if (!locOk && mounted) setLocationModalVisible(true);
                else {
                  const orientOk = await requestOrientationPermission();
                  if (!orientOk && mounted) setOrientationModalVisible(true);
                }
              }
            } else {
              if (mounted) setShowModal(true);
            }
          } catch (err) {
            if (mounted) setShowModal(true);
            void showAlert({ title: 'MapTilerKeyProvider', message: String(err) });
          }
        })();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [locationModalVisible]);

  async function verifyKey(key: string) {
    try {
      // Use a random tile at zoom level 20 to verify the API key.
      const z = 20;
      const max = 1 << z; // 2^20 = 1,048,576
      const x = Math.floor(Math.random() * max);
      const y = Math.floor(Math.random() * max);
      const url = `https://api.maptiler.com/maps/outdoor-v4/256/${z}/${x}/${y}.png?key=${key}`;
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return { ok: true };
      // Provide status info for better debugging when used from the modal
      return { ok: false, message: `Request failed: ${res.status} ${res.statusText}` };
    } catch (err: any) {
      void showAlert({ title: 'MapTiler verifyKey', message: String(err) });
      return { ok: false, message: err?.message ?? 'Network error' };
    }
  }

  async function onSubmit() {
    if (!input) return Alert.alert('API Key required', 'Please enter your MapTiler API key.');
    setVerifying(true);
    const res = await verifyKey(input.trim());
    setVerifying(false);
    if (!res.ok) {
      setError(res.message ?? 'The provided MapTiler API key is invalid. Please check it and try again.');
      return;
    }
    setError(null);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, input.trim());
      setApiKey(input.trim());
      setShowModal(false);
      // after receiving a valid API key, request location permission (prompt user)
      const locOk = await requestLocationPermission(true);
      if (!locOk) setLocationModalVisible(true);
    } catch (err) {
      Alert.alert('Storage error', 'Failed to save the API key for future launches.');
      void showAlert({ title: 'MapTiler storage error', message: String(err) });
    }
  }

  // If `forceRequest` is true, actively requests permission (may trigger browser prompt).
  // If false, only checks current permission state and avoids prompting on web.
  async function requestLocationPermission(forceRequest = false): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        if (!('geolocation' in navigator)) return false;

        // Prefer the Permissions API when available so we can check state without prompting.
        const perms = (navigator as any).permissions;
        if (perms && typeof perms.query === 'function') {
          try {
            const status = await perms.query({ name: 'geolocation' } as any);
            if (status.state === 'granted') return true;
            if (status.state === 'denied') return false;
            // state === 'prompt'
            if (!forceRequest) return false; // avoid prompting automatically
            // fall through to actively request below
          } catch {
            // ignore and fall back to getCurrentPosition below
          }
        } else if (!forceRequest) {
          // No Permissions API and not forced: avoid triggering prompt
          return false;
        }

        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
            { timeout: 8000 }
          );
        });
      } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            if (Platform.OS === 'android') {
              try {
                // Prompt user to enable high-accuracy network provider (Google Play services).
                // Resolves when the user accepts; rejects if denied or unavailable.
                // @ts-ignore: may not exist on all SDK versions
                await Location.enableNetworkProviderAsync();
              } catch {
                // Show the location modal so user can open settings or retry.
                setLocationModalVisible(true);
                void showAlert({
                  title: 'High accuracy location',
                  message:
                    'Enabling high accuracy (Google Play services) improves location quality. Please enable it in settings or retry.',
                });
              }
            }
            return true;
          }
          return false;
      }
    } catch (err) {
      void showAlert({ title: 'MapTiler requestLocationPermission', message: String(err) });
      return false;
    }
  }

  async function requestOrientationPermission(): Promise<boolean> {
    try {
      if (Platform.OS !== 'web') return true; // orientation permission API is for web/iOS Safari
      // If DeviceOrientationEvent.requestPermission exists (iOS Safari), call it
      if (!('DeviceOrientationEvent' in window)) return false;
      const ctor: any = (DeviceOrientationEvent as any);
      if (typeof ctor.requestPermission === 'function') {
        try {
          const result = await ctor.requestPermission();
          return result === 'granted';
        } catch (err: any) {
          const name = err?.name;
          const msg = String(err?.message ?? err);
          // Ignore errors caused by calling requestPermission without a user gesture
          if (name === 'NotAllowedError' || /user gesture/i.test(msg)) {
            return false;
          }
          void showAlert({ title: 'MapTiler requestOrientationPermission', message: msg });
          return false;
        }
      }
      // Other browsers do not require explicit permission for deviceorientation
      return true;
    } catch (err: any) {
      const name = err?.name;
      const msg = String(err?.message ?? err);
      if (name === 'NotAllowedError' || /user gesture/i.test(msg)) {
        return false;
      }
      void showAlert({ title: 'MapTiler requestOrientationPermission', message: msg });
      return false;
    }
  }

  async function clearApiKey() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      void showAlert({ title: 'MapTiler clearApiKey', message: String(err) });
    }
    setApiKey(null);
    setInput('');
    setError(null);
    setShowModal(true);
  }

  function promptForKey() {
    setError(null);
    setShowModal(true);
  }

  function openSettings() {
    if (Platform.OS === 'web') {
      // open a help page guiding the user to enable site location permissions
      Linking.openURL('https://support.google.com/chrome/answer/142065');
    } else {
      Linking.openSettings();
    }
  }

  return (
    <MapTilerKeyContext.Provider value={{ apiKey, loading, clearApiKey, promptForKey }}>
      {children}

      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.backdrop}>
          <View style={styles.container}>
            <Text style={styles.title}>MapTiler API Key</Text>
            <Text style={styles.help}>Woah there! This app needs a free MapTiler API key to load maps.</Text>
            <TextInput
              placeholder="Enter MapTiler API key"
              value={input}
              onChangeText={(t) => {
                setInput(t);
                setError(null);
              }}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.row}>
              <StyledButton variant="secondary" onPress={() => Linking.openURL('https://www.maptiler.com/')}>
                Take Me There!
              </StyledButton>
              <View style={styles.spacer} />
              <StyledButton variant="primary" onPress={onSubmit} disabled={verifying}>
                {verifying ? <ActivityIndicator color="#fff" /> : 'Verify & Save'}
              </StyledButton>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={locationModalVisible} animationType="fade" transparent={true}>
        <View style={styles.backdrop}>
          <View style={styles.container}>
            <Text style={styles.title}>Location Permission Required</Text>
            <Text style={styles.help}>This app requires location access to function. Please enable location for this app/site.</Text>
            <View style={styles.row}>
              <StyledButton variant="secondary" onPress={openSettings}>
                Open Settings
              </StyledButton>
              <View style={styles.spacer} />
              <StyledButton
                variant="primary"
                onPress={async () => {
                  const ok = await requestLocationPermission(true);
                  if (ok) setLocationModalVisible(false);
                }}
              >
                Retry
              </StyledButton>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={orientationModalVisible} animationType="fade" transparent={true}>
        <View style={styles.backdrop}>
          <View style={styles.container}>
            <Text style={styles.title}>Orientation Permission Required</Text>
            <Text style={styles.help}>This app needs access to device orientation (compass) to show device heading. Please grant access to continue.</Text>
            <View style={styles.row}>
              <StyledButton variant="secondary" onPress={() => { /* guide text only */ }}>
                Help
              </StyledButton>
              <View style={styles.spacer} />
              <StyledButton
                variant="primary"
                onPress={async () => {
                  const ok = await requestOrientationPermission();
                  if (ok) {
                    setOrientationGranted(true);
                    setOrientationModalVisible(false);
                  } else {
                    // keep modal visible; user must grant to continue
                    setOrientationModalVisible(true);
                  }
                }}
              >
                Grant
              </StyledButton>
            </View>
          </View>
        </View>
      </Modal>
    </MapTilerKeyContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  help: {
    marginBottom: 12,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: { width: 12 },
  error: {
    color: '#b00020',
    marginBottom: 12,
  },
  
});

export default MapTilerKeyProvider;
