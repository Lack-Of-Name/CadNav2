import { alert as showAlert } from '@/components/alert';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import StyledButton from '@/components/ui/StyledButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MAPTILER_API_KEY as STORAGE_KEY } from '@/constants/storageKeys';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, AppStateStatus, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

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
  const [showModal, setShowModal] = useState(true);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [orientationModalVisible, setOrientationModalVisible] = useState(false);
  const inputTextColor = useThemeColor({}, 'text');
  const inputBorderColor = useThemeColor({}, 'tabIconDefault');
  const placeholderColor = useThemeColor({ light: '#999', dark: '#666' }, 'text');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          setApiKey(saved);
          // Instantly finish loading before permissions check
          setLoading(false);
          // Do not verify the key network request if we already have it to avoid locking out the app when offline!
          const locOk = await requestLocationPermission();
          if (!locOk) setLocationModalVisible(true);
          else {
            const orientOk = await requestOrientationPermission();
            if (!orientOk) setOrientationModalVisible(true);
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

  // Re-check location permission whenever the app becomes active, skip API key verification to prevent offline wait states
  useEffect(() => {
    let mounted = true;
    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        (async () => {
          try {
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            if (saved) {
              if (!mounted) return;
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
      const url = `https://api.maptiler.com/maps/outdoor-v2/256/${z}/${x}/${y}.png?key=${key}`;
      // Cap the verify request so a flaky field connection can't hang the modal forever.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return { ok: true, isNetworkError: false };
      
      // If we got an unauthorized/forbidden, the key is definitely invalid
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: `Invalid API key: ${res.status} ${res.statusText}`, isNetworkError: false };
      }
      
      // For rate limits (429) or server errors (5xx), we shouldn't assume the key is bad
      // and lock the user out, especially if they are out in the field.
      // Provide status info for better debugging when used from the modal
      return { ok: true, message: `Request failed but not resetting: ${res.status} ${res.statusText}`, isNetworkError: true };
    } catch (err: any) {
      // Network error / timeout, probably offline or flaky. Don't reject the key —
      // let the user save it and try the map; we only reject on an explicit 401/403 above.
      const isAbort = err?.name === 'AbortError';
      return { ok: true, message: isAbort ? 'Verification timed out — saved anyway. The map will confirm the key works.' : (err?.message ?? 'Network error'), isNetworkError: true };
    }
  }

  async function submitApiKey(rawInput: string) {
    const input = rawInput.trim();
    if (!input) return { ok: false, message: 'Please enter your MapTiler API key.' } as const;

    const res = await verifyKey(input);
    if (!res.ok) {
      return { ok: false, message: res.message ?? 'The provided MapTiler API key is invalid. Please check it and try again.' } as const;
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEY, input.trim());
      setApiKey(input.trim());
      setShowModal(false);
      // after receiving a valid API key, request location permission (prompt user)
      const locOk = await requestLocationPermission(true);
      if (!locOk) setLocationModalVisible(true);
      return { ok: true } as const;
    } catch (err) {
      Alert.alert('Storage error', 'Failed to save the API key for future launches.');
      void showAlert({ title: 'MapTiler storage error', message: String(err) });
      return { ok: false, message: String(err) } as const;
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
    setShowModal(true);
  }

  function promptForKey() {
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
      <KeyEntryModal
        visible={showModal}
        inputTextColor={inputTextColor}
        inputBorderColor={inputBorderColor}
        placeholderColor={placeholderColor}
        onCancel={() => setShowModal(false)}
        onOpenMapTiler={() => Linking.openURL('https://cloud.maptiler.com/account/keys/')}
        onSubmitKey={submitApiKey}
      />

      <Modal visible={locationModalVisible} animationType="fade" transparent={true}>
        <View style={styles.backdrop}>
          <ThemedView style={styles.container}>
            <ThemedText style={styles.title}>Location Permission Required</ThemedText>
            <ThemedText style={styles.help}>This app requires location access to function. Please enable location for this app/site.</ThemedText>
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
          </ThemedView>
        </View>
      </Modal>

      <Modal visible={orientationModalVisible} animationType="fade" transparent={true}>
        <View style={styles.backdrop}>
          <ThemedView style={styles.container}>
            <ThemedText style={styles.title}>Orientation Permission Required</ThemedText>
            <ThemedText style={styles.help}>This app needs access to device orientation (compass) to show device heading. Please grant access to continue.</ThemedText>
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
                    setOrientationModalVisible(false);
                  } else {
                    setOrientationModalVisible(true);
                  }
                }}
              >
                Grant
              </StyledButton>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </MapTilerKeyContext.Provider>
  );
}

