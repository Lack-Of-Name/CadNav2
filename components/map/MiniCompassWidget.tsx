import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  headingDeg: number | null;
  targetBearingDeg: number | null;
  targetColor?: string | null;
  panelBg: string;
  borderColor: string;
  dialBg: string;
  tick: string;
  tickStrong: string;
  primary: string;
  onClose: () => void;
};

const MIN_SIZE = 104;
const MAX_SIZE = 264;
const DEFAULT_SIZE = 160;
const PAD = 8;

const CARDINALS = [
  { angle: 0, label: 'N' },
  { angle: 90, label: 'E' },
  { angle: 180, label: 'S' },
  { angle: 270, label: 'W' },
];

const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

const normalize360 = (value: number) => {
  'worklet';
  return ((value % 360) + 360) % 360;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Cardinal letter pinned to the rotating ring position but kept upright. */
function CardinalLabel({
  angle,
  label,
  headingSV,
  dialSize,
  color,
}: {
  angle: number;
  label: string;
  headingSV: { value: number };
  dialSize: number;
  color: string;
}) {
  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle - normalize360(headingSV.value)}deg` }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-(angle - normalize360(headingSV.value))}deg` }],
  }));
  return (
    <Animated.View style={[styles.fill, wrapStyle]} pointerEvents="none">
      <Animated.View style={[{ marginTop: dialSize * 0.1 }, textStyle]}>
        <Text style={[styles.cardinalText, { color, fontSize: Math.max(10, dialSize * 0.125) }]}>
          {label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

/** Target-direction marker dwelling on the dial rim: an outward wedge with a
 *  short inward tick, rotated to the bearing relative to current heading. */
function TargetArrow({
  targetBearingDeg,
  headingSV,
  dialSize,
  color,
}: {
  targetBearingDeg: number | null;
  headingSV: { value: number };
  dialSize: number;
  color: string;
}) {
  const arrowStyle = useAnimatedStyle(() => {
    if (typeof targetBearingDeg !== 'number') return { opacity: 0 };
    const target = normalize360(targetBearingDeg);
    const currHeading = normalize360(headingSV.value);
    return {
      opacity: 1,
      transform: [{ rotate: `${target - currHeading}deg` }],
    };
  });
  const headW = Math.max(10, dialSize * 0.11);
  return (
    <Animated.View style={[styles.fill, arrowStyle]} pointerEvents="none">
      <View style={{ marginTop: dialSize * 0.015, alignItems: 'center' }}>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: headW / 2,
            borderRightWidth: headW / 2,
            borderBottomWidth: headW * 0.9,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: color,
          }}
        />
        <View style={{ width: 2.5, height: dialSize * 0.09, backgroundColor: color, opacity: 0.9 }} />
      </View>
    </Animated.View>
  );
}

/**
 * MiniCompassWidget — sticky floating compass for the map screen.
 * Drag the body to move, pinch or drag the corner grip to resize.
 * Shows NESW, a fixed facing-direction needle and a target-direction arrow.
 */
