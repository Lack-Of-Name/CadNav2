import { alert as showAlert } from '@/components/alert';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import StyledButton from '@/components/ui/StyledButton';
import { MAPTILER_API_KEY as STORAGE_KEY, TUTORIALS_COMPLETED } from '@/constants/storageKeys';
import { parseApiKeyInput } from '@/lib/apiKey';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Linking, Modal, Platform, StyleSheet, View } from 'react-native';

import { ApiKeyOnboarding } from './ApiKeyOnboarding';

type PromptOptions = {
  /** Jump straight to the paste step (used when replacing an existing key). */
  startAtPaste?: boolean;
};

type ContextValue = {
  apiKey: string | null;
  loading: boolean;
  clearApiKey: () => Promise<void>;
  promptForKey: (options?: PromptOptions) => void;
  saveApiKey: (rawInput: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  pendingTutorialId: string | null;
  clearPendingTutorial: () => void;
};

const MapTilerKeyContext = createContext<ContextValue>({
  apiKey: null,
  loading: true,
  clearApiKey: async () => {},
  promptForKey: () => {},
  saveApiKey: async () => ({ ok: false, message: 'Not ready' }),
  pendingTutorialId: null,
  clearPendingTutorial: () => {},
});

export function useMapTilerKey() {
  return useContext(MapTilerKeyContext);
}

function MapTilerKeyProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [startAtPaste, setStartAtPaste] = useState(false);
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false);
  const [pendingTutorialId, setPendingTutorialId] = useState<string | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [orientationModalVisible, setOrientationModalVisible] = useState(false);
  const tutorialPromptShownRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;

        if (saved) {
          setApiKey(saved);
          setShowModal(false);

          const locOk = await requestLocationPermission();
          if (!mounted) return;
          if (!locOk) setLocationModalVisible(true);
          else {
            const orientOk = await requestOrientationPermission();
            if (!mounted) return;
            if (!orientOk) setOrientationModalVisible(true);
          }
        } else {
          // No trial fallback: the map needs a key, so make that the first step.
          setShowModal(true);
        }
      } catch (err) {
        if (mounted) {
          setShowModal(true);
          void showAlert({ title: 'MapTilerKeyProvider', message: String(err) });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Re-check the stored key and location permission when the app becomes active.
  // The key itself is not re-verified here so offline use never blocks on a
  // network round-trip.
  useEffect(() => {
    let mounted = true;
    const handleAppState = (next: AppStateStatus) => {
      if (next !== 'active') return;

      (async () => {
        try {
          const saved = await AsyncStorage.getItem(STORAGE_KEY);
          if (!mounted) return;

          if (saved) {
            setApiKey(saved);
            setShowModal(false);
            if (!locationModalVisible) {
              const locOk = await requestLocationPermission();
              if (!locOk && mounted) setLocationModalVisible(true);
              else {
                const orientOk = await requestOrientationPermission();
                if (!orientOk && mounted) setOrientationModalVisible(true);
              }
            }
          } else {
            setShowModal(true);
          }
        } catch (err) {
          if (mounted) setShowModal(true);
          void showAlert({ title: 'MapTilerKeyProvider', message: String(err) });
        }
      })();
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
      const url = `https://api.maptiler.com/maps/outdoor-v2/256/${z}/${x}/${y}.png?key=${encodeURIComponent(key)}`;
      // Cap the verify request so a flaky field connection can't hang the modal forever.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return { ok: true, isNetworkError: false };

      // If we got an unauthorized/forbidden, the key is definitely invalid.
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          message: 'That key was rejected. Copy it from MapTiler and try again.',
          isNetworkError: false,
        };
      }

      // For rate limits (429) or server errors (5xx), don't assume the key is
      // bad and lock the user out, especially if they are out in the field.
      return { ok: true, isNetworkError: true };
    } catch (err: any) {
      // Network error / timeout: let the user save the key and try the map.
      // We only reject on an explicit 401/403 above.
      const isAbort = err?.name === 'AbortError';
      return {
        ok: true,
        message: isAbort ? 'Verification timed out. Your key was saved.' : undefined,
        isNetworkError: true,
      };
    }
  }

  async function submitApiKey(rawInput: string) {
    const input = parseApiKeyInput(rawInput);
    if (!input) {
      return {
        ok: false,
        message: 'That does not look like a MapTiler key. Copy it from MapTiler and try again.',
      } as const;
    }

    const res = await verifyKey(input);
    if (!res.ok) {
      return {
        ok: false,
        message: res.message ?? 'That key did not work. Copy it from MapTiler and try again.',
      } as const;
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEY, input);
      setApiKey(input);
      return { ok: true } as const;
    } catch (err) {
      Alert.alert('Storage error', 'Failed to save the API key for future launches.');
      void showAlert({ title: 'MapTiler storage error', message: String(err) });
      return { ok: false, message: 'Could not save the key on this device.' } as const;
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
            { timeout: 8000 },
          );
        });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        return status === 'granted';
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
      const ctor: any = DeviceOrientationEvent as any;
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
    setStartAtPaste(true);
    setShowModal(true);
  }

  function promptForKey(options?: PromptOptions) {
    setStartAtPaste(!!options?.startAtPaste);
    setShowModal(true);
  }

  function handleKeyDone() {
    setShowModal(false);
    setStartAtPaste(false);
    maybeShowTutorialPrompt();

    void (async () => {
      const locOk = await requestLocationPermission(true);
      if (!locOk) {
        setLocationModalVisible(true);
        return;
      }
      const orientOk = await requestOrientationPermission();
      if (!orientOk) setOrientationModalVisible(true);
    })();
  }

  async function maybeShowTutorialPrompt() {
    if (tutorialPromptShownRef.current) return;
    tutorialPromptShownRef.current = true;

    try {
      const raw = await AsyncStorage.getItem(TUTORIALS_COMPLETED);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (ids.includes('map-basics')) return;
    } catch {}

    setShowTutorialPrompt(true);
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
    <MapTilerKeyContext.Provider
      value={{
        apiKey,
        loading,
        clearApiKey,
        promptForKey,
        saveApiKey: submitApiKey,
        pendingTutorialId,
        clearPendingTutorial: () => setPendingTutorialId(null),
      }}
    >
      {children}
      <ApiKeyOnboarding
        visible={showModal}
        initialStep={startAtPaste ? 'paste' : 'intro'}
        onSubmitKey={submitApiKey}
        onDone={handleKeyDone}
      />

      <Modal visible={locationModalVisible} animationType="fade" transparent={true}>
        <View style={styles.backdrop}>
          <ThemedView style={styles.container}>
            <ThemedText style={styles.title}>Location Permission Required</ThemedText>
            <ThemedText style={styles.help}>
              This app requires location access to function. Please enable location for this app/site.
            </ThemedText>
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
            <ThemedText style={styles.help}>
              This app needs access to device orientation (compass) to show device heading. Please grant access to continue.
            </ThemedText>
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

      <Modal visible={showTutorialPrompt} animationType="fade" transparent={true}>
        <View style={styles.backdrop}>
          <ThemedView style={styles.container}>
            <ThemedText style={styles.title}>Learn CadNav?</ThemedText>
            <ThemedText style={styles.help}>
              Take a quick tour of the map controls, checkpoints, and grid features to get the most out of CadNav.
            </ThemedText>
            <View style={styles.row}>
              <StyledButton variant="secondary" onPress={() => setShowTutorialPrompt(false)}>
                Not now
              </StyledButton>
              <View style={styles.spacer} />
              <StyledButton
                variant="primary"
                onPress={() => {
                  setShowTutorialPrompt(false);
                  setPendingTutorialId('map-basics');
                }}
              >
                Take a tour
              </StyledButton>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </MapTilerKeyContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
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
  help: {
    marginTop: 8,
    marginBottom: 16,
    opacity: 0.7,
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  spacer: { width: 12 },
});

export default MapTilerKeyProvider;
