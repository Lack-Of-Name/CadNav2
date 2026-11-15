import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isLightColor } from '@/lib/colorUtils';
import { parseApiKeyInput } from '@/lib/apiKey';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * MapTiler opens its sign-in/sign-up widget here and returns to the Keys page
 * once the user has an account, so "Get my free key" is a single action.
 */
const MAPTILER_KEY_URL = 'https://cloud.maptiler.com/auth/widget?next=https%3A%2F%2Fcloud.maptiler.com%2Faccount%2Fkeys%2F';

type Props = {
  visible: boolean;
  initialStep: 'intro' | 'paste';
  onSubmitKey: (input: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  onDone: () => void;
};

export function ApiKeyOnboarding({ visible, initialStep, onSubmitKey, onDone }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const primaryText = isLightColor(theme.primary) ? '#000' : '#fff';

  const [step, setStep] = useState<'intro' | 'paste'>(initialStep);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [focused, setFocused] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStep(initialStep);
    setInput('');
    setError(null);
    setBusy(false);
    setConnected(false);
    setFocused(false);
  }, [visible, initialStep]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  async function openMapTiler() {
    try {
      await WebBrowser.openBrowserAsync(MAPTILER_KEY_URL);
    } catch {
      await Linking.openURL(MAPTILER_KEY_URL);
    }
  }

  function handleGetKey() {
    setStep('paste');
    setError(null);
    void openMapTiler();
  }

  async function handlePaste() {
    try {
      const text = await Clipboard.getStringAsync();
      const key = parseApiKeyInput(text);
      if (!key) {
        setError('Copy your MapTiler key first, then tap Paste.');
        inputRef.current?.focus();
        return;
      }
      setInput(key);
      setError(null);
      inputRef.current?.blur();
    } catch {
      setError('Clipboard is unavailable. Paste with the keyboard instead.');
      inputRef.current?.focus();
    }
  }

  async function handleConnect() {
    if (busy) return;
    const key = parseApiKeyInput(input);
    if (!key) {
      setError('That does not look like a MapTiler key. Copy it again and paste.');
      inputRef.current?.focus();
      return;
    }

    setBusy(true);
    setError(null);
    const result = await onSubmitKey(key);
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      inputRef.current?.focus();
      return;
    }

    setConnected(true);
    closeTimer.current = setTimeout(onDone, 900);
  }

  const canConnect = input.trim().length > 0 && !busy;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent={Platform.OS === 'android'}
      navigationBarTranslucent={Platform.OS === 'android'}
      onRequestClose={() => {
        // No skip: the map cannot load until a key is connected.
      }}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.topBar}>
            {step === 'paste' && !connected ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => {
                  setStep('intro');
                  setError(null);
                }}
                hitSlop={12}
                style={styles.backButton}
              >
                <IconSymbol name="chevron.left" size={18} color={theme.textMuted} />
                <Text style={[styles.backText, { color: theme.textMuted }]}>Back</Text>
              </Pressable>
            ) : (
              <View style={styles.backButton} />
            )}

            <View style={styles.progress} accessibilityLabel={step === 'intro' ? 'Step 1 of 2' : 'Step 2 of 2'}>
              <View style={[styles.progressBar, { backgroundColor: theme.primary }]} />
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: step === 'paste' || connected ? theme.primary : theme.divider },
                ]}
              />
            </View>

            <View style={styles.backButton} />
          </View>

          <View style={styles.body}>
            {connected ? (
              <View style={styles.content}>
                <View style={[styles.heroIcon, { backgroundColor: theme.success }]}>
                  <IconSymbol name="checkmark.circle.fill" size={30} color="#fff" />
                </View>
                <Text style={[styles.title, { color: theme.text }]}>You&apos;re connected</Text>
                <Text style={[styles.lede, { color: theme.textMuted }]}>Your map is ready.</Text>
              </View>
            ) : step === 'intro' ? (
              <View style={styles.content}>
                <View style={[styles.heroIcon, { backgroundColor: theme.primary }]}>
                  <IconSymbol name="key.fill" size={28} color={primaryText} />
                </View>

                <Text style={[styles.eyebrow, { color: theme.primary }]}>CADNAV MAPS</Text>
                <Text style={[styles.title, { color: theme.text }]}>Connect your map</Text>
                <Text style={[styles.lede, { color: theme.textMuted }]}>
                  CadNav uses a free MapTiler key. It takes about two minutes.
                </Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Get my free map key"
                  onPress={handleGetKey}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[styles.primaryButtonText, { color: primaryText }]}>Get my free key</Text>
                  <IconSymbol name="arrow.up.right.square" size={18} color={primaryText} />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="I already have a key"
                  onPress={() => {
                    setStep('paste');
                    setError(null);
                  }}
                  hitSlop={8}
                  style={styles.quietButton}
                >
                  <Text style={[styles.quietButtonText, { color: theme.textMuted }]}>
                    I already have a key
                  </Text>
                </Pressable>

                <View style={styles.footnoteRow}>
                  <IconSymbol name="lock.shield.fill" size={12} color={theme.textSubtle} />
                  <Text style={[styles.footnote, { color: theme.textSubtle }]}>
                    Free account. No credit card.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.content}>
                <View style={[styles.heroIcon, { backgroundColor: theme.primary }]}>
                  <IconSymbol name="key.fill" size={28} color={primaryText} />
                </View>

                <Text style={[styles.title, { color: theme.text }]}>Paste your key</Text>
                <Text style={[styles.lede, { color: theme.textMuted }]}>
                  Copy it from MapTiler, then paste it here.
                </Text>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: theme.surface,
                      borderColor: error ? theme.error : focused ? theme.primary : theme.divider,
                    },
                  ]}
                >
                  <TextInput
                    ref={inputRef}
                    accessibilityLabel="MapTiler key"
                    value={input}
                    onChangeText={(value) => {
                      setInput(value);
                      setError(null);
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="Paste your key"
                    placeholderTextColor={theme.textSubtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    textContentType="none"
                    importantForAutofill="no"
                    autoFocus={step === 'paste' && !connected}
                    style={[styles.input, { color: theme.text }]}
                    returnKeyType="done"
                    onSubmitEditing={() => void handleConnect()}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Paste from clipboard"
                    onPress={() => void handlePaste()}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.pasteButton,
                      { backgroundColor: theme.background, opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <IconSymbol name="doc.on.doc.fill" size={14} color={theme.text} />
                    <Text style={[styles.pasteButtonText, { color: theme.text }]}>Paste</Text>
                  </Pressable>
                </View>

                {error ? (
                  <View style={styles.errorRow}>
                    <IconSymbol name="info.circle.fill" size={15} color={theme.error} />
                    <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Connect map"
                  disabled={!canConnect}
                  onPress={() => void handleConnect()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    {
                      backgroundColor: theme.primary,
                      opacity: !canConnect ? 0.45 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color={primaryText} />
                  ) : (
                    <>
                      <Text style={[styles.primaryButtonText, { color: primaryText }]}>Connect map</Text>
                      <IconSymbol name="arrow.right" size={18} color={primaryText} />
                    </>
                  )}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open MapTiler again"
                  onPress={() => void openMapTiler()}
                  hitSlop={8}
                  style={styles.quietButton}
                >
                  <Text style={[styles.quietButtonText, { color: theme.textMuted }]}>
                    Open MapTiler again
                  </Text>
                </Pressable>

                <View style={styles.footnoteRow}>
                  <IconSymbol name="lock.shield.fill" size={12} color={theme.textSubtle} />
                  <Text style={[styles.footnote, { color: theme.textSubtle }]}>
                    Your key stays on this device.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backButton: {
    minWidth: 64,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progress: {
    flexDirection: 'row',
    gap: 5,
  },
  progressBar: {
    width: 28,
    height: 3,
    borderRadius: 2,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    alignItems: 'center',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  lede: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
    maxWidth: 340,
  },
  primaryButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  quietButton: {
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  quietButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footnoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
  },
  footnote: {
    fontSize: 12,
  },
  inputWrap: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 6,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    paddingRight: 8,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pasteButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
