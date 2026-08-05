import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type ColorSliderProps = {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  stops: string[];
  thumbColor?: string;
};

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 14;
const SLIDER_HEIGHT = TRACK_HEIGHT + THUMB_SIZE + 8;

export function ColorSlider({
  value,
  min = 0,
  max,
  onChange,
  stops,
  thumbColor = '#FFFFFF',
}: ColorSliderProps) {
  const gradientId = useRef(`hsv-grad-${Math.random().toString(36).slice(2)}`).current;
  const widthRef = useRef(1);
  const dragRef = useRef({ pageX: 0, value: 0 });
  const boundsRef = useRef({ min, max });
  boundsRef.current = { min, max };
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function handleTouchStart(e: { nativeEvent: { pageX: number; locationX: number } }) {
    const { min: lo, max: hi } = boundsRef.current;
    const p = Math.min(1, Math.max(0, e.nativeEvent.locationX / widthRef.current));
    const v = lo + p * (hi - lo);
    dragRef.current = { pageX: e.nativeEvent.pageX, value: v };
    onChangeRef.current(v);
  }

  function handleTouchMove(e: { nativeEvent: { pageX: number } }) {
    const { min: lo, max: hi } = boundsRef.current;
    const dx = e.nativeEvent.pageX - dragRef.current.pageX;
    const dv = (dx / widthRef.current) * (hi - lo);
    onChangeRef.current(Math.min(hi, Math.max(lo, dragRef.current.value + dv)));
  }

  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const stopEls = stops.map((c, i) => (
    <Stop key={i} offset={stops.length === 1 ? 0 : i / (stops.length - 1)} stopColor={c} />
  ));

  return (
    <View
      style={styles.slider}
      onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <View style={styles.track} pointerEvents="none">
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              {stopEls}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      </View>
      <View
        style={[
          styles.thumb,
          { left: `${pct}%`, marginLeft: -THUMB_SIZE / 2, backgroundColor: thumbColor },
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slider: {
    flex: 1,
    height: SLIDER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    top: (SLIDER_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.35)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
