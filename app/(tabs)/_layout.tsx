/**
 * CadNav Tab Layout
 * 
 * Bottom tab bar is HIDDEN — navigation is handled via the hamburger menu
 * inside the Map screen (MaplibreMap.tsx). This layout just sets up the
 * routing structure so expo-router can resolve screens.
 */
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // Hidden — hamburger menu drives nav
      }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Map' }} />
      <Tabs.Screen name="routes"   options={{ title: 'Routes' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
