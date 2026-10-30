import { router, type Href } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SampleRequestImage } from '@/components/dallni/sample-request-image';
import { DALLNI_COLORS, FlowHeader, SurfaceCard } from '@/components/dallni/flow-ui';
import { useDemoSession } from '@/context/demo-session';
import { useSupabaseAuth } from '@/context/supabase-auth';
import { mockShopRequests } from '@/data/shop-requests';
import { matchRequestToShop } from '@/utils/request-matching';

export default function ShopInboxScreen() {
  const { approvedRequests, shopProfile } = useDemoSession();
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();
  const [showOnlyMatches, setShowOnlyMatches] = useState(false);
  const entries = [
    ...approvedRequests.map((request) => ({ kind: 'customer' as const, request })),
    ...mockShopRequests.map((request) => ({ kind: 'sample' as const, request })),
  ];
  const matchingEntries = entries.map((entry) => {
    const area = entry.kind === 'customer' ? entry.request.area : entry.request.location;
    return {
      ...entry,
      area,
      match: matchRequestToShop(
        { category: entry.request.category, area },
        shopProfile,
      ),
    };
  });
  const matchCount = matchingEntries.filter((entry) => entry.match.matches).length;
  const visibleEntries = showOnlyMatches
    ? matchingEntries.filter((entry) => entry.match.matches)
    : matchingEntries;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader
        title="طلبات الزباين"
        subtitle="اختار طلب وجرّب حضّر عرض مناسب."
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <SurfaceCard style={styles.demoNotice}>
          <View style={styles.noticeIcon}>
            <Text style={styles.noticeIconText}>✓</Text>
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>صندوق تجريبي</Text>
            <Text style={styles.noticeText}>
              كل شي محلي وبيتنمسح لما تسكّر التطبيق. العروض ما رح تنبعت لزبائن حقيقيين.
            </Text>
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.connectedCard}>
          <Text style={styles.connectedTitle}>صندوق المحل المتصل</Text>
          <Text style={styles.connectedText}>
            {user
              ? 'افتح الطلبات المسموح لمحلّك يشوفها من قاعدة Supabase.'
              : 'سجّل دخولك بالبريد لتجهّز ملف المحل وتستخدم الطلبات المحفوظة على Supabase.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={isAuthLoading}
            onPress={() => router.push((user ? '/owner/online' : '/auth') as Href)}
            style={({ pressed }) => [
              styles.connectedButton,
              isAuthLoading && styles.connectedButtonDisabled,
              pressed && !isAuthLoading && styles.pressed,
            ]}>
            <Text style={styles.connectedButtonText}>
              {isAuthLoading ? 'عم نتحقق من الحساب…' : user ? 'افتح الصندوق المتصل' : 'تسجيل الدخول'}
            </Text>
          </Pressable>
        </SurfaceCard>

        <SurfaceCard style={styles.profileCard}>
          <View style={styles.profileHeading}>
            <Text style={styles.profileBadge}>تجريبي</Text>
            <Text style={styles.profileTitle}>ملف المحل</Text>
          </View>
          <Text style={styles.profileDetail}>
            {shopProfile.shopName || 'أضف اسم المحل ليظهر على عروضك.'}
          </Text>
          <Text style={styles.profileDetail}>
            {shopProfile.location || 'منطقة الخدمة غير محددة'}
          </Text>
          <Text style={styles.profileDetail}>
            {shopProfile.whatsappNumber || 'رقم واتساب غير محدد'}
          </Text>
          {shopProfile.productCategories.length > 0 && (
            <Text style={styles.profileDetail}>
              {shopProfile.productCategories.join('، ')}
            </Text>
          )}
          {shopProfile.productCategories.length === 0 && (
            <Text style={styles.profileDetail}>فئات المنتجات غير محددة</Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="تعديل ملف المحل التجريبي"
            onPress={() => router.push('/owner/profile')}
            style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}>
            <Text style={styles.profileButtonArrow}>←</Text>
            <Text style={styles.profileButtonText}>
              {shopProfile.shopName ? 'تعديل ملف المحل' : 'إعداد ملف المحل'}
            </Text>
          </Pressable>
        </SurfaceCard>

        <View style={styles.filterRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !showOnlyMatches }}
            onPress={() => setShowOnlyMatches(false)}
            style={[styles.filterOption, !showOnlyMatches && styles.filterOptionSelected]}>
            <Text
              style={[
                styles.filterOptionText,
                !showOnlyMatches && styles.filterOptionTextSelected,
              ]}>
              كل الطلبات ({matchingEntries.length})
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: showOnlyMatches }}
            onPress={() => setShowOnlyMatches(true)}
            style={[styles.filterOption, showOnlyMatches && styles.filterOptionSelected]}>
            <Text
              style={[
                styles.filterOptionText,
                showOnlyMatches && styles.filterOptionTextSelected,
              ]}>
              المطابقة ({matchCount})
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.requestCount}>
            {showOnlyMatches ? `${matchCount} طلب مطابق` : `${matchingEntries.length} طلب`}
          </Text>
          <Text style={styles.sectionTitle}>طلبات جديدة</Text>
        </View>

        {visibleEntries.length === 0 ? (
          <SurfaceCard style={styles.emptyMatches}>
            <Text style={styles.emptyMatchesTitle}>ما في طلبات مطابقة حالياً</Text>
            <Text style={styles.emptyMatchesText}>
              عدّل فئات المنتجات أو منطقة الخدمة، أو اعرض كل الطلبات.
            </Text>
          </SurfaceCard>
        ) : visibleEntries.map((entry) => {
          const isCustomerRequest = entry.kind === 'customer';
          const title = entry.request.title;
          const description = isCustomerRequest
            ? entry.request.details || 'طلب مع صورة مرفقة، بلا تفاصيل مكتوبة.'
            : entry.request.description;

          return (
            <Pressable
              key={entry.request.id}
              accessibilityRole="button"
              accessibilityLabel={'افتح الطلب: ' + title}
              onPress={() =>
                router.push({
                  pathname: '/owner/[requestId]',
                  params: { requestId: entry.request.id },
                })
              }
              style={({ pressed }) => [styles.requestCard, pressed && styles.pressed]}>
              {isCustomerRequest ? (
                entry.request.imageUri ? (
                  <Image
                    accessibilityLabel="صورة مرفقة من الزبون"
                    source={{ uri: entry.request.imageUri }}
                    style={styles.requestImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.noImageThumbnail}>
                    <Text style={styles.noImageText}>طلب</Text>
                  </View>
                )
              ) : (
                <SampleRequestImage
                  emoji={entry.request.imageEmoji}
                  backgroundColor={entry.request.imageBackground}
                  variant="thumbnail"
                />
              )}
              <View style={styles.requestCopy}>
                <View style={styles.requestMetaTop}>
                  <Text style={styles.category}>
                    {entry.request.category}
                  </Text>
                  <Text style={styles.received}>
                    {isCustomerRequest ? 'هالجلسة' : entry.request.received}
                  </Text>
                </View>
                <Text style={styles.requestTitle}>{title}</Text>
                <Text numberOfLines={2} style={styles.requestDescription}>
                  {description}
                </Text>
                <View style={styles.matchNotice}>
                  <Text
                    style={[
                      styles.matchBadge,
                      entry.match.matches && styles.matchBadgePositive,
                    ]}>
                    {entry.match.matches ? 'مطابق' : 'غير مطابق'}
                  </Text>
                  <Text style={styles.matchReason}>
                    {getMatchReason(entry.match, entry.request.category, entry.area)}
                  </Text>
                </View>
                <View style={styles.requestMetaBottom}>
                  {isCustomerRequest ? (
                    <>
                      <Text style={styles.location}>{entry.area}</Text>
                      <Text style={styles.sessionTag}>موافَق عليه</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.location}>{entry.request.location}</Text>
                      <Text style={styles.budget}>{entry.request.budgetLabel}</Text>
                    </>
                  )}
                </View>
                <Text style={styles.openLink}>افتح الطلب ←</Text>
              </View>
            </Pressable>
          );
        })}

        <Text style={styles.footerNote}>
          كل المعلومات بهالصندوق معمولة للتجربة فقط.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: DALLNI_COLORS.background,
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  demoNotice: {
    alignItems: 'flex-start',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderColor: '#D7E9E0',
    flexDirection: 'row-reverse',
    gap: 11,
    padding: 14,
  },
  connectedCard: {
    gap: 9,
    marginTop: 12,
    padding: 15,
  },
  connectedTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  connectedText: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  connectedButton: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.green,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 45,
    paddingHorizontal: 12,
  },
  connectedButtonDisabled: {
    opacity: 0.65,
  },
  connectedButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  noticeIcon: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.green,
    borderRadius: 12,
    height: 25,
    justifyContent: 'center',
    width: 25,
  },
  noticeIconText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  noticeCopy: {
    alignItems: 'flex-end',
    flex: 1,
    gap: 3,
  },
  noticeTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  noticeText: {
    color: '#526A60',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  profileCard: {
    gap: 8,
    marginTop: 12,
    padding: 14,
  },
  profileHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  profileTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  profileBadge: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 9,
    color: DALLNI_COLORS.greenDark,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    writingDirection: 'rtl',
  },
  profileDetail: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  profileButton: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.green,
    borderRadius: 12,
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 46,
  },
  profileButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  profileButtonArrow: {
    color: '#D8EEE5',
    fontSize: 18,
  },
  filterRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 16,
  },
  filterOption: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 8,
  },
  filterOptionSelected: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderColor: DALLNI_COLORS.green,
  },
  filterOptionText: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  filterOptionTextSelected: {
    color: DALLNI_COLORS.greenDark,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 23,
    marginBottom: 12,
  },
  sectionTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestCount: {
    color: DALLNI_COLORS.green,
    fontSize: 11,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  requestCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 12,
    marginBottom: 11,
    padding: 12,
  },
  requestCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },
  requestImage: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 13,
    height: 88,
    width: 82,
  },
  noImageThumbnail: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 13,
    height: 88,
    justifyContent: 'center',
    width: 82,
  },
  noImageText: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 12,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  requestMetaTop: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    width: '100%',
  },
  category: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 10,
    color: DALLNI_COLORS.greenDark,
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    writingDirection: 'rtl',
  },
  received: {
    color: '#8B9992',
    fontSize: 9,
    writingDirection: 'rtl',
  },
  requestTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 7,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestDescription: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  matchNotice: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    backgroundColor: '#F7F9F8',
    borderRadius: 10,
    flexDirection: 'row-reverse',
    gap: 7,
    marginTop: 7,
    padding: 8,
  },
  matchBadge: {
    backgroundColor: '#FCEFEA',
    borderRadius: 8,
    color: '#9B493B',
    fontSize: 9,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
    writingDirection: 'rtl',
  },
  matchBadgePositive: {
    backgroundColor: DALLNI_COLORS.greenLight,
    color: DALLNI_COLORS.greenDark,
  },
  matchReason: {
    color: DALLNI_COLORS.muted,
    flex: 1,
    fontSize: 9,
    lineHeight: 15,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestMetaBottom: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
    marginTop: 9,
  },
  location: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    writingDirection: 'rtl',
  },
  budget: {
    color: DALLNI_COLORS.green,
    fontSize: 10,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  sessionTag: {
    color: DALLNI_COLORS.green,
    fontSize: 10,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  openLink: {
    color: DALLNI_COLORS.green,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  footerNote: {
    color: '#8B9992',
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptyMatches: {
    gap: 6,
    padding: 16,
  },
  emptyMatchesTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  emptyMatchesText: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  pressed: {
    opacity: 0.8,
  },
});

function getMatchReason(
  match: ReturnType<typeof matchRequestToShop>,
  category: string,
  area: string,
) {
  if (!match.hasShopCategories || !match.hasServiceArea) {
    return 'حدّد فئات المنتجات ومنطقة الخدمة بملف المحل لتفعيل المطابقة.';
  }
  if (match.matches) {
    return `مطابق لفئة ${category} ضمن منطقة ${area}.`;
  }
  if (match.categoryMatches) {
    return 'الفئة مناسبة، لكن المنطقة خارج نطاق الخدمة.';
  }
  if (match.areaMatches) {
    return 'المنطقة ضمن الخدمة، لكن فئة الطلب مش ضمن فئات المحل.';
  }
  return 'الفئة والمنطقة ما بيتطابقوا مع بيانات المحل.';
}
