/**
 * DrawerMenu — slide-in hamburger navigation panel.
 */
import { Colors, Elevation, HUD, Radius, Space } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from './icon-symbol';
import { DRAWER_WIDTH } from './useDrawerPanel';

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
  /** Panel position driven by useDrawerPanel (-DRAWER_WIDTH closed, 0 open). */
  x: SharedValue<number>;
  /** Leftward drag on the panel dismisses it (built by useDrawerPanel). */
  closeGesture: PanGesture;
};

export function DrawerMenu({ open, onClose, currentRoute, x, closeGesture }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, (x.value + DRAWER_WIDTH) / DRAWER_WIDTH));
    return { opacity: progress * 0.5 };
  });

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
          pointerEvents="auto"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
      )}

      <GestureDetector gesture={closeGesture}>
        <Animated.View
          pointerEvents={open ? 'auto' : 'none'}
          style={[styles.drawer, { backgroundColor: C.surface, paddingTop: insets.top + Space.md, zIndex: 100 }, drawerStyle, Elevation.high]}>
        <View style={styles.drawerHeader}>
          <Image
            source={require('@/assets/icons/CadNav.png')}
            style={[styles.logoMark, { backgroundColor: C.primary }]}
            resizeMode="contain"
          />
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
      </GestureDetector>
    </>
  );
}

function normalizeRoute(route: string) {
  const withoutGroups = route.replace(/\([^/]+\)\//g, '/').replace(/\([^/]+\)/g, '');
  const trimmed = withoutGroups.replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : '/';
}

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
    // Equal top/bottom insets keep the bar vertically centred by construction,
    // regardless of row height — percentage top/height can resolve
    // asymmetrically on some platforms and rendered the bar off-centre.
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
  },
  footerText: { fontSize: 11 },
});

