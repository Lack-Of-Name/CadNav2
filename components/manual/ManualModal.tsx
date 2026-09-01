import { MANUAL_SECTIONS, type ManualItem, type ManualSection } from '@/constants/manual';
import { Colors, Radius, Space } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const IMAGE_MAP: Record<string, ImageSourcePropType> = {
  'manual-api-key.png': require('@/assets/images/manual/manual-api-key.png'),
  'manual-api-key-01-signup.png': require('@/assets/images/manual/manual-api-key-01-signup.png'),
  'manual-api-key-02-dashboard.png': require('@/assets/images/manual/manual-api-key-02-dashboard.png'),
  'manual-api-key-03-copy-key.png': require('@/assets/images/manual/manual-api-key-03-copy-key.png'),
  'manual-api-key-04-paste-key.png': require('@/assets/images/manual/manual-api-key-04-paste-key.png'),
  'manual-drawer.png': require('@/assets/images/manual/manual-drawer.png'),
  'manual-gps-modes.png': require('@/assets/images/manual/manual-gps-modes.png'),
  'manual-setting-target.png': require('@/assets/images/manual/manual-setting-target.png'),
  'manual-grid-ref.png': require('@/assets/images/manual/manual-grid-ref.png'),
  'manual-project-point.png': require('@/assets/images/manual/manual-project-point.png'),
  'manual-workspace-routes.png': require('@/assets/images/manual/manual-workspace-routes.png'),
  'manual-adding-waypoints.png': require('@/assets/images/manual/manual-adding-waypoints.png'),
  'manual-grid-overlay.png': require('@/assets/images/manual/manual-grid-overlay.png'),
};

type ViewMode = 'sections' | 'items' | 'detail';

type ThemeColors = {
  primary: string;
  secondary: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  background: string;
  surface: string;
  divider: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onComplete?: () => void;
};

const CONTENT_MAX_W = 560;
const CONTENT_H_PAD = 20;
const IMAGE_ASPECT_RATIO = 8 / 5;

