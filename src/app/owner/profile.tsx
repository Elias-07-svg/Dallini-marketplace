import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfferField } from '@/components/dallni/offer-field';
import {
  ConfirmationPanel,
  DALLNI_COLORS,
  FlowHeader,
  PrimaryButton,
  SurfaceCard,
} from '@/components/dallni/flow-ui';
import { useDemoSession } from '@/context/demo-session';
import { normalizeInternationalWhatsAppNumber } from '@/utils/whatsapp';

export default function ShopProfileScreen() {
  const { approvedRequests, shopProfile, updateShopProfile } = useDemoSession();
  const [shopName, setShopName] = useState(shopProfile.shopName);
  const [whatsappNumber, setWhatsappNumber] = useState(shopProfile.whatsappNumber);
  const [location, setLocation] = useState(shopProfile.location);
  const [categoriesText, setCategoriesText] = useState(
    shopProfile.productCategories.join('، '),
  );
  const [saved, setSaved] = useState(false);
  const normalizedWhatsAppNumber = normalizeInternationalWhatsAppNumber(whatsappNumber);
  const hasInvalidWhatsAppNumber =
    whatsappNumber.trim().length > 0 && normalizedWhatsAppNumber === null;
  const ratings = approvedRequests.flatMap((request) =>
    request.rating ? [{ requestTitle: request.title, rating: request.rating }] : [],
  );

  function saveProfile() {
    if (hasInvalidWhatsAppNumber) return;

    const productCategories = Array.from(
      new Set(
        categoriesText
          .split(/[،,\n]/)
          .map((category) => category.trim())
          .filter(Boolean),
      ),
    ).slice(0, 12);

    updateShopProfile({
      shopName: shopName.trim(),
      whatsappNumber: normalizedWhatsAppNumber ?? '',
      location: location.trim(),
      productCategories,
    });
    setSaved(true);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader
        title="ملف المحل"
        subtitle="عرّف الزبائن على محلك وخلي بياناتك جاهزة لعروضك."
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <SurfaceCard style={styles.demoNotice}>
          <Text style={styles.demoNoticeTitle}>ملف تجريبي مؤقت</Text>
          <Text style={styles.demoNoticeText}>
            بيانات الملف محفوظة بهالجلسة بس، وبتنمسح لما تسكّر التطبيق. اسم المحل ورقم واتساب
            بينضافوا تلقائياً على العروض، والتقييمات كمان بتضل بهالجلسة بس.
          </Text>
        </SurfaceCard>

        <SurfaceCard style={styles.formCard}>
          <OfferField
            label="اسم المحل"
            placeholder="مثلاً: محل المدينة"
            value={shopName}
            onChangeText={(value) => {
              setShopName(value);
              setSaved(false);
            }}
            maxLength={70}
          />
          <OfferField
            label="رقم واتساب بصيغة دولية"
            placeholder="+ رمز الدولة والرقم"
            value={whatsappNumber}
            onChangeText={(value) => {
              setWhatsappNumber(value);
              setSaved(false);
            }}
            keyboardType="phone-pad"
            maxLength={24}
          />
          <Text
            style={[
              styles.fieldHint,
              hasInvalidWhatsAppNumber && styles.fieldHintInvalid,
            ]}>
            {hasInvalidWhatsAppNumber
              ? 'اكتب الرقم مع + ورمز الدولة بصيغة دولية صحيحة.'
              : 'الرقم الدولي مطلوب لإضافة عرض والتواصل عبر واتساب.'}
          </Text>
          <OfferField
            label="منطقة الخدمة"
            placeholder="مثلاً: طرابلس - الميناء"
            value={location}
            onChangeText={(value) => {
              setLocation(value);
              setSaved(false);
            }}
            maxLength={80}
          />
          <Text style={styles.fieldHint}>
            اكتب المنطقة أو المناطق اللي بتخدمها، مثل ما بيكتبها الزبون.
          </Text>
          <OfferField
            label="فئات المنتجات"
            placeholder="إلكترونيات، أثاث، رياضة"
            value={categoriesText}
            onChangeText={(value) => {
              setCategoriesText(value);
              setSaved(false);
            }}
            multiline
            maxLength={220}
          />
          <Text style={styles.fieldHint}>
            افصل بين الفئات بفاصلة واستخدم أسماء فئات الطلبات للمطابقة.
          </Text>

          {saved && (
            <ConfirmationPanel>
              <Text style={styles.savedTitle}>تم حفظ ملف المحل</Text>
              <Text style={styles.savedText}>
                صار جاهز للاستخدام بالعروض بهالجلسة التجريبية.
              </Text>
            </ConfirmationPanel>
          )}

          <PrimaryButton
            disabled={hasInvalidWhatsAppNumber}
            label="حفظ ملف المحل التجريبي"
            onPress={saveProfile}
          />
        </SurfaceCard>

        <SurfaceCard style={styles.ratingsCard}>
          <View style={styles.ratingsHeading}>
            <Text style={styles.ratingsCount}>{ratings.length} تقييم</Text>
            <Text style={styles.ratingsTitle}>تقييمات الزبائن</Text>
          </View>
          {ratings.length === 0 ? (
            <Text style={styles.emptyRatings}>
              بعد إكمال أول طلب، بتظهر تقييمات الزبائن هون.
            </Text>
          ) : (
            ratings.map(({ requestTitle, rating }) => (
              <View key={rating.id} style={styles.ratingCard}>
                <View style={styles.ratingHeading}>
                  <Text style={styles.ratingScore}>{rating.stars} / ٥</Text>
                  <Text style={styles.ratingStars}>
                    {'★'.repeat(rating.stars)}{'☆'.repeat(5 - rating.stars)}
                  </Text>
                </View>
                <Text style={styles.ratingRequestTitle}>{requestTitle}</Text>
                <Text style={styles.ratingComment}>
                  {rating.comment || 'تقييم بدون تعليق'}
                </Text>
              </View>
            ))
          )}
        </SurfaceCard>
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
    gap: 13,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  demoNotice: {
    backgroundColor: DALLNI_COLORS.greenLight,
    gap: 5,
    padding: 14,
  },
  demoNoticeTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  demoNoticeText: {
    color: '#526A60',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  formCard: {
    gap: 13,
    padding: 16,
  },
  ratingsCard: {
    gap: 11,
    padding: 15,
  },
  ratingsHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  ratingsTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  ratingsCount: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 11,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  emptyRatings: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  ratingCard: {
    backgroundColor: '#F7F9F8',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 13,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  ratingHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  ratingStars: {
    color: DALLNI_COLORS.gold,
    fontSize: 18,
  },
  ratingScore: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 11,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  ratingRequestTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  ratingComment: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fieldHint: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    marginTop: -8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fieldHintInvalid: {
    color: '#B34A3C',
  },
  savedTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  savedText: {
    color: DALLNI_COLORS.ink,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
