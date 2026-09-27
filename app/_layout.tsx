import { ManualModal } from '@/components/manual/ManualModal';
import MapTilerKeyProvider, { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { TutorialModal } from '@/components/tutorial/TutorialModal';
import { DrawerMenu } from '@/components/ui/DrawerMenu';
import { DrawerEdgeControls } from '@/components/ui/DrawerEdgeControls';
import { useDrawerPanel } from '@/components/ui/useDrawerPanel';
import { Colors, HUD } from '@/constants/theme';
import { OfflineMapProvider } from '@/hooks/offline-maps';
import { SettingsProvider } from '@/hooks/settings';
import { TutorialProvider, useTutorials } from '@/hooks/tutorials';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';


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
  const colorScheme = useColorScheme();
  const [errorState, setErrorState] = useState<RuntimeErrorState | null>(runtimeErrorState);

  useEffect(() => subscribeRuntimeErrors(setErrorState), []);

  if (!errorState) return null;

  return (
    <View pointerEvents="box-none" style={styles.errorOverlay}>
      <View style={[styles.errorCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].error }]}>
        <Text style={[styles.errorTitle, { color: Colors[colorScheme].text }]}>{errorState.title}</Text>
        <Text style={[styles.errorMessage, { color: Colors[colorScheme].textMuted }]}>{errorState.message}</Text>
        <Pressable onPress={() => emitRuntimeError(null)} style={[styles.errorDismiss, { backgroundColor: HUD.bg }]}> 
          <Text style={[styles.errorDismissText, { color: Colors[colorScheme].error }]}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TutorialGate() {
  const { activeTutorial, closeTutorial, markCompleted } = useTutorials();

  if (!activeTutorial) return null;

  if (activeTutorial.id === 'full-manual') {
    return (
      <ManualModal
        visible={true}
        onClose={closeTutorial}
        onComplete={() => markCompleted('full-manual')}
      />
    );
  }

  return (
    <TutorialModal
      tutorial={activeTutorial}
      visible={!!activeTutorial}
      onClose={closeTutorial}
      onComplete={() => markCompleted(activeTutorial.id)}
    />
  );
}

function GlobalNavigationChrome() {
  const pathname = usePathname();
  const drawer = useDrawerPanel();

  return (
    <>
      <DrawerEdgeControls
        drawerOpen={drawer.open}
        onOpen={drawer.openDrawer}
        edgeGesture={drawer.edgePan}
        tabGesture={drawer.tabPan}
      />
      <DrawerMenu
        open={drawer.open}
        onClose={drawer.closeDrawer}
        currentRoute={pathname}
        x={drawer.x}
        closeGesture={drawer.drawerPan}
      />
    </>
  );
}

function AppThemeShell({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {children}
    </ThemeProvider>
  );
}

/** Bridges the key-provider tutorial request to the tutorial system. */
function TutorialPromptBridge() {
  const { pendingTutorialId, clearPendingTutorial } = useMapTilerKey();
  const { showTutorial } = useTutorials();

  useEffect(() => {
    if (pendingTutorialId) {
      showTutorial(pendingTutorialId);
      clearPendingTutorial();
    }
  }, [pendingTutorialId, showTutorial, clearPendingTutorial]);

  return null;
}

function AppChrome() {
  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="manual" options={{ headerShown: false }} />
      </Stack>
      <GlobalNavigationChrome />
      <RuntimeErrorBanner />
      <TutorialPromptBridge />
      <TutorialGate />
    </>
  );
}

function RootLayout() {
  useEffect(() => installGlobalRuntimeErrorHandler(), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <AppThemeShell>
            <MapTilerKeyProvider>
              <OfflineMapProvider>
                <TutorialProvider>
                  <AppChrome />
                </TutorialProvider>
              </OfflineMapProvider>
            </MapTilerKeyProvider>
          </AppThemeShell>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default RootLayout;

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
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorDismiss: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  errorDismissText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