export function MiniCompassWidget({
  headingDeg,
  targetBearingDeg,
  targetColor,
  panelBg,
  borderColor,
  dialBg,
  tick,
  tickStrong,
  primary,
  onClose,
}: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [pos, setPos] = useState(() => ({ x: insets.left + 12, y: insets.top + 62 }));
  const [size, setSize] = useState(DEFAULT_SIZE);

  const posRef = useRef(pos);
  posRef.current = pos;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const boundsRef = useRef({ windowWidth, windowHeight, topInset: insets.top });
  boundsRef.current = { windowWidth, windowHeight, topInset: insets.top };

  const panStart = useRef({ x: 0, y: 0 });
  const pinchStart = useRef(DEFAULT_SIZE);
  const gripActive = useRef(false);
  const gripStart = useRef({ size: DEFAULT_SIZE, x: 0, y: 0 });

  const clampPos = useCallback((x: number, y: number, s: number) => {
    const b = boundsRef.current;
    return {
      x: clamp(x, 8, Math.max(8, b.windowWidth - s - 8)),
      y: clamp(y, b.topInset + 8, Math.max(b.topInset + 8, b.windowHeight - s - 8)),
    };
  }, []);

  const syncPanStart = useCallback(() => {
    panStart.current = { ...posRef.current };
  }, []);

  const applyPan = useCallback(
    (tx: number, ty: number) => {
      if (gripActive.current) return;
      const s = { x: panStart.current.x + tx, y: panStart.current.y + ty };
      setPos(clampPos(s.x, s.y, sizeRef.current));
    },
    [clampPos],
  );

  const syncPinchStart = useCallback(() => {
    pinchStart.current = sizeRef.current;
  }, []);

  const applyPinch = useCallback(
    (k: number) => {
      if (gripActive.current) return;
      const ns = clamp(Math.round(pinchStart.current * k), MIN_SIZE, MAX_SIZE);
      setSize(ns);
      setPos((prev) => clampPos(prev.x, prev.y, ns));
    },
    [clampPos],
  );

  const gripDown = useCallback(() => {
    gripActive.current = true;
    gripStart.current = { size: sizeRef.current, ...posRef.current };
  }, []);

  const applyGrip = useCallback(
    (dx: number, dy: number) => {
      const ns = clamp(Math.round(gripStart.current.size + (dx + dy) / 2), MIN_SIZE, MAX_SIZE);
      setSize(ns);
      setPos((prev) => clampPos(prev.x, prev.y, ns));
    },
    [clampPos],
  );

  const gripUp = useCallback(() => {
    gripActive.current = false;
  }, []);

  const bodyGestures = useMemo(() => {
    const pan = Gesture.Pan()
      .onStart(() => runOnJS(syncPanStart)())
      .onUpdate((e) => runOnJS(applyPan)(e.translationX, e.translationY));
    const pinch = Gesture.Pinch()
      .onStart(() => runOnJS(syncPinchStart)())
      .onUpdate((e) => runOnJS(applyPinch)(e.scale));
    return Gesture.Simultaneous(pan, pinch);
  }, [syncPanStart, applyPan, syncPinchStart, applyPinch]);

  const gripGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => runOnJS(gripDown)())
        .onUpdate((e) => runOnJS(applyGrip)(e.translationX, e.translationY))
        .onFinalize(() => runOnJS(gripUp)()),
    [gripDown, applyGrip, gripUp],
  );

  const heading = typeof headingDeg === 'number' ? normalize360(headingDeg) : null;
  const headingSV = useSharedValue(heading ?? 0);

  useEffect(() => {
    if (heading != null) {
      const current = headingSV.value;
      const diff = ((heading - (current % 360) + 540) % 360) - 180;
      headingSV.value = withTiming(current + diff, {
        duration: 100,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [heading, headingSV]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-headingSV.value}deg` }],
  }));

  const dialSize = size - PAD * 2;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          width: size,
          height: size,
          transform: [{ translateX: pos.x }, { translateY: pos.y }],
        },
      ]}
    >
      <GestureDetector gesture={bodyGestures}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Mini compass. Drag to move, pinch to resize."
          style={[
            styles.card,
            { backgroundColor: panelBg, borderColor, padding: PAD },
          ]}
        >
          <View
            style={[
              styles.dial,
              { backgroundColor: dialBg, borderColor, width: dialSize, height: dialSize },
            ]}
          >
            <Animated.View style={[styles.fill, ringStyle]}>
              {TICKS.map((deg) => {
                const cardinal = deg % 90 === 0;
                return (
                  <View key={deg} style={[styles.tickWrap, { transform: [{ rotate: `${deg}deg` }] }]}>
                    <View
                      style={[
                        styles.tick,
                        cardinal
                          ? { width: 2.5, height: dialSize * 0.11, marginTop: dialSize * 0.045 }
                          : { width: 1.5, height: dialSize * 0.075, marginTop: dialSize * 0.062 },
                        { backgroundColor: cardinal ? tickStrong : tick },
                      ]}
                    />
                  </View>
                );
              })}
            </Animated.View>

            {CARDINALS.map((c) => (
              <CardinalLabel
                key={c.label}
                angle={c.angle}
                label={c.label}
                headingSV={headingSV}
                dialSize={dialSize}
                color={tickStrong}
              />
            ))}

            <TargetArrow
              targetBearingDeg={targetBearingDeg}
              headingSV={headingSV}
              dialSize={dialSize}
              color={targetColor || primary}
            />

            {/* Fixed facing-direction marker: top of dial is where you face. */}
            <View style={[styles.lubber, { top: 1 }]} pointerEvents="none">
              <View
                style={{
                  width: 0,
                  height: 0,
                  borderLeftWidth: 6,
                  borderRightWidth: 6,
                  borderTopWidth: 9,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderTopColor: primary,
                }}
              />
            </View>
          </View>
        </View>
      </GestureDetector>

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close mini compass"
        hitSlop={8}
        style={[styles.closeBtn, { borderColor, backgroundColor: dialBg }]}
      >
        <Text style={[styles.closeText, { color: tick }]}>×</Text>
      </Pressable>

      <GestureDetector gesture={gripGesture}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel="Resize mini compass"
          hitSlop={8}
          style={styles.grip}
        >
          <View style={[styles.gripMark, { borderRightColor: tick, borderBottomColor: tick }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 60,
    elevation: 6,
  },
  card: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dial: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    alignItems: 'center',
  },
  tickWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  tick: {
    borderRadius: 999,
  },
  cardinalText: {
    fontWeight: '800',
  },
  lubber: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: -9,
    right: -9,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 15,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: -1,
  },
  grip: {
    position: 'absolute',
    bottom: -9,
    right: -9,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gripMark: {
    width: 12,
    height: 12,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderRadius: 2,
  },
});
