import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfferField } from '@/components/dallni/offer-field';
import {
  DALLNI_COLORS,
  FlowHeader,
  PrimaryButton,
  SurfaceCard,
} from '@/components/dallni/flow-ui';
import { useSupabaseAuth } from '@/context/supabase-auth';
import {
  createOwnerShop,
  loadOwnerShop,
  shopOwnerErrorCode,
  updateOwnerShop,
  type OwnerShopProfile,
  type OwnerShopProfileInput,
} from '@/lib/shop-owner-supabase';
import { normalizeInternationalWhatsAppNumber } from '@/utils/whatsapp';

function splitList(value: string, maxItems: number) {
  return Array.from(new Set(value.split(/[،,\n]/u).map((item) => item.trim()).filter(Boolean)))
    .slice(0, maxItems);
}

export default function ConnectedShopProfileScreen() {
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();
  const [shop, setShop] = useState<OwnerShopProfile | null>(null);
  const [shopName, setShopName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [location, setLocation] = useState('');
  const [serviceAreasText, setServiceAreasText] = useState('');
  const [categoriesText, setCategoriesText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadProfile = useCallback(async () => {
    if (!user) {
      return { profile: null, errorCode: null };
    }

    try {
      const profile = await loadOwnerShop(user.id);
      return { profile, errorCode: null };
    } catch (error) {
      return { profile: null, errorCode: shopOwnerErrorCode(error) };
    }
  }, [user]);

  useEffect(() => {
    if (isAuthLoading) return;

    let isCurrent = true;
    void loadProfile().then((result) => {
      if (!isCurrent) return;
      setShop(result.profile);
      setShopName(result.profile?.shop_name ?? '');
      setWhatsappNumber(result.profile?.whatsapp_number ?? '');
      setLocation(result.profile?.location ?? '');
      setServiceAreasText(result.profile?.service_areas.join('، ') ?? '');
      setCategoriesText(result.profile?.product_categories.join('، ') ?? '');
      setErrorCode(result.errorCode);
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [isAuthLoading, loadProfile, refreshKey]);

  const normalizedWhatsAppNumber = normalizeInternationalWhatsAppNumber(whatsappNumber);
  const hasInvalidWhatsAppNumber = whatsappNumber.trim().length > 0 && !normalizedWhatsAppNumber;
  const canSave = Boolean(user) && shopName.trim().length > 0 && !hasInvalidWhatsAppNumber && !isSaving;

  async function saveProfile() {
    if (!user || !canSave) return;

    const input: OwnerShopProfileInput = {
      shop_name: shopName.trim().slice(0, 70),
      whatsapp_number: normalizedWhatsAppNumber ?? '',
      location: location.trim().slice(0, 100),
      service_areas: splitList(serviceAreasText, 20),
      product_categories: splitList(categoriesText, 20),
    };

    setIsSaving(true);
    setErrorCode(null);
    try {
      if (shop) await updateOwnerShop(user.id, shop.id, input);
      else await createOwnerShop(user.id, input);
      router.replace('/owner/online' as Href);
    } catch (error) {
      setErrorCode(shopOwnerErrorCode(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader
        title="ملف المحل المتصل"
        subtitle="أضف معلومات محلك ومناطق خدمته حتى توصلك الطلبات المناسبة."
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {isAuthLoading || isLoading ? (
          <SurfaceCard style={styles.stateCard}>
            <ActivityIndicator color={DALLNI_COLORS.green} />
            <Text style={styles.stateText}>عم نحمّل ملف المحل…</Text>
          </SurfaceCard>
        ) : !user ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>سجّل دخولك للمتابعة</Text>
            <Text style={styles.stateText}>تعديل الملف مرتبط بالحساب المسجّل.</Text>
            <PrimaryButton label="فتح تسجيل الدخول" onPress={() => router.push('/auth' as Href)} />
          </SurfaceCard>
        ) : errorCode && !shop && !shopName ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>ما قدرنا نحمّل ملف المحل</Text>
            <Text style={styles.stateText}>تأكد من اتصال الإنترنت وحاول مرة تانية.</Text>
            <PrimaryButton
              label="إعادة المحاولة"
              onPress={() => {
                setIsLoading(true);
                setErrorCode(null);
                setRefreshKey((value) => value + 1);
              }}
            />
          </SurfaceCard>
        ) : (
          <>
            <SurfaceCard style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>حالة ملف المحل</Text>
              <Text style={styles.noticeText}>
                الملف الجديد بيضل قيد المراجعة قبل ما يقدر المحل يشوف الطلبات ويرسل عروض. رح تلاقي حالته هون.
              </Text>
              {shop && (
                <Text style={[styles.statusBadge, statusStyle(shop.status)]}>
                  {shopStatusLabel(shop.status)}
                </Text>
              )}
            </SurfaceCard>

            <SurfaceCard style={styles.formCard}>
              <View style={styles.formHeading}>
                <Text style={styles.formTitle}>معلومات المحل</Text>
                <Text style={styles.formSubtitle}>خلّي التفاصيل واضحة لحتى الزبائن يعرفوا إذا بتقدر تخدم منطقتهم.</Text>
              </View>
              <OfferField
                label="اسم المحل *"
                placeholder="مثلاً: محل المدينة"
                value={shopName}
                onChangeText={setShopName}
                maxLength={70}
              />
              <OfferField
                label="واتساب (مطلوب لإرسال العروض)"
                placeholder="مثلاً: +961..."
                value={whatsappNumber}
                onChangeText={setWhatsappNumber}
                keyboardType="phone-pad"
                maxLength={24}
              />
              <Text style={[styles.hint, hasInvalidWhatsAppNumber && styles.errorHint]}>
                {hasInvalidWhatsAppNumber
                  ? 'راجع الرقم ورمز الدولة. مثال: +961 3 123 456.'
                  : 'أضف الرقم مع رمز الدولة. ما بيظهر للزبون قبل ما يختار عرضك.'}
              </Text>
              <OfferField
                label="موقع المحل"
                placeholder="مثلاً: بيروت، الحمرا"
                value={location}
                onChangeText={setLocation}
                maxLength={100}
              />
              <OfferField
                label="مناطق الخدمة"
                placeholder="بيروت، جونية، المتن"
                value={serviceAreasText}
                onChangeText={setServiceAreasText}
                multiline
                maxLength={300}
              />
              <Text style={styles.hint}>اكتب كل منطقة وافصل بينها بفاصلة، مثل بيروت، جونية، المتن.</Text>
              <OfferField
                label="فئات المنتجات"
                placeholder="إلكترونيات، أثاث، رياضة"
                value={categoriesText}
                onChangeText={setCategoriesText}
                multiline
                maxLength={300}
              />
              <Text style={styles.hint}>افصل الفئات بفاصلة، واكتبها مثل الفئات الظاهرة بطلبات الزبائن.</Text>

              {errorCode && (
                <Text style={styles.errorText}>ما قدرنا نحفظ ملف المحل. تحقق من اتصال الإنترنت وحاول مرة تانية.</Text>
              )}
              <PrimaryButton
                disabled={!canSave}
                label={isSaving ? 'عم نحفظ…' : shop ? 'حفظ التعديلات' : 'إنشاء ملف المحل'}
                onPress={() => void saveProfile()}
              />
              <Text style={styles.footerNote}>
                رقم واتساب ما بيظهر ضمن تفاصيل العرض. بيصير التواصل متاحاً بعد ما يختار الزبون عرضك.
              </Text>
            </SurfaceCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function shopStatusLabel(status: OwnerShopProfile['status']) {
  if (status === 'active') return 'مفعّل';
  if (status === 'suspended') return 'موقوف';
  return 'قيد المراجعة';
}

function statusStyle(status: OwnerShopProfile['status']) {
  if (status === 'active') return styles.statusActive;
  if (status === 'suspended') return styles.statusSuspended;
  return styles.statusPending;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: DALLNI_COLORS.background },
  content: { gap: 12, paddingHorizontal: 20, paddingBottom: 32 },
  stateCard: { alignItems: 'flex-end', gap: 10, padding: 17 },
  stateTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  stateText: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  noticeCard: { alignItems: 'flex-end', gap: 8, padding: 15 },
  noticeTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  noticeText: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statusBadge: {
    borderRadius: 10,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    writingDirection: 'rtl',
  },
  statusActive: { backgroundColor: '#EAF5F0', color: DALLNI_COLORS.greenDark },
  statusPending: { backgroundColor: '#FFF5DF', color: '#775B20' },
  statusSuspended: { backgroundColor: '#FFF0EE', color: '#9B3830' },
  formCard: { gap: 13, padding: 16 },
  formHeading: { alignItems: 'flex-end', gap: 4, marginBottom: 2 },
  formTitle: { color: DALLNI_COLORS.ink, fontSize: 15, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  formSubtitle: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  hint: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: -8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  errorHint: { color: '#A3493C' },
  errorText: {
    color: '#A3493C',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  footerNote: {
    color: DALLNI_COLORS.muted,
    fontSize: 9,
    lineHeight: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
