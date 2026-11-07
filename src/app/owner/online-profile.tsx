import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfferField } from '@/components/dallni/offer-field';
import {
  DALLNI_COLORS,
  FlowHeader,
  PrimaryButton,
  SurfaceCard,
} from '@/components/dallni/flow-ui';
import { useSupabaseAuth } from '@/context/supabase-auth';
import { REQUEST_CATEGORIES } from '@/data/request-categories';
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

function normalizeCategories(categories: string[]) {
  return Array.from(new Set(categories.map((category) => category.trim()).filter(Boolean)));
}

function mergeServiceAreas(existingAreas: string[], additions: string[]) {
  const merged = [...existingAreas];
  for (const area of additions) {
    const cleanArea = area.trim();
    if (cleanArea && !merged.some((existingArea) => existingArea.trim() === cleanArea)) {
      merged.push(cleanArea);
    }
  }
  return merged;
}

export default function ConnectedShopProfileScreen() {
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();
  const [shop, setShop] = useState<OwnerShopProfile | null>(null);
  const [shopName, setShopName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [location, setLocation] = useState('');
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [serviceAreaDraft, setServiceAreaDraft] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
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
      setServiceAreas(result.profile?.service_areas ?? []);
      setServiceAreaDraft('');
      setSelectedCategories(normalizeCategories(result.profile?.product_categories ?? []));
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
  const customCategories = normalizeCategories(selectedCategories).filter(
    (category) => !REQUEST_CATEGORIES.some((catalogCategory) => catalogCategory === category),
  );

  function addServiceAreas() {
    const additions = splitList(serviceAreaDraft, 20);
    if (additions.length === 0 || isSaving) return;

    setServiceAreas((current) => mergeServiceAreas(current, additions));
    setServiceAreaDraft('');
  }

  function removeServiceArea(indexToRemove: number) {
    if (isSaving) return;
    setServiceAreas((current) => current.filter((_, index) => index !== indexToRemove));
  }

  async function saveProfile() {
    if (!user || !canSave) return;

    const areasToSave = mergeServiceAreas(serviceAreas, splitList(serviceAreaDraft, 20));
    setServiceAreas(areasToSave);
    setServiceAreaDraft('');

    const input: OwnerShopProfileInput = {
      shop_name: shopName.trim().slice(0, 70),
      whatsapp_number: normalizedWhatsAppNumber ?? '',
      location: location.trim().slice(0, 100),
      service_areas: areasToSave,
      product_categories: normalizeCategories(selectedCategories),
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
              <View style={styles.serviceAreaField}>
                <Text style={styles.fieldLabel}>مناطق الخدمة</Text>
                <View style={styles.serviceAreaInputRow}>
                  <TextInput
                    accessibilityLabel="منطقة خدمة جديدة"
                    accessibilityHint="اكتب المنطقة واضغط إضافة لتظهر ضمن المناطق المحفوظة."
                    autoCapitalize="sentences"
                    autoCorrect={false}
                    editable={!isSaving}
                    maxLength={300}
                    onChangeText={setServiceAreaDraft}
                    onSubmitEditing={addServiceAreas}
                    placeholder="مثلاً: بيروت، الحمرا"
                    placeholderTextColor="#9AA8A0"
                    returnKeyType="done"
                    style={styles.serviceAreaInput}
                    textAlign="right"
                    value={serviceAreaDraft}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="إضافة منطقة خدمة"
                    accessibilityState={{ disabled: !serviceAreaDraft.trim() || isSaving }}
                    disabled={!serviceAreaDraft.trim() || isSaving}
                    onPress={addServiceAreas}
                    style={({ pressed }) => [
                      styles.addServiceAreaButton,
                      (!serviceAreaDraft.trim() || isSaving) && styles.serviceAreaButtonDisabled,
                      pressed && styles.serviceAreaButtonPressed,
                    ]}>
                    <Text style={styles.addServiceAreaText}>إضافة</Text>
                  </Pressable>
                </View>
                <Text style={styles.hint}>اكتب المنطقة واضغط إضافة. اضغط على المنطقة لإزالتها.</Text>
                {serviceAreas.length > 0 ? (
                  <View style={styles.serviceAreaChips}>
                    {serviceAreas.map((area, index) => (
                      <Pressable
                        key={`${index}:${area}`}
                        accessibilityRole="button"
                        accessibilityLabel={`إزالة منطقة الخدمة ${area}`}
                        accessibilityHint="إزالة هذه المنطقة من قائمة الخدمة."
                        accessibilityState={{ disabled: isSaving }}
                        disabled={isSaving}
                        onPress={() => removeServiceArea(index)}
                        style={({ pressed }) => [
                          styles.serviceAreaChip,
                          pressed && !isSaving && styles.serviceAreaChipPressed,
                        ]}>
                        <Text style={styles.serviceAreaChipText}>{area}</Text>
                        <Text style={styles.serviceAreaChipRemove}>×</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyServiceAreas}>ما أضفت مناطق خدمة بعد.</Text>
                )}
              </View>
              <View style={styles.categoryField}>
                <Text style={styles.fieldLabel}>فئات المنتجات</Text>
                <Text style={styles.hint}>اختار كل الفئات اللي بتوفرها.</Text>
                <View style={styles.categoryChips}>
                  {REQUEST_CATEGORIES.map((category) => {
                    const isSelected = selectedCategories.includes(category);

                    return (
                      <Pressable
                        key={category}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`فئة ${category}`}
                        accessibilityState={{ checked: isSelected, disabled: isSaving }}
                        disabled={isSaving}
                        onPress={() => setSelectedCategories((current) => (
                          current.includes(category)
                            ? current.filter((item) => item !== category)
                            : [...current, category]
                        ))}
                        style={({ pressed }) => [
                          styles.categoryChip,
                          isSelected && styles.categoryChipSelected,
                          pressed && !isSaving && styles.categoryChipPressed,
                        ]}>
                        <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                          {category}
                        </Text>
                        <Text style={[styles.categoryChipMark, isSelected && styles.categoryChipMarkSelected]}>
                          {isSelected ? '✓' : '+'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {customCategories.length > 0 && (
                  <View style={styles.customCategoryNote}>
                    <Text style={styles.customCategoryTitle}>فئات إضافية محفوظة</Text>
                    <Text style={styles.customCategoryText}>
                      {customCategories.join('، ')}
                    </Text>
                    <Text style={styles.customCategoryHint}>
                      رح تضل محفوظة عند تعديل الملف.
                    </Text>
                  </View>
                )}
              </View>

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
  fieldLabel: {
    color: DALLNI_COLORS.ink,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  serviceAreaField: { gap: 8 },
  serviceAreaInputRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 7,
    paddingHorizontal: 6,
  },
  serviceAreaInput: {
    color: DALLNI_COLORS.ink,
    flex: 1,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 8,
    writingDirection: 'rtl',
  },
  addServiceAreaButton: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 9,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 60,
    paddingHorizontal: 9,
  },
  addServiceAreaText: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 10,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  serviceAreaButtonDisabled: { opacity: 0.55 },
  serviceAreaButtonPressed: { opacity: 0.8 },
  serviceAreaChips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceAreaChip: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderColor: '#D9EAE1',
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 7,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 10,
  },
  serviceAreaChipPressed: { opacity: 0.75 },
  serviceAreaChipText: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 11,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  serviceAreaChipRemove: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 17,
  },
  emptyServiceAreas: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  categoryField: { gap: 8 },
  categoryChips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 7,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 11,
  },
  categoryChipSelected: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderColor: DALLNI_COLORS.green,
  },
  categoryChipPressed: {
    opacity: 0.8,
  },
  categoryChipText: {
    color: DALLNI_COLORS.ink,
    fontSize: 11,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  categoryChipTextSelected: {
    color: DALLNI_COLORS.greenDark,
  },
  categoryChipMark: {
    color: DALLNI_COLORS.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  categoryChipMarkSelected: {
    color: DALLNI_COLORS.greenDark,
  },
  customCategoryNote: {
    backgroundColor: '#F7F9F8',
    borderRadius: 11,
    gap: 4,
    padding: 10,
  },
  customCategoryTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  customCategoryText: {
    color: DALLNI_COLORS.ink,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  customCategoryHint: {
    color: DALLNI_COLORS.muted,
    fontSize: 9,
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