export function ManualModal({ visible, onClose, onComplete }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const C: ThemeColors = Colors[scheme];
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<ViewMode>('sections');
  const [currentSection, setCurrentSection] = useState<ManualSection | null>(null);
  const [currentItem, setCurrentItem] = useState<ManualItem | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const openSection = useCallback((section: ManualSection) => {
    setCurrentSection(section);
    setMode('items');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const openItem = useCallback((item: ManualItem) => {
    setCurrentItem(item);
    setMode('detail');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const goBack = useCallback(() => {
    if (mode === 'detail') {
      setMode('items');
      setCurrentItem(null);
    } else if (mode === 'items') {
      setMode('sections');
      setCurrentSection(null);
    }
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [mode]);

  const resetAndClose = useCallback(() => {
    setMode('sections');
    setCurrentSection(null);
    setCurrentItem(null);
    onClose();
  }, [onClose]);

  const handleComplete = useCallback(() => {
    onComplete?.();
    resetAndClose();
  }, [onComplete, resetAndClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={resetAndClose}>
      <Pressable style={styles.backdrop} onPress={resetAndClose}>
        <View style={styles.flexContainer}>
          <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.divider, paddingTop: insets.top + Space.sm }]}>
            {/* Header */}
            <View style={styles.header}>
              {mode !== 'sections' ? (
                <Pressable onPress={goBack} hitSlop={8} style={styles.backBtn}>
                  <Text style={[styles.backBtnText, { color: C.primary }]}>‹ Back</Text>
                </Pressable>
              ) : (
                <View style={{ width: 60 }} />
              )}
              <Text style={[styles.headerTitle, { color: C.text }]} numberOfLines={1}>
                {mode === 'sections' ? 'CadNav Manual' : mode === 'items' ? currentSection?.title : currentItem?.title}
              </Text>
              <Pressable onPress={resetAndClose} hitSlop={8} style={[styles.closeBtn, { backgroundColor: C.divider }]}>
                <Text style={[styles.closeBtnText, { color: C.textMuted }]}>✕</Text>
              </Pressable>
            </View>

            {/* Content */}
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              bounces={true}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >
              {mode === 'sections' && (
                <SectionsView C={C} sections={MANUAL_SECTIONS} onSelectSection={openSection} />
              )}
              {mode === 'items' && currentSection && (
                <ItemsView C={C} section={currentSection} onSelectItem={openItem} />
              )}
              {mode === 'detail' && currentItem && (
                <DetailView C={C} item={currentItem} />
              )}
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: C.divider }]}>
              {mode === 'detail' ? (
                <View style={styles.footerRow}>
                  <Pressable onPress={goBack} style={[styles.footerBtn, { borderColor: C.divider }]}>
                    <Text style={[styles.footerBtnText, { color: C.text }]}>Back</Text>
                  </Pressable>
                  {currentSection && currentItem && (
                    <Pressable
                      onPress={() => {
                        const idx = currentSection.items.indexOf(currentItem);
                        if (idx < currentSection.items.length - 1) {
                          openItem(currentSection.items[idx + 1]);
                        } else {
                          handleComplete();
                        }
                      }}
                      style={[styles.footerBtn, styles.footerBtnPrimary, { backgroundColor: C.primary }]}
                    >
                      <Text style={[styles.footerBtnText, styles.footerBtnPrimaryText, { color: '#fff' }]}>
                        {currentSection && currentSection.items.indexOf(currentItem) < currentSection.items.length - 1
                          ? 'Next Item'
                          : 'Finish'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <Pressable onPress={resetAndClose} style={styles.footerCenterBtn}>
                  <Text style={[styles.footerCenterBtnText, { color: C.textMuted }]}>
                    {mode === 'sections' ? 'Close Manual' : 'Close'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function SectionsView({
  C,
  sections,
  onSelectSection,
}: {
  C: ThemeColors;
  sections: ManualSection[];
  onSelectSection: (s: ManualSection) => void;
}) {
  const apiKeySection = sections.find((s) => s.id === 'api-key-tutorial');
  return (
    <View style={styles.sectionsContainer}>
      <Text style={[styles.introText, { color: C.textMuted }]}>
        Browse by screen or feature area. Each section covers the buttons and controls you will use.
      </Text>
      {apiKeySection ? (
        <Pressable
          style={[styles.featuredCard, { backgroundColor: C.primary, borderColor: C.primary }]}
          onPress={() => onSelectSection(apiKeySection)}
          android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.featuredTitle, { color: '#fff' }]}>Get your free map key in about 2 minutes</Text>
            <Text style={[styles.featuredSummary, { color: 'rgba(255,255,255,0.9)' }]}>
              The map needs a free MapTiler key. Tap here for the step by step guide with screenshots. No credit card needed. You can paste your key without leaving the guide.
            </Text>
            <Text style={[styles.featuredAction, { color: '#fff' }]}>Open guide</Text>
          </View>
          <Text style={[styles.chevron, { color: '#fff' }]}>›</Text>
        </Pressable>
      ) : null}
      {sections.map((section) => (
        <Pressable
          key={section.id}
          style={[styles.sectionCard, { backgroundColor: C.background, borderColor: C.divider }]}
          onPress={() => onSelectSection(section)}
          android_ripple={{ color: C.primary + '20' }}
        >
          <View style={styles.sectionCardBody}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>{section.title}</Text>
            <Text style={[styles.sectionSummary, { color: C.textMuted }]}>{section.summary}</Text>
            <Text style={[styles.sectionCount, { color: C.textSubtle }]}>
              {section.items.length} {section.items.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
          <Text style={[styles.chevron, { color: C.textSubtle }]}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ItemsView({
  C,
  section,
  onSelectItem,
}: {
  C: ThemeColors;
  section: ManualSection;
  onSelectItem: (item: ManualItem) => void;
}) {
  return (
    <View style={styles.itemsContainer}>
      <Text style={[styles.sectionDesc, { color: C.textMuted }]}>{section.summary}</Text>
      {section.items.map((item, i) => (
        <Pressable
          key={item.id}
          style={[styles.itemRow, { borderBottomColor: C.divider }]}
          onPress={() => onSelectItem(item)}
          android_ripple={{ color: C.primary + '15' }}
        >
          <View style={[styles.itemIndex, { backgroundColor: C.primary + '20' }]}>
            <Text style={[styles.itemIndexText, { color: C.primary }]}>{i + 1}</Text>
          </View>
          <View style={styles.itemRowBody}>
            <Text style={[styles.itemRowTitle, { color: C.text }]}>{item.title}</Text>
            <Text style={[styles.itemRowImage, { color: C.textSubtle }]} numberOfLines={1}>
              {item.imageCaption.slice(0, 80)}…
            </Text>
          </View>
          <Text style={[styles.chevron, { color: C.textSubtle }]}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

function DetailView({ C, item }: { C: ThemeColors; item: ManualItem }) {
  const imgSource = IMAGE_MAP[item.imageName] ?? undefined;
  const { width: screenW } = useWindowDimensions();
  const imgWidth = Math.min(screenW - 48, 500);
  const imgHeight = Math.round(imgWidth / IMAGE_ASPECT_RATIO);
  const isApiKeyItem = item.id === 'api-key-step-4-paste' || item.id === 'api-key-setup';

  return (
    <View style={styles.detailContainer}>
      {imgSource ? (
        <View style={[styles.imageWrapper, { borderColor: C.divider }]}>
          <Image
            source={imgSource}
            style={{ width: imgWidth, height: imgHeight, backgroundColor: '#1a1a1a' }}
            resizeMode="contain"
          />
        </View>
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: C.background, borderColor: C.divider }]}>
          <Text style={[styles.imagePlaceholderIcon, { color: C.textSubtle }]}>IMG</Text>
          <Text style={[styles.imagePlaceholderText, { color: C.textMuted }]}>
            {item.imageName}
          </Text>
          <Text style={[styles.imagePlaceholderCaption, { color: C.textSubtle }]}>
            {item.imageCaption}
          </Text>
        </View>
      )}
      <Text style={[styles.pageTitle, { color: C.text }]}>{item.title}</Text>
      <Text style={[styles.pageDescription, { color: C.textMuted }]}>{item.description}</Text>
      {isApiKeyItem ? <ApiKeyInlineField C={C} /> : null}
    </View>
  );
}

function ApiKeyInlineField({ C }: { C: ThemeColors }) {
  const { apiKey, saveApiKey } = useMapTilerKey();
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const handleSave = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Paste your MapTiler key first.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const res = await saveApiKey(trimmed);
    setSaving(false);
    if (!res.ok) setError(res.message);
    else {
      setSuccess('Key saved. The map will reload with tiles.');
      setInput('');
    }
  };

  return (
    <View style={[styles.apiKeyFieldCard, { backgroundColor: C.background, borderColor: C.divider }]}>
      <Text style={[styles.apiKeyFieldTitle, { color: C.text }]}>Paste your MapTiler key here</Text>
      <Text style={[styles.apiKeyFieldHelp, { color: C.textMuted }]}>
        Copy your key from cloud.maptiler.com/account/keys and paste below. Tap Save to store it. Current: {apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : 'none saved'}
      </Text>
      <TextInput
        value={input}
        onChangeText={(v) => { setInput(v); setError(null); setSuccess(null); }}
        placeholder="Paste MapTiler key"
        placeholderTextColor={C.textSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        style={[styles.apiKeyInput, { color: C.text, borderColor: C.divider, backgroundColor: C.surface }]}
      />
      {error ? <Text style={[styles.apiKeyError, { color: '#B54A3C' }]}>{error}</Text> : null}
      {success ? <Text style={[styles.apiKeySuccess, { color: '#5C7A3A' }]}>{success}</Text> : null}
      <View style={styles.apiKeyActions}>
        <Pressable
          onPress={() => Linking.openURL('https://cloud.maptiler.com/account/keys')}
          style={[styles.apiKeySecondaryBtn, { borderColor: C.divider }]}
        >
          <Text style={[styles.apiKeySecondaryBtnText, { color: C.text }]}>Open MapTiler keys</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.apiKeyPrimaryBtn, { backgroundColor: C.primary, opacity: saving ? 0.7 : 1 }]}
        >
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.apiKeyPrimaryBtnText}>Save key</Text>}
        </Pressable>
      </View>
      <Pressable onPress={() => Linking.openURL('https://cloud.maptiler.com/')} style={styles.apiKeyLink}>
        <Text style={[styles.apiKeyLinkText, { color: C.textMuted }]}>Need a key: cloud.maptiler.com - sign up free</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  flexContainer: {
    flex: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_W,
    maxHeight: '92%',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CONTENT_H_PAD,
    paddingBottom: Space.sm,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  backBtn: {
    width: 60,
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: CONTENT_H_PAD,
    paddingBottom: Space.sm,
  },

  // Sections view
  sectionsContainer: {
    gap: Space.sm,
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Space.sm,
  },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Space.md,
  },
  sectionCardBody: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSummary: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  sectionCount: {
    fontSize: 12,
  },
  chevron: {
    fontSize: 22,
    fontWeight: '300',
    marginLeft: Space.sm,
  },
  featuredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Space.md,
    marginBottom: Space.sm,
  },
  featuredTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  featuredSummary: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  featuredAction: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Items view
  itemsContainer: {
    gap: 0,
  },
  sectionDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Space.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Space.sm + 4,
  },
  itemIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIndexText: {
    fontSize: 13,
    fontWeight: '700',
  },
  itemRowBody: {
    flex: 1,
  },
  itemRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemRowImage: {
    fontSize: 12,
  },

  // Detail view
  detailContainer: {
    gap: Space.sm,
  },
  imageWrapper: {
    alignSelf: 'center',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: Space.sm,
  },
  imagePlaceholder: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: Space.lg,
    alignItems: 'center',
    marginBottom: Space.sm,
  },
  imagePlaceholderIcon: {
    fontSize: 32,
    marginBottom: Space.sm,
  },
  imagePlaceholderText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  imagePlaceholderCaption: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  pageDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  apiKeyFieldCard: {
    marginTop: Space.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Space.md,
    gap: 8,
  },
  apiKeyFieldTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  apiKeyFieldHelp: {
    fontSize: 12,
    lineHeight: 16,
  },
  apiKeyInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  apiKeyError: {
    fontSize: 12,
  },
  apiKeySuccess: {
    fontSize: 12,
  },
  apiKeyActions: {
    flexDirection: 'row',
    gap: Space.sm,
    marginTop: 4,
  },
  apiKeySecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  apiKeySecondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  apiKeyPrimaryBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiKeyPrimaryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  apiKeyLink: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 4,
  },
  apiKeyLinkText: {
    fontSize: 12,
  },

  // Footer
  footer: {
    paddingHorizontal: CONTENT_H_PAD,
    paddingVertical: Space.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerRow: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  footerBtnPrimary: {
    borderWidth: 0,
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  footerBtnPrimaryText: {
    color: '#fff',
  },
  footerCenterBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  footerCenterBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
