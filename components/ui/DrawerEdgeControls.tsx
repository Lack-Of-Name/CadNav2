/**
 * DrawerEdgeControls — opens the hamburger drawer without a floating button.
 *
 * Two affordances, both global (all screens) and fully separate from the map:
 * - A narrow invisible strip along the far left edge: swiping right from it
 *   opens the drawer.
 * - A "dynamic island" pill peeking out at the vertical centre of the left
 *   edge: tapping it opens the drawer. It slides away while the drawer is open.
 *
 * Map-safety: the strip is only EDGE_WIDTH wide, the pan gesture only fires
 * on a committed mostly-horizontal rightward drag (activeOffsetX +
 * failOffsetY + release-threshold checks), so vertical map pans/scrolls that
 * happen to start in the strip never open the menu.
 */
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { IconSymbol } from './icon-symbol';

const EDGE_WIDTH = 48;

const TAB_WIDTH = 20;
const TAB_HEIGHT = 200;
const TAB_PEEK = 16;

type Props = {
  drawerOpen: boolean;
  onOpen: () => void;
  /** Finger-tracking edge pan built by useDrawerPanel. */
  edgeGesture: PanGesture;
  /** Same open-gesture as its own instance for swipes starting on the tab. */
  tabGesture: PanGesture;
};

export function DrawerEdgeControls({ drawerOpen, onOpen, edgeGesture, tabGesture }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const { height: windowHeight } = useWindowDimensions();

  // Island tab slides out of sight while the drawer is open.
  const tabX = useSharedValue(0);
  useEffect(() => {
    tabX.value = withTiming(drawerOpen ? -(TAB_WIDTH + 8) : 0, { duration: 220 });
  }, [drawerOpen, tabX]);
  const tabSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabX.value }],
  }));

  return (
    <>
      {/* Always mounted: unmounting mid-gesture (on the very swipe that opens
          the drawer) crashes iOS. When open, the drawer scrim sits above the
          strip (z99 > z90) so no touches reach it. */}
      <GestureDetector gesture={edgeGesture}>
        <Animated.View style={[styles.edge, { width: EDGE_WIDTH }]} />
      </GestureDetector>

      <Animated.View
        pointerEvents={drawerOpen ? 'none' : 'auto'}
        style={[
          styles.tab,
          {
            width: TAB_WIDTH,
            height: TAB_HEIGHT,
            left: -(TAB_WIDTH - TAB_PEEK),
            top: Math.max(0, windowHeight / 2 - TAB_HEIGHT / 2),
          },
          tabSlideStyle,
        ]}
      >
        <GestureDetector gesture={tabGesture}>
          <Pressable
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel="Open navigation menu"
            hitSlop={{ top: 16, bottom: 16, right: 20, left: 8 }}
            style={[
              styles.tabPill,
              {
                backgroundColor: C.surface,
                borderColor: C.divider,
              },
            ]}
          >
            <View style={styles.tabIcon}>
              <IconSymbol name="chevron.right" size={15} color={C.textMuted} />
            </View>
          </Pressable>
        </GestureDetector>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 90,
    backgroundColor: 'transparent',
  },
  tab: {
    position: 'absolute',
    zIndex: 91,
    elevation: 4,
  },
  tabPill: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
