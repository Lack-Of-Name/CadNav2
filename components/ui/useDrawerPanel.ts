/**
 * useDrawerPanel — single driver for the hamburger drawer.
 *
 * Owns the panel's horizontal position as a shared value so the edge-swipe
 * gesture can move the drawer 1:1 with the finger, then release to open or
 * snap back. Programmatic open/close (island tab tap, overlay press, nav)
 * animate the same value, so every path stays in sync.
 */
import { Gesture } from 'react-native-gesture-handler';
import { useCallback, useMemo, useState } from 'react';
import { runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';

export const DRAWER_WIDTH = 290;

const ACTIVATION_DX = 14;
const OPEN_THRESHOLD_DX = 64;
const FLING_VELOCITY_X = 600;

const clamp = (v: number, lo: number, hi: number) => {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
};

export function useDrawerPanel() {
  const [open, setOpen] = useState(false);
  // -DRAWER_WIDTH = fully closed, 0 = fully open.
  const x = useSharedValue(-DRAWER_WIDTH);

  const openDrawer = useCallback(() => {
    setOpen(true);
    x.value = withTiming(0, { duration: 240 });
  }, [x]);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    x.value = withTiming(-DRAWER_WIDTH, { duration: 200 });
  }, [x]);

  // Edge swipe: panel tracks the finger, release past the threshold (or a
  // rightward fling) completes the open, otherwise it springs back shut.
  // Memoized so the detector keeps a stable gesture across parent re-renders
  // (a swapped gesture mid-swipe can leave the handler unresponsive).
  // Built twice (strip + tab) because one gesture instance can't drive two
  // detectors — the tab pill sits above the strip and would otherwise swallow
  // swipes starting on it, leaving only taps working there.
  const buildOpenPan = () =>
    Gesture.Pan()
      .activeOffsetX(ACTIVATION_DX)
      .failOffsetY([-ACTIVATION_DX, ACTIVATION_DX])
      .onUpdate((e) => {
        'worklet';
        x.value = clamp(-DRAWER_WIDTH + e.translationX, -DRAWER_WIDTH, 0);
      })
      .onEnd((e) => {
        'worklet';
        if (e.translationX > OPEN_THRESHOLD_DX || e.velocityX > FLING_VELOCITY_X) {
          runOnJS(openDrawer)();
        } else {
          x.value = withTiming(-DRAWER_WIDTH, { duration: 200 });
        }
      });

  const edgePan = useMemo(buildOpenPan, [x, openDrawer]);
  const tabPan = useMemo(buildOpenPan, [x, openDrawer]);

  // Dismiss swipe: drag the open panel left and it follows the finger.
  // Release past the threshold (or a leftward fling) closes it, otherwise
  // it springs back open. Rightward drags are clamped (already open).
  const drawerPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(ACTIVATION_DX)
        .failOffsetY([-ACTIVATION_DX, ACTIVATION_DX])
        .onUpdate((e) => {
          'worklet';
          x.value = clamp(e.translationX, -DRAWER_WIDTH, 0);
        })
        .onEnd((e) => {
          'worklet';
          if (e.translationX < -OPEN_THRESHOLD_DX || e.velocityX < -FLING_VELOCITY_X) {
            runOnJS(closeDrawer)();
          } else {
            x.value = withTiming(0, { duration: 200 });
          }
        }),
    [x, closeDrawer],
  );

  return { open, x, openDrawer, closeDrawer, edgePan, tabPan, drawerPan } as const;
}
