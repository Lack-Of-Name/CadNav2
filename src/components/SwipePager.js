import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

export default function SwipePager({ pages }) {
  const scrollRef = useRef(null);
  const { width: windowWidth } = useWindowDimensions();

  const [activeIndex, setActiveIndex] = useState(0);
  const [layoutWidth, setLayoutWidth] = useState(0);

  const maxIndex = pages.length - 1;
  const pageWidth = layoutWidth || windowWidth || 1;

  const activeSwipeMode = pages[activeIndex]?.swipeMode ?? 'full';

  const goTo = (nextIndex, animated = true) => {
    const clamped = Math.max(0, Math.min(maxIndex, nextIndex));
    setActiveIndex(clamped);

    scrollRef.current?.scrollTo?.({ x: clamped * pageWidth, y: 0, animated });
  };

  const onLayout = (event) => {
    const nextWidth = event?.nativeEvent?.layout?.width ?? 0;
    if (!nextWidth || nextWidth === layoutWidth) return;
    setLayoutWidth(nextWidth);
  };

  useEffect(() => {
    // Keep position correct after resizes (web/desktop) or initial layout.
    goTo(activeIndex, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onKeyDown = (event) => {
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

  const onMomentumScrollEnd = (event) => {
    const x = event?.nativeEvent?.contentOffset?.x ?? 0;
    const nextIndex = Math.round(x / pageWidth);
    const clamped = Math.max(0, Math.min(maxIndex, nextIndex));
    if (clamped !== activeIndex) setActiveIndex(clamped);
  };

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

    const attach = (direction) => {
      let startX = null;

      const onStartShouldSetResponder = () => true;

      const onResponderGrant = (event) => {
        startX = event?.nativeEvent?.pageX ?? null;
      };

      const onResponderRelease = (event) => {
        const endX = event?.nativeEvent?.pageX ?? null;
        if (startX == null || endX == null) return;
        const dx = endX - startX;

        // Right swipe from left edge: prev. Left swipe from right edge: next.
        if (direction === 'left' && dx > 60) goTo(activeIndex - 1);
        if (direction === 'right' && dx < -60) goTo(activeIndex + 1);

        startX = null;
        startY = null;
      };

      return {
        onStartShouldSetResponder,
        onResponderGrant,
        onResponderRelease,
        onResponderTerminate: onResponderRelease
      };
    };

    return {
      left: attach('left'),
      right: attach('right')
    };
  }, [activeIndex, activeSwipeMode, goTo]);

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

      {activeSwipeMode === 'edge' ? (
        <>
          <View style={styles.edgeLeft} pointerEvents="box-only" {...edgeSwipeHandlers?.left} />
          <View style={styles.edgeRight} pointerEvents="box-only" {...edgeSwipeHandlers?.right} />
        </>
      ) : null}

      <View style={styles.dots} pointerEvents="none">
        {dots}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  page: {
    flex: 1
  },
  edgeLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 22
  },
  edgeRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 22
  },
  dots: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginHorizontal: 4
  },
  dotActive: {
    backgroundColor: '#0f172a'
  },
  dotInactive: {
    backgroundColor: '#cbd5e1'
  }
});
