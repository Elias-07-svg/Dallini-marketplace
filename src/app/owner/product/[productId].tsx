import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfferField } from '@/components/dallni/offer-field';
import { DALLNI_COLORS, FlowHeader, PrimaryButton, SurfaceCard } from '@/components/dallni/flow-ui';
import { useSupabaseAuth } from '@/context/supabase-auth';
import { REQUEST_CATEGORIES } from '@/data/request-categories';
import { loadOwnerShop, type OwnerShopProfile } from '@/lib/shop-owner-supabase';
import {
  createOwnerProductDraft,
  loadOwnerProduct,
  updateOwnerProduct,
  uploadOwnerProductImage,
  type ProductFields,
  type ShopProduct,
} from '@/lib/shop-products-supabase';

type Currency = 'USD' | 'LBP';

export default function OwnerProductEditorScreen() {
  const { productId: routeProductId } = useLocalSearchParams<{ productId: string }>();
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();
  const productId = typeof routeProductId === 'string' && routeProductId !== 'new' ? routeProductId : null;
  const [shop, setShop] = useState<OwnerShopProfile | null>(null);
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useFocusEffect(useCallback(() => {
    let isCurrent = true;
    if (isAuthLoading) return () => { isCurrent = false; };

    setIsLoading(true);
    setErrorMessage('');
    void (async () => {
      if (!user) {
        if (isCurrent) setIsLoading(false);
        return;
      }

      try {
        const ownerShop = await loadOwnerShop(user.id);
        if (!isCurrent) return;
        setShop(ownerShop);
        if (!ownerShop) {
          setIsLoading(false);
          return;
        }

        if (productId) {
          const ownerProduct = await loadOwnerProduct(ownerShop.id, productId);
          if (!isCurrent) return;
          if (!ownerProduct) {
            setErrorMessage('ما لقينا هالمنتج ضمن منتجات محلك.');
          } else {
            setProduct(ownerProduct);
            setName(ownerProduct.name);
            setDescription(ownerProduct.description);
            setCategory(ownerProduct.category);
            setPrice(String(ownerProduct.price_amount));
            setCurrency(ownerProduct.currency_code);
            setPhotoUri(null);
          }
        }
      } catch (error) {
        if (isCurrent) setErrorMessage(friendlyError(error));
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    })();

    return () => { isCurrent = false; };
  }, [isAuthLoading, productId, user]));

  const productCategories = shop?.product_categories.length
    ? shop.product_categories
    : [...REQUEST_CATEGORIES];
  const normalizedPrice = Number(price.replace(',', '.'));
  const isValidPrice = Number.isFinite(normalizedPrice)
    && normalizedPrice > 0
    && normalizedPrice <= 9_999_999_999.99;
  const hasPhoto = Boolean(photoUri || product?.image_path);
  const canSave = Boolean(user && shop && name.trim() && category && isValidPrice && hasPhoto)
    && !isSaving && !isPickingPhoto;

  async function choosePhoto() {
    setErrorMessage('');
    setIsPickingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const context = ImageManipulator.ImageManipulator.manipulate(result.assets[0].uri, {
          maxWidth: 1600,
          maxHeight: 1600,
        });
        const rendered = await context.renderAsync();
        const prepared = await rendered.saveAsync({
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        setPhotoUri(prepared.uri);
      }
    } catch {
      setErrorMessage('ما قدرنا نجهّز الصورة. اختار صورة تانية وجرّب من جديد.');
    } finally {
      setIsPickingPhoto(false);
    }
  }

  async function saveProduct() {
    if (!user || !shop || !canSave) return;
    const fields: ProductFields = {
      name: name.trim(),
      description: description.trim(),
      category,
      priceAmount: normalizedPrice,
      currencyCode: currency,
    };
    const nextStatus = shop.status === 'active' ? 'active' : 'draft';
    setIsSaving(true);
    setErrorMessage('');

    try {
      let savedProduct = product;
      if (!savedProduct) {
        const draft = await createOwnerProductDraft(shop.id, fields);
        savedProduct = { ...draft, image_url: null };
        setProduct(savedProduct);
      }

      let imagePath = savedProduct.image_path;
      if (photoUri) {
        imagePath = await uploadOwnerProductImage(shop.id, savedProduct.id, photoUri);
      }
      if (!imagePath) {
        setErrorMessage('اختار صورة للمنتج قبل حفظه.');
        return;
      }

      await updateOwnerProduct(shop.id, savedProduct.id, {
        ...fields,
        imagePath,
        status: nextStatus,
      });
      router.replace('/owner/products' as Href);
    } catch (error) {
      setErrorMessage(friendlyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  const displayedPhoto = photoUri ?? product?.image_url ?? null;
  const fieldLabel = product ? 'تعديل المنتج' : 'إضافة منتج';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader title={fieldLabel} subtitle="أضف صورة واضحة، واختار الفئة والسعر والعملة." onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {isAuthLoading || isLoading ? (
          <SurfaceCard style={styles.stateCard}><ActivityIndicator color={DALLNI_COLORS.green} /><Text style={styles.hint}>عم نحمّل ملف المحل والمنتج…</Text></SurfaceCard>
        ) : !user ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.heading}>سجّل دخولك للمتابعة</Text>
            <PrimaryButton label="فتح تسجيل الدخول" onPress={() => router.push('/auth' as Href)} />
          </SurfaceCard>
        ) : !shop ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.heading}>ما في ملف محل لهالحساب</Text>
            <PrimaryButton label="إنشاء ملف المحل" onPress={() => router.push('/owner/online-profile' as Href)} />
          </SurfaceCard>
        ) : errorMessage.startsWith('ما لقينا') ? (
          <SurfaceCard style={styles.stateCard}><Text style={styles.error}>{errorMessage}</Text></SurfaceCard>
        ) : (
          <>
            <SurfaceCard style={styles.formCard}>
              <Text style={styles.shopName}>{shop.shop_name}</Text>
              <OfferField label="اسم المنتج *" placeholder="مثلاً: سماعات لاسلكية" value={name} onChangeText={setName} maxLength={100} />
              <OfferField label="الوصف" placeholder="تفاصيل مختصرة عن المنتج" value={description} onChangeText={setDescription} multiline maxLength={1200} />

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>الفئة *</Text>
                <View style={styles.chips}>
                  {productCategories.map((item) => {
                    const selected = category === item;
                    return (
                      <Pressable key={item} accessibilityRole="checkbox" accessibilityLabel={`فئة ${item}`} accessibilityState={{ checked: selected }} disabled={isSaving} onPress={() => setCategory(item)} style={[styles.chip, selected && styles.chipSelected]}>
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {shop.product_categories.length === 0 ? <Text style={styles.hint}>عم نعرض فئات دَلّني. اختار فئات المحل من ملفه لتحديد خياراته.</Text> : null}
              </View>

              <OfferField label="السعر *" placeholder="مثلاً: 25" value={price} onChangeText={(value) => setPrice(value.replace(/[^0-9.,]/gu, '').replace(/(\..*)\./gu, '$1'))} keyboardType="decimal-pad" maxLength={15} />
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>العملة *</Text>
                <View style={styles.currencyRow}>
                  <Pressable accessibilityRole="radio" accessibilityState={{ checked: currency === 'LBP' }} onPress={() => setCurrency('LBP')} style={[styles.currencyButton, currency === 'LBP' && styles.currencySelected]}><Text style={[styles.currencyText, currency === 'LBP' && styles.currencyTextSelected]}>LBP</Text></Pressable>
                  <Pressable accessibilityRole="radio" accessibilityState={{ checked: currency === 'USD' }} onPress={() => setCurrency('USD')} style={[styles.currencyButton, currency === 'USD' && styles.currencySelected]}><Text style={[styles.currencyText, currency === 'USD' && styles.currencyTextSelected]}>USD</Text></Pressable>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>صورة المنتج *</Text>
                {displayedPhoto ? <Image source={{ uri: displayedPhoto }} resizeMode="cover" style={styles.photo} /> : <View style={styles.photoPlaceholder}><Text style={styles.photoPlaceholderText}>ما اخترت صورة بعد</Text></View>}
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: isPickingPhoto || isSaving }} disabled={isPickingPhoto || isSaving} onPress={() => void choosePhoto()} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
                  <Text style={styles.photoButtonText}>{isPickingPhoto ? 'عم نجهّز الصورة…' : displayedPhoto ? 'اختيار صورة تانية' : 'اختيار صورة'}</Text>
                </Pressable>
                <Text style={styles.hint}>تنحفظ الصورة بمخزن خاص، وما بتظهر إلا إذا المنتج منشور.</Text>
              </View>

              <View style={styles.areaNotice}>
                <Text style={styles.areaTitle}>مناطق ظهور المنتج</Text>
                <Text style={styles.hint}>{shop.service_areas.length ? shop.service_areas.join('، ') : shop.location || 'أضف مناطق الخدمة من ملف المحل'}</Text>
                <Text style={styles.hint}>المنطقة والفئة بالكتالوج بياخدهم الزبون من ملف المحل والفئة المختارة.</Text>
              </View>

              {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
              <PrimaryButton disabled={!canSave} label={isSaving ? 'عم نحفظ…' : shop.status === 'active' ? 'حفظ ونشر المنتج' : 'حفظ كمسودة'} onPress={() => void saveProduct()} />
              {shop.status !== 'active' ? <Text style={styles.hint}>المنتج بيضل مسودة لحد ما يتفعّل ملف المحل.</Text> : null}
            </SurfaceCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function friendlyError(error: unknown) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (message === 'PRODUCT_IMAGE_TOO_LARGE') return 'حجم الصورة أكبر من ٥ ميغابايت. اختار صورة أصغر.';
  }
  return 'ما قدرنا نحفظ المنتج. تأكّد من الاتصال وصورة المنتج وحاول مرة تانية.';
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: DALLNI_COLORS.background, flex: 1 },
  content: { gap: 12, paddingBottom: 34, paddingHorizontal: 20 },
  stateCard: { alignItems: 'flex-end', gap: 10, padding: 16 },
  heading: { color: DALLNI_COLORS.ink, fontSize: 14, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  formCard: { gap: 15, padding: 15 },
  shopName: { alignSelf: 'flex-end', color: DALLNI_COLORS.greenDark, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
  field: { gap: 8 },
  fieldLabel: { color: DALLNI_COLORS.ink, fontSize: 12, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  chip: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  chipSelected: { backgroundColor: DALLNI_COLORS.greenLight, borderColor: '#A9CFC0' },
  chipText: { color: DALLNI_COLORS.muted, fontSize: 10, fontWeight: '700', writingDirection: 'rtl' },
  chipTextSelected: { color: DALLNI_COLORS.greenDark, fontWeight: '900' },
  currencyRow: { flexDirection: 'row-reverse', gap: 8 },
  currencyButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 10, borderWidth: 1, flex: 1, minHeight: 42, justifyContent: 'center' },
  currencySelected: { backgroundColor: DALLNI_COLORS.greenLight, borderColor: '#A9CFC0' },
  currencyText: { color: DALLNI_COLORS.muted, fontSize: 11, fontWeight: '800' },
  currencyTextSelected: { color: DALLNI_COLORS.greenDark },
  photo: { alignSelf: 'center', backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 16, height: 210, width: 210 },
  photoPlaceholder: { alignItems: 'center', alignSelf: 'center', backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 16, height: 160, justifyContent: 'center', width: '100%' },
  photoPlaceholderText: { color: DALLNI_COLORS.muted, fontSize: 11, writingDirection: 'rtl' },
  photoButton: { alignItems: 'center', backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 10, minHeight: 42, justifyContent: 'center' },
  photoButtonText: { color: DALLNI_COLORS.greenDark, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  hint: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'right', writingDirection: 'rtl' },
  areaNotice: { alignItems: 'flex-end', backgroundColor: '#F7FAF8', borderRadius: 11, gap: 5, padding: 11 },
  areaTitle: { color: DALLNI_COLORS.ink, fontSize: 10, fontWeight: '900', writingDirection: 'rtl' },
  error: { color: '#A43D35', fontSize: 11, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.82 },
});
