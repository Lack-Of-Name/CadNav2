import { Colors } from '@/constants/theme';
import { type Tutorial, type TutorialPage } from '@/constants/tutorials';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  tutorial: Tutorial;
  visible: boolean;
  onClose: () => void;
  onComplete?: () => void;
};

export function TutorialModal({ tutorial, visible, onClose, onComplete }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const [pageIndex, setPageIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const isLastPage = pageIndex === tutorial.pages.length - 1;
  const page = tutorial.pages[pageIndex];

  const handleNext = useCallback(() => {
    if (isLastPage) {
      onComplete?.();
      onClose();
    } else {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setPageIndex((i) => i + 1);
    }
  }, [isLastPage, onComplete, onClose]);

  const handlePrev = useCallback(() => {
    if (pageIndex > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setPageIndex((i) => i - 1);
    }
  }, [pageIndex]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const resetAndClose = useCallback(() => {
    setPageIndex(0);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={resetAndClose}>
      <Pressable style={styles.backdrop} onPress={resetAndClose}>
        <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: C.text }]}>{tutorial.title}</Text>
            <Pressable onPress={resetAndClose} hitSlop={8} style={[styles.closeBtn, { backgroundColor: C.divider }]}>
              <Text style={[styles.closeBtnText, { color: C.textMuted }]}>✕</Text>
            </Pressable>
          </View>

          {/* Page content */}
          <ScrollView
            ref={scrollRef}
            style={styles.contentScroll}
            contentContainerStyle={styles.contentContainer}
            bounces={false}
            showsVerticalScrollIndicator={true}
          >
            {page.title && (
              <Text style={[styles.pageTitle, { color: C.primary }]}>{page.title}</Text>
            )}
            <Text style={[styles.pageText, { color: C.text }]}>{page.text}</Text>
            {page.image && (
              <Image
                source={page.image}
                style={[styles.pageImage, { borderColor: C.divider }]}
                resizeMode="contain"
              />
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: C.divider }]}>
            {/* Page dots */}
            <View style={styles.dotsRow}>
              {tutorial.pages.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i === pageIndex ? C.primary : C.divider,
                      width: i === pageIndex ? 20 : 8,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Navigation buttons */}
            <View style={styles.navRow}>
              {pageIndex > 0 ? (
                <Pressable
                  onPress={handlePrev}
                  style={[styles.navBtn, { borderColor: C.divider }]}
                >
                  <Text style={[styles.navBtnText, { color: C.text }]}>Previous</Text>
                </Pressable>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <Pressable
                onPress={handleNext}
                style={[styles.navBtn, styles.navBtnPrimary, { backgroundColor: C.primary }]}
              >
                <Text style={[styles.navBtnText, styles.navBtnPrimaryText, { color: '#fff' }]}>
                  {isLastPage ? 'Done' : 'Next'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_MAX_W = 520;
const CARD_PADDING = 24;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: CARD_MAX_W,
    maxHeight: '85%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  contentScroll: {
    maxHeight: 400,
  },
  contentContainer: {
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 8,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  pageText: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.85,
  },
  pageImage: {
    width: SCREEN_WIDTH - CARD_PADDING * 2 - 40,
    maxWidth: CARD_MAX_W - CARD_PADDING * 2,
    maxHeight: 280,
    marginTop: 16,
    alignSelf: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  navBtnPrimary: {
    borderWidth: 0,
  },
  navBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  navBtnPrimaryText: {
    color: '#fff',
  },
});
