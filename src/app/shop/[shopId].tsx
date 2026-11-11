import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DALLNI_COLORS, FlowHeader, SurfaceCard } from '@/components/dallni/flow-ui';
import { ProductCard } from '@/components/dallni/product-card';
import { loadCatalogProducts, loadPublicShop, type CatalogProduct, type PublicShop } from '@/lib/product-catalog-supabase';

export default function PublicShopProfileScreen() {
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useFocusEffect(useCallback(() => {
    let isCurrent = true;
    setIsLoading(true);
    setHasError(false);
    if (!shopId) {
      setShop(null);
      setProducts([]);
      setIsLoading(false);
      return () => { isCurrent = false; };
    }

    void Promise.all([
      loadPublicShop(shopId),
      loadCatalogProducts({ shopId }),
    ]).then(([publicShop, activeProducts]) => {
      if (!isCurrent) return;
      setShop(publicShop);
      setProducts(activeProducts);
    }).catch(() => {
      if (isCurrent) setHasError(true);
    }).finally(() => {
      if (isCurrent) setIsLoading(false);
    });

    return () => { isCurrent = false; };
  }, [shopId]));

  const areas = shop ? [...new Set([shop.location, ...shop.service_areas].map((area) => area.trim()).filter(Boolean))] : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader title={shop?.shop_name ?? 'ملف المحل'} subtitle="شوف معلومات المحل والمنتجات المتاحة." onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <SurfaceCard style={styles.stateCard}><ActivityIndicator color={DALLNI_COLORS.green} /><Text style={styles.stateText}>عم نحمّل ملف المحل…</Text></SurfaceCard>
        ) : hasError ? (
          <SurfaceCard style={styles.stateCard}><Text style={styles.stateText}>ما قدرنا نحمّل ملف المحل. تأكّد من الاتصال وجرّب مرة تانية.</Text></SurfaceCard>
        ) : !shop ? (
          <SurfaceCard style={styles.stateCard}><Text style={styles.stateText}>هالمحل مش متاح حالياً.</Text></SurfaceCard>
        ) : (
          <>
            <SurfaceCard style={styles.profileCard}>
              <Text style={styles.shopName}>{shop.shop_name}</Text>
              <Text style={styles.detail}>الموقع ومناطق الخدمة: {areas.length ? areas.join('، ') : 'غير محددة'}</Text>
              {shop.product_categories.length ? <Text style={styles.detail}>الفئات: {shop.product_categories.join('، ')}</Text> : null}
              <Text style={styles.privacyNote}>معلومات التواصل بتضل خاصة، وبتظهر فقط بعد اختيار عرض على طلب.</Text>
            </SurfaceCard>
            <Text style={styles.sectionTitle}>المنتجات المتاحة ({products.length})</Text>
            {products.length ? products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onPress={() => router.push({ pathname: '/product/[productId]', params: { productId: product.id } } as Href)}
              />
            )) : (
              <SurfaceCard style={styles.stateCard}><Text style={styles.stateText}>ما في منتجات منشورة حالياً.</Text></SurfaceCard>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: DALLNI_COLORS.background, flex: 1 },
  content: { gap: 12, paddingBottom: 32, paddingHorizontal: 20 },
  stateCard: { alignItems: 'flex-end', gap: 8, padding: 15 },
  stateText: { color: DALLNI_COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
  profileCard: { alignItems: 'flex-end', gap: 8, padding: 16 },
  shopName: { color: DALLNI_COLORS.greenDark, fontSize: 18, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  detail: { color: DALLNI_COLORS.ink, fontSize: 11, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
  privacyNote: { backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 9, color: DALLNI_COLORS.greenDark, fontSize: 10, lineHeight: 16, overflow: 'hidden', padding: 9, textAlign: 'right', writingDirection: 'rtl' },
  sectionTitle: { color: DALLNI_COLORS.ink, fontSize: 15, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
});