function KeyEntryModal({
  visible,
  inputTextColor,
  inputBorderColor,
  placeholderColor,
  onCancel,
  onOpenMapTiler,
  onSubmitKey,
}: {
  visible: boolean;
  inputTextColor: string;
  inputBorderColor: string;
  placeholderColor: string;
  onCancel: () => void;
  onOpenMapTiler: () => void;
  onSubmitKey: (input: string) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const colorScheme = useColorScheme() ?? 'light';

  useEffect(() => {
    if (!visible) {
      setInput('');
      setError(null);
      setVerifying(false);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      presentationStyle="overFullScreen"
      statusBarTranslucent={Platform.OS === 'android'}
      navigationBarTranslucent={Platform.OS === 'android'}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.backdrop}>
          <ThemedView style={styles.container}>
            <ScrollView bounces={false} overScrollMode="never" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollBody}>
              <View style={styles.heroRow}>
                <View style={[styles.heroIcon, { backgroundColor: Colors[colorScheme].primary }]}>
                  <IconSymbol name="map.fill" size={22} color="#fff" />
                </View>
                <View style={styles.heroText}>
                  <ThemedText style={styles.title}>Load your maps</ThemedText>
                  <ThemedText style={styles.subtitle}>CadNav uses MapTiler — a free map provider</ThemedText>
                </View>
              </View>

              <ThemedText style={styles.help}>
                CadNav is free and open source, so to keep tile costs at zero we ask you to
                bring your own free MapTiler key. The free tier is generous and covers normal
                field use. It takes about two minutes.
              </ThemedText>

              <View style={styles.stepsBox}>
                <ThemedText style={styles.stepsTitle}>Get a free key in 3 steps</ThemedText>
                <View style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <ThemedText style={styles.stepBadgeText}>1</ThemedText>
                  </View>
                  <ThemedText style={styles.stepText}>Sign up at MapTiler (free)</ThemedText>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <ThemedText style={styles.stepBadgeText}>2</ThemedText>
                  </View>
                  <ThemedText style={styles.stepText}>Open your dashboard → Keys</ThemedText>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <ThemedText style={styles.stepBadgeText}>3</ThemedText>
                  </View>
                  <ThemedText style={styles.stepText}>Copy your key and paste it below</ThemedText>
                </View>
              </View>

              <TextInput
                autoFocus
                placeholder="Paste your MapTiler key"
                placeholderTextColor={placeholderColor}
                value={input}
                onChangeText={(t) => {
                  setInput(t);
                  setError(null);
                }}
                style={[styles.input, { color: inputTextColor, borderColor: inputBorderColor }]}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
              />
              {error ? <ThemedText style={[styles.error, { color: Colors[colorScheme].error }]}>{error}</ThemedText> : null}
              <View style={styles.row}>
                <StyledButton variant="secondary" onPress={onOpenMapTiler}>
                  Get a key
                </StyledButton>
                <View style={styles.spacer} />
                <StyledButton
                  variant="primary"
                  onPress={async () => {
                    setVerifying(true);
                    const result = await onSubmitKey(input);
                    setVerifying(false);
                    if (!result.ok) setError(result.message);
                  }}
                  disabled={verifying}
                >
                  {verifying ? <ActivityIndicator color="#fff" /> : 'Save key'}
                </StyledButton>
              </View>
              <TouchableOpacity
                style={styles.offlineLink}
                onPress={onCancel}
              >
                <ThemedText style={styles.offlineLinkText}>
                  Skip for now (offline mode)
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </ThemedView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    maxWidth: 500,
    padding: 20,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
  },
  help: {
    marginBottom: 16,
    opacity: 0.7,
    fontSize: 14,
    lineHeight: 20,
  },
  stepsBox: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  stepsTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    opacity: 0.7,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.7,
  },
  stepText: {
    fontSize: 14,
    flex: 1,
  },
  scrollBody: {
    paddingBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  spacer: { width: 12 },
  error: {
    marginBottom: 8,
  },
  offlineLink: {
    marginTop: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  offlineLinkText: {
    fontSize: 13,
    opacity: 0.5,
  },
  
});

export default MapTilerKeyProvider;
