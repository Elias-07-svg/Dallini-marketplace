import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DALLNI_COLORS } from '@/components/dallni/flow-ui';
import { REQUEST_CATEGORIES } from '@/data/request-categories';

const categoryIcons: Record<(typeof REQUEST_CATEGORIES)[number], string> = {
  إلكترونيات: '📱',
  أثاث: '🛋️',
  رياضة: '⚽',
  أزياء: '👟',
  'منزل ومطبخ': '🏠',
  'جمال وعناية': '🧴',
  ألعاب: '🧸',
  أخرى: '✨',
};

export default function ExploreScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.brandHeader}>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>دَلّني</Text>
            <Text style={styles.brandSub}>DALLNI</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>تسوّق أذكى</Text>
          </View>
        </View>

        <Text style={styles.eyebrow}>استكشف دَلّني</Text>
        <Text style={styles.title}>شو عم تفتّش؟</Text>
        <Text style={styles.subtitle}>
          اختار فئة، اكتب شو بدك، وخلي المحلات تبعتلك عروضها.
        </Text>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>✦ على ذوقك وبطريقتك</Text>
          <Text style={styles.heroTitle}>مش لاقي اللي بدك ياه؟</Text>
          <Text style={styles.heroDescription}>
            ما في داعي تدوّر بين المحلات. اكتب طلبك مرة وحدة، وقارن العروض اللي بتوصلك.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="اكتب طلباً جديداً"
            onPress={() => router.push('/request')}
            style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}>
            <Text style={styles.heroButtonText}>اكتب طلب جديد</Text>
            <Text style={styles.heroButtonArrow}>←</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionCount}>{REQUEST_CATEGORIES.length} فئات</Text>
          <Text style={styles.sectionTitle}>تصفّح حسب الفئة</Text>
        </View>

        <View style={styles.categoryGrid}>
          {REQUEST_CATEGORIES.map((category) => (
            <Pressable
              key={category}
              accessibilityRole="button"
              accessibilityLabel={`ابدأ طلباً ضمن فئة ${category}`}
              onPress={() => router.push({
                pathname: '/request',
                params: {
                  prompt: `عم فتّش على غرض ضمن فئة ${category}`,
                  category,
                },
              })}
              style={({ pressed }) => [styles.categoryCard, pressed && styles.categoryPressed]}>
              <View style={styles.categoryTop}>
                <Text style={styles.categoryArrow}>←</Text>
                <View style={styles.categoryIconWrap}>
                  <Text style={styles.categoryIcon}>{categoryIcons[category]}</Text>
                </View>
              </View>
              <Text style={styles.categoryName}>{category}</Text>
              <Text style={styles.categoryAction}>ابدأ طلبك</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>كيف بتلاقي اللي بدك ياه؟</Text>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>١</Text></View>
            <Text style={styles.stepText}>اكتب طلبك وحدّد المنطقة.</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>٢</Text></View>
            <Text style={styles.stepText}>راجع طلبك ووافق على نشره.</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>٣</Text></View>
            <Text style={styles.stepText}>قارن العروض وتواصل عبر واتساب بعد اختيارك.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: DALLNI_COLORS.background, flex: 1 },
  content: { gap: 0, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30 },
  brandHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  brandCopy: { alignItems: 'flex-end' },
  brandName: { color: DALLNI_COLORS.green, fontSize: 24, fontWeight: '900', writingDirection: 'rtl' },
  brandSub: { color: '#8A9992', fontSize: 9, letterSpacing: 2.2 },
  headerBadge: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 11, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  headerBadgeText: { color: DALLNI_COLORS.greenDark, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  eyebrow: { color: DALLNI_COLORS.green, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  title: { color: DALLNI_COLORS.ink, fontSize: 28, fontWeight: '900', marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { color: DALLNI_COLORS.muted, fontSize: 12, lineHeight: 21, marginTop: 7, marginBottom: 18, textAlign: 'right', writingDirection: 'rtl' },
  heroCard: { alignItems: 'flex-end', backgroundColor: DALLNI_COLORS.green, borderRadius: 22, gap: 10, marginBottom: 25, padding: 19 },
  heroEyebrow: { color: '#BDE4D5', fontSize: 10, fontWeight: '700', writingDirection: 'rtl' },
  heroTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  heroDescription: { color: '#E0F1E9', fontSize: 11, lineHeight: 19, textAlign: 'right', writingDirection: 'rtl' },
  heroButton: { alignItems: 'center', backgroundColor: DALLNI_COLORS.gold, borderRadius: 12, flexDirection: 'row-reverse', gap: 8, justifyContent: 'center', marginTop: 3, minHeight: 44, paddingHorizontal: 15 },
  heroButtonText: { color: '#26352E', fontSize: 11, fontWeight: '900', writingDirection: 'rtl' },
  heroButtonArrow: { color: '#26352E', fontSize: 17, lineHeight: 19 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: DALLNI_COLORS.ink, fontSize: 16, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  sectionCount: { color: DALLNI_COLORS.muted, fontSize: 10, writingDirection: 'rtl' },
  categoryGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  categoryCard: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 16, borderWidth: 1, minHeight: 104, padding: 12, width: '48.5%' },
  categoryPressed: { backgroundColor: '#F0F7F3', borderColor: '#BBD8CB', transform: [{ scale: 0.98 }] },
  categoryTop: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  categoryIconWrap: { alignItems: 'center', backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 12, height: 38, justifyContent: 'center', width: 38 },
  categoryIcon: { fontSize: 21 },
  categoryArrow: { color: '#9AA8A0', fontSize: 16 },
  categoryName: { color: DALLNI_COLORS.ink, fontSize: 12, fontWeight: '800', marginTop: 9, textAlign: 'right', writingDirection: 'rtl' },
  categoryAction: { color: DALLNI_COLORS.green, fontSize: 9, fontWeight: '700', marginTop: 3, textAlign: 'right', writingDirection: 'rtl' },
  stepsCard: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 17, borderWidth: 1, gap: 11, marginTop: 23, padding: 15 },
  stepsTitle: { color: DALLNI_COLORS.ink, fontSize: 13, fontWeight: '900', marginBottom: 2, textAlign: 'right', writingDirection: 'rtl' },
  stepRow: { alignItems: 'center', flexDirection: 'row-reverse', gap: 9 },
  stepNumber: { alignItems: 'center', backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 11, height: 23, justifyContent: 'center', width: 23 },
  stepNumberText: { color: DALLNI_COLORS.greenDark, fontSize: 10, fontWeight: '900' },
  stepText: { color: DALLNI_COLORS.muted, flex: 1, fontSize: 10, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.82 },
});
