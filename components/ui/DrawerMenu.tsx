/**
 * DrawerMenu — slide-in hamburger navigation panel.
 */
import { Colors, Elevation, HUD, Radius, Space } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from './icon-symbol';

type NavItem = {
  icon: string;
  label: string;
  route: string;
  description: string;
};

const NAV_ITEMS: NavItem[] = [
  { icon: 'map',            label: 'Map',      route: '/',        description: 'Live map & navigation' },
  { icon: 'flag.fill',      label: 'Routes',   route: '/routes',  description: 'Manage checkpoints & routes' },
  { icon: 'gearshape.fill', label: 'Settings', route: '/settings',description: 'App preferences & map key' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  currentRoute?: string;
};

export function DrawerMenu({ open, onClose, currentRoute }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const translateX = useSharedValue(-300);

  // Update animation when open changes
  if (open) translateX.value = withTiming(0, { duration: 240 });
  else translateX.value = withTiming(-300, { duration: 200 });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayOpacity = useSharedValue(0);
  if (open) overlayOpacity.value = withTiming(0.5, { duration: 240 });
  else overlayOpacity.value = withTiming(0, { duration: 200 });

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const normalizedCurrentRoute = normalizeRoute(currentRoute ?? '');

  const handleNav = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 50);
  };

  return (
    <>
      {open && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: HUD.bg, zIndex: 99 }, overlayStyle]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
      )}

      <Animated.View style={[styles.drawer, { backgroundColor: C.surface, paddingTop: insets.top + Space.md, zIndex: 100 }, drawerStyle, Elevation.high]}>
        <View style={styles.drawerHeader}>
          <View style={[styles.logoMark, { backgroundColor: C.primary }]}>
            <Text style={[styles.logoText, { color: C.surface } ]}>CN</Text>
          </View>
          <View>
            <Text style={[styles.appName, { color: C.text }]}>CadNav</Text>
            <Text style={[styles.appSub, { color: C.textMuted }]}>Grid Navigation</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close navigation menu" style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <IconSymbol name="chevron.left" size={18} color={C.textMuted} />
          </Pressable>
        </View>

        <View style={[styles.divider, { backgroundColor: C.divider }]} />

        <View style={styles.navItems}>
          {NAV_ITEMS.map((item) => {
            const isActive = normalizedCurrentRoute === normalizeRoute(item.route);

            return (
              <Pressable
                key={item.route}
                style={[styles.navItem, isActive && { backgroundColor: C.primary + '15' }]}
                onPress={() => handleNav(item.route)}
                android_ripple={{ color: C.primary + '25' }}
              >
                <View style={[styles.navIcon, { backgroundColor: isActive ? C.primary + '20' : C.divider + '80' }]}>
                  <IconSymbol name={item.icon as any} size={20} color={isActive ? C.primary : C.icon} />
                </View>
                <View style={styles.navText}>
                  <Text style={[styles.navLabel, { color: isActive ? C.primary : C.text }, isActive && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.navDesc, { color: C.textSubtle }]}>{item.description}</Text>
                </View>
                {isActive && <View style={[styles.activeIndicator, { backgroundColor: C.primary }]} />}
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.footer, { borderTopColor: C.divider }]}>
          <Text style={[styles.footerText, { color: C.textSubtle }]}>CadNav v2  ·  Grid Navigation Tool</Text>
        </View>
      </Animated.View>
    </>
  );
}

function normalizeRoute(route: string) {
  const withoutGroups = route.replace(/\([^/]+\)\//g, '/').replace(/\([^/]+\)/g, '');
  const trimmed = withoutGroups.replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : '/';
}

const DRAWER_WIDTH = 290;

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    bottom: 0,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.md,
    paddingBottom: Space.md,
    gap: Space.sm + 4,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText:    { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  appName:     { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  appSub:      { fontSize: 12, marginTop: 1 },
  closeBtn:    { marginLeft: 'auto' },
  divider:     { height: StyleSheet.hairlineWidth, marginHorizontal: Space.md, marginBottom: Space.sm },
  navItems:    { flex: 1, paddingHorizontal: Space.sm, paddingTop: Space.xs },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingVertical: Space.sm + 4,
    paddingHorizontal: Space.sm,
    gap: Space.sm + 4,
    marginBottom: Space.xs,
    position: 'relative',
    overflow: 'hidden',
  },
  navIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText:        { flex: 1 },
  navLabel:       { fontSize: 15 },
  navLabelActive: { fontWeight: '600' },
  navDesc:        { fontSize: 12, marginTop: 1 },
  activeIndicator:{
    position: 'absolute',
    right: 0,
    top: '15%',
    width: 3,
    height: '70%',
    borderRadius: 2,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
  },
  footerText: { fontSize: 11 },
});

