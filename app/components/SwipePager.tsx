import React, {
  FC,
  ReactElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
  GestureResponderEvent,
} from 'react-native';

export type SwipePage = {
  key: string;
  element: ReactElement;
  swipeMode?: 'full' | 'edge';
};

interface SwipePagerProps {
  pages: SwipePage[];
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
}

export type SwipePagerHandle = {
  goTo: (index: number, animated?: boolean) => void;
};

const SwipePager = forwardRef<SwipePagerHandle, SwipePagerProps>(
  ({ pages, activeIndex: activeIndexProp, onActiveIndexChange }, ref) => {
  const scrollRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();

  const [internalIndex, setInternalIndex] = useState<number>(0);
  const isControlled = typeof activeIndexProp === 'number';
  const activeIndex = isControlled ? (activeIndexProp as number) : internalIndex;

  const setActiveIndex = (next: number) => {
    if (!isControlled) setInternalIndex(next);
    onActiveIndexChange?.(next);
  };
  const [layoutWidth, setLayoutWidth] = useState<number>(0);

  const maxIndex = pages.length - 1;
  const pageWidth = layoutWidth || windowWidth || 1;

  const activeSwipeMode = pages[activeIndex]?.swipeMode ?? 'full';

  const scrollToIndex = (nextIndex: number, animated = true) => {
    scrollRef.current?.scrollTo?.({ x: nextIndex * pageWidth, y: 0, animated });
  };

  const goTo = (nextIndex: number, animated = true) => {
    const clamped = Math.max(0, Math.min(maxIndex, nextIndex));
    setActiveIndex(clamped);
    scrollToIndex(clamped, animated);
  };

  useImperativeHandle(
    ref,
    () => ({
      goTo,
    }),
    [maxIndex, pageWidth, activeIndex, isControlled]
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth && nextWidth !== layoutWidth) {
      setLayoutWidth(nextWidth);
    }
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(x / pageWidth);
    const clamped = Math.max(0, Math.min(maxIndex, nextIndex));
    if (clamped !== activeIndex) setActiveIndex(clamped);
  };

  const onScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(x / pageWidth);
    const clamped = Math.max(0, Math.min(maxIndex, nextIndex));
    if (clamped !== activeIndex) setActiveIndex(clamped);
  };

  useEffect(() => {
    scrollToIndex(activeIndex, false);
  }, [pageWidth]);

  useEffect(() => {
    if (!isControlled) return;
    scrollToIndex(activeIndex, false);
  }, [activeIndexProp]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault?.();
        goTo(activeIndex - 1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault?.();
        goTo(activeIndex + 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, maxIndex, pageWidth]);

  const edgeSwipeHandlers = useMemo(() => {
    if (activeSwipeMode !== 'edge') return null;

    const attach = (direction: 'left' | 'right') => {
      let startX: number | null = null;

      const onStartShouldSetResponder = () => true;

      const onResponderGrant = (event: GestureResponderEvent) => {
        startX = event.nativeEvent.pageX;
      };

      const onResponderRelease = (event: GestureResponderEvent) => {
        const endX = event.nativeEvent.pageX;
        if (startX == null) return;
        const dx = endX - startX;

        if (direction === 'left' && dx > 60) goTo(activeIndex - 1);
        if (direction === 'right' && dx < -60) goTo(activeIndex + 1);

        startX = null;
      };

      return {
        onStartShouldSetResponder,
        onResponderGrant,
        onResponderRelease,
        onResponderTerminate: onResponderRelease,
      };
    };

    return {
      left: attach('left'),
      right: attach('right'),
    };
  }, [activeIndex, activeSwipeMode]);

  return (
    <View style={styles.root} onLayout={onLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={activeSwipeMode === 'full'}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollEndDrag={onScrollEndDrag}
        scrollEventThrottle={16}
      >
        {pages.map((page) => (
          <View key={page.key} style={[styles.page, { width: pageWidth }]}>
            {page.element}
          </View>
        ))}
      </ScrollView>

      {activeSwipeMode === 'edge' && (
        <>
          <View style={styles.edgeLeft} pointerEvents="box-only" {...edgeSwipeHandlers?.left} />
          <View style={styles.edgeRight} pointerEvents="box-only" {...edgeSwipeHandlers?.right} />
        </>
      )}
    </View>
  );
}
);

export default SwipePager;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  page: {
    flex: 1,
  },
  edgeLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 22,
  },
  edgeRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 22,
  },
});
