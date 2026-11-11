import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DALLNI_COLORS, FlowHeader, PrimaryButton, SurfaceCard } from '@/components/dallni/flow-ui';
import { FavoriteButton } from '@/components/dallni/favorite-button';
import { useCustomerFavorites } from '@/context/customer-favorites';
import { loadCatalogProduct, type CatalogProduct } from '@/lib/product-catalog-supabase';

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export default function ProductDetailScreen() {
  const { refreshFavorites } = useCustomerFavorites();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useFocusEffect(useCallback(() => {
    let isCurrent = true;
    void refreshFavorites().catch(() => undefined);
    setIsLoading(true);
    setHasError(false);

    if (!productId) {
      setProduct(null);
      setIsLoading(false);
      return () => { isCurrent = false; };
    }

    void loadCatalogProduct(productId).then((visibleProduct) => {
      if (isCurrent) setProduct(visibleProduct);
    }).catch(() => {
      if (isCurrent) setHasError(true);
    }).finally(() => {
      if (isCurrent) setIsLoading(false);
    });

    return () => { isCurrent = false; };
  }, [productId, refreshFavorites]));

  const areas = product
    ? [...new Set([product.shop_location, ...product.service_areas].map((area) => area.trim()).filter(Boolean))]
    : [];
  const featuredLabel = product?.featured_tier === 'vvip'
    ? 'مميّز VVIP'
    : product?.featured_tier === 'vip'
      ? 'مميّز VIP'
      : null;

  function openShopProfile() {
    if (!product) return;
    router.push({ pathname: '/shop/[shopId]', params: { shopId: product.shop_id } } as Href);
  }

  function startRequest() {
    if (!product) return;
    router.push({
      pathname: '/request',
      params: {
        prompt: `بدّي ${product.name}`,
        category: product.category,
      },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader
        title={product?.name ?? 'تفاصيل المنتج'}
        subtitle="معلومات المنتج من المحل المُعلن."
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <SurfaceCard style={styles.stateCard}>
            <ActivityIndicator color={DALLNI_COLORS.green} />
            <Text style={styles.stateText}>عم نتحقّق من توفر المنتج ونحمّل تفاصيله…</Text>
          </SurfaceCard>
        ) : hasError ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>ما قدرنا نحمّل تفاصيل المنتج</Text>
            <Text style={styles.stateText}>تأكّد من الاتصال وحاول مرة تانية.</Text>
          </SurfaceCard>
        ) : !product ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>المنتج مش متاح حالياً</Text>
            <Text style={styles.stateText}>يمكن المحل أخفى المنتج أو ملفه مش مفعّل.</Text>
          </SurfaceCard>
        ) : (
          <>
            <SurfaceCard style={styles.photoCard}>
              {product.image_url ? (
                <Image
                  accessibilityLabel={`صورة ${product.name}`}
                  source={{ uri: product.image_url }}
                  resizeMode="cover"
                  style={styles.photo}
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.placeholderText}>الصورة مش متاحة حالياً</Text>
                </View>
              )}
              <View style={styles.photoActions}>
                {featuredLabel ? <Text style={styles.featured}>{featuredLabel}</Text> : <View />}
                <FavoriteButton itemId={product.id} itemType="product" size="large" />
              </View>
            </SurfaceCard>

            <SurfaceCard style={styles.detailsCard}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.price}>{formatPrice(product.price_amount)} {product.currency_code}</Text>
              <View style={styles.categoryChip}><Text style={styles.categoryText}>{product.category}</Text></View>
              <Text style={styles.fieldLabel}>الوصف</Text>
              <Text style={styles.description}>{product.description.trim() || 'ما في وصف إضافي للمنتج.'}</Text>
              <Text style={styles.fieldLabel}>المنطقة</Text>
              <Text style={styles.description}>{areas.length ? areas.join('، ') : 'الموقع غير محدد'}</Text>
            </SurfaceCard>

            <Pressable accessibilityRole="button" accessibilityLabel={`فتح ملف محل ${product.shop_name}`} onPress={openShopProfile} style={({ pressed }) => [styles.shopCard, pressed && styles.pressed]}>
              <SurfaceCard style={styles.shopCardContent}>
                <View style={styles.shopArrow}><Text style={styles.arrowText}>←</Text></View>
                <View style={styles.shopCopy}>
                  <Text style={styles.shopHint}>المنتج من محل</Text>
                  <Text style={styles.shopName}>{product.shop_name}</Text>
                  {product.shop_location ? <Text style={styles.shopLocation}>{product.shop_location}</Text> : null}
                </View>
              </SurfaceCard>
            </Pressable>

            <View style={styles.requestAction}>
              <PrimaryButton label="اطلب هالمنتج" onPress={startRequest} />
              <Text style={styles.requestHint}>رح نجهّز طلب باسم المنتج وفئته. فيك تعدّل التفاصيل قبل المراجعة والنشر.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: DALLNI_COLORS.background, flex: 1 },
  content: { gap: 12, paddingBottom: 34, paddingHorizontal: 20 },
  stateCard: { alignItems: 'flex-end', gap: 9, padding: 16 },
  stateTitle: { color: DALLNI_COLORS.ink, fontSize: 14, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  stateText: { color: DALLNI_COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
  photoCard: { alignItems: 'center', gap: 10, padding: 12 },
  photo: { backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 15, height: 300, width: '100%' },
  photoPlaceholder: { alignItems: 'center', backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 15, height: 220, justifyContent: 'center', width: '100%' },
  placeholderText: { color: DALLNI_COLORS.muted, fontSize: 11, writingDirection: 'rtl' },
  featured: { alignSelf: 'flex-end', backgroundColor: '#FFF4D9', borderRadius: 9, color: '#8A5A00', fontSize: 10, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6 },
  photoActions: { alignItems: 'center', alignSelf: 'stretch', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  detailsCard: { alignItems: 'flex-end', gap: 10, padding: 15 },
  productName: { color: DALLNI_COLORS.ink, fontSize: 21, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  price: { color: DALLNI_COLORS.green, fontSize: 19, fontWeight: '900' },
  categoryChip: { alignSelf: 'flex-end', backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  categoryText: { color: DALLNI_COLORS.greenDark, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  fieldLabel: { color: DALLNI_COLORS.ink, fontSize: 11, fontWeight: '900', writingDirection: 'rtl' },
  description: { alignSelf: 'stretch', color: DALLNI_COLORS.muted, fontSize: 12, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl' },
  shopCard: { borderRadius: 16 },
  shopCardContent: { alignItems: 'center', flexDirection: 'row-reverse', gap: 10, padding: 14 },
  shopArrow: { alignItems: 'center', backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 11, height: 36, justifyContent: 'center', width: 36 },
  arrowText: { color: DALLNI_COLORS.greenDark, fontSize: 17 },
  shopCopy: { alignItems: 'flex-end', flex: 1, gap: 3 },
  shopHint: { color: DALLNI_COLORS.muted, fontSize: 9, writingDirection: 'rtl' },
  shopName: { color: DALLNI_COLORS.greenDark, fontSize: 13, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  shopLocation: { color: DALLNI_COLORS.muted, fontSize: 10, writingDirection: 'rtl' },
  requestAction: { gap: 8 },
  requestHint: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', writingDirection: 'rtl' },
  pressed: { opacity: 0.8 },
});
