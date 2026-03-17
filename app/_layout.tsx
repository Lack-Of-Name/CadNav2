import MapTilerKeyProvider from '@/components/map/MapTilerKeyProvider';
import { OfflineMapProvider } from '@/hooks/offline-maps';
import { SettingsProvider } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://5302fc03e1b9e181c2a567764b74c597@o4511058552750080.ingest.us.sentry.io/4511058557468672',
  debug: __DEV__, // If `true`, Sentry will try to print out useful debugging information
});

export const unstable_settings = {
  anchor: '(tabs)',
};

type RuntimeErrorState = {
  title: string;
  message: string;
};

let runtimeErrorState: RuntimeErrorState | null = null;
const runtimeErrorListeners = new Set<(next: RuntimeErrorState | null) => void>();

function emitRuntimeError(next: RuntimeErrorState | null) {
  runtimeErrorState = next;
  for (const listener of runtimeErrorListeners) listener(next);
}

function subscribeRuntimeErrors(listener: (next: RuntimeErrorState | null) => void) {
  runtimeErrorListeners.add(listener);
  listener(runtimeErrorState);
  return () => {
    runtimeErrorListeners.delete(listener);
  };
}

function installGlobalRuntimeErrorHandler() {
  const errorUtils = (global as any)?.ErrorUtils;
  if (!errorUtils || typeof errorUtils.getGlobalHandler !== 'function' || typeof errorUtils.setGlobalHandler !== 'function') {
    return () => {};
  }

  const previousHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    const message = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);

    // Using console.log instead of console.error to avoid crashing LogBox during initialization
    console.log('\n\n=== RUNTIME ERROR CAUGHT ===\n', error, '\n============================\n\n');

    emitRuntimeError({
      title: isFatal ? 'Fatal runtime error' : 'Runtime error',
      message,
    });

    if (typeof previousHandler === 'function') {
      previousHandler(error, isFatal);
    }
  });

  return () => {
    errorUtils.setGlobalHandler(previousHandler);
  };
}

function RuntimeErrorBanner() {
  const [errorState, setErrorState] = useState<RuntimeErrorState | null>(runtimeErrorState);

  useEffect(() => subscribeRuntimeErrors(setErrorState), []);

  if (!errorState) return null;

  return (
    <View pointerEvents="box-none" style={styles.errorOverlay}>
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>{errorState.title}</Text>
        <Text style={styles.errorMessage}>{errorState.message}</Text>
        <Pressable onPress={() => emitRuntimeError(null)} style={styles.errorDismiss}>
          <Text style={styles.errorDismissText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => installGlobalRuntimeErrorHandler(), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SafeAreaProvider>
          <SettingsProvider>
            <MapTilerKeyProvider>
              <OfflineMapProvider>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                </Stack>
                <RuntimeErrorBanner />
              </OfflineMapProvider>
            </MapTilerKeyProvider>
          </SettingsProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10_000,
    paddingHorizontal: 12,
    paddingTop: 52,
  },
  errorCard: {
    backgroundColor: '#5C1010',
    borderColor: '#FF8F8F',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  errorTitle: {
    color: '#FFF1F0',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorMessage: {
    color: '#FFF1F0',
    fontSize: 13,
    lineHeight: 18,
  },
  errorDismiss: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF1F0',
  },
  errorDismissText: {
    color: '#5C1010',
    fontSize: 12,
    fontWeight: '700',
  },
});
