import React, { FC, ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, ScrollViewProps, StyleSheet, View, LayoutChangeEvent, NativeSyntheticEvent, 
NativeScrollEvent, useWindowDimensions, GestureResponderEvent} from 'react-native';

export type SwipePage = {
  key: string;
  element: ReactElement;
  swipeMode?: 'full' | 'edge';
};

interface SwipePagerProps {
  pages: SwipePage[];
}

const SwipePager: FC<SwipePagerProps> = ({ pages }) => {
  const scrollRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [layoutWidth, setLayoutWidth] = useState<number>(0);

  const maxIndex = pages.length - 1;
  const pageWidth = layoutWidth || windowWidth || 1;

  const activeSwipeMode = pages[activeIndex]?.swipeMode ?? 'full';

  const goTo = (nextIndex: number, animated = true) => {
    const clamped = Math.max(0, Math.min(maxIndex, nextIndex));
    setActiveIndex(clamped);

    scrollRef.current?.scrollTo?.({ x: clamped * pageWidth, y: 0, animated });
  };

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

  useEffect(() => {
    goTo(activeIndex, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth]);

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

  const dots = useMemo(
    () =>
      pages.map((page, index) => (
        <View
          key={page.key}
          style={[styles.dot, index === activeIndex ? styles.dotActive : styles.dotInactive]}
        />
      )),
    [activeIndex, pages]
  );

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

      <View style={styles.dots} pointerEvents="none">
        {dots}
      </View>
    </View>
  );
};

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
  dots: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#0f172a',
  },
  dotInactive: {
    backgroundColor: '#cbd5e1',
  },
});
