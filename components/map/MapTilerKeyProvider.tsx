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

export function MapTilerKeyProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [orientationModalVisible, setOrientationModalVisible] = useState(false);
  const [orientationGranted, setOrientationGranted] = useState(false);

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
              else setOrientationGranted(true);
            }
          }
        } else {
          setShowModal(true);
        }
      } catch (e) {
        setShowModal(true);
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
                  else if (orientOk) setOrientationGranted(true);
                }
              }
            } else {
              if (mounted) setShowModal(true);
            }
          } catch (e) {
            if (mounted) setShowModal(true);
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
    } catch (e: any) {
      return { ok: false, message: e?.message ?? 'Network error' };
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
      // after receiving a valid API key, request location permission
      const locOk = await requestLocationPermission();
      if (!locOk) setLocationModalVisible(true);
    } catch (e) {
      Alert.alert('Storage error', 'Failed to save the API key for future launches.');
    }
  }

  async function requestLocationPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        if (!('geolocation' in navigator)) return false;
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
            { timeout: 5000 }
          );
        });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        return status === 'granted';
      }
    } catch (e) {
      return false;
    }
  }

  async function requestOrientationPermission(): Promise<boolean> {
    try {
      if (Platform.OS !== 'web') return true; // orientation permission API is for web/iOS Safari
      // If DeviceOrientationEvent.requestPermission exists (iOS Safari), call it
      const dev = window as any;
      if (!('DeviceOrientationEvent' in window)) return false;
      const ctor: any = (DeviceOrientationEvent as any);
      if (typeof ctor.requestPermission === 'function') {
        try {
          const result = await ctor.requestPermission();
          return result === 'granted';
        } catch (e) {
          return false;
        }
      }
      // Other browsers do not require explicit permission for deviceorientation
      return true;
    } catch (e) {
      return false;
    }
  }

  async function clearApiKey() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore storage errors
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
            <Text style={styles.help}>This app needs a free MapTiler API key to load maps.</Text>
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
                Get key
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
                  const ok = await requestLocationPermission();
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
