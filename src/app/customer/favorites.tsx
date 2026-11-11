import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FavoriteButton } from '@/components/dallni/favorite-button';
import { DALLNI_COLORS, FlowHeader, PrimaryButton, SurfaceCard } from '@/components/dallni/flow-ui';
import { ProductCard } from '@/components/dallni/product-card';
import { ShopCard } from '@/components/dallni/shop-card';
import { useCustomerFavorites } from '@/context/customer-favorites';
import { useSupabaseAuth } from '@/context/supabase-auth';
import { loadCatalogProduct, loadPublicShop, type CatalogProduct, type PublicShop } from '@/lib/product-catalog-supabase';
import { loadPublicShopRatingSummaries, type PublicShopRatingSummaries } from '@/lib/public-shop-ratings';

async function loadInBatches<Result>(items: string[], loadItem: (id: string) => Promise<Result>, batchSize = 8) {
  const result: Result[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    result.push(...await Promise.all(batch.map(loadItem)));
  }
  return result;
}

export default function CustomerFavoritesScreen() {
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();
  const {
    productIds,
    shopIds,
    refreshFavorites,
  } = useCustomerFavorites();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [shops, setShops] = useState<PublicShop[]>([]);
  const [shopRatingSummaries, setShopRatingSummaries] = useState<PublicShopRatingSummaries>({});
  const [shopRatingError, setShopRatingError] = useState(false);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [savedShopIds, setSavedShopIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadFavorites = useCallback(async () => {
    if (!user) return null;
    const saved = await refreshFavorites();
    const [productRows, shopRows] = await Promise.all([
      loadInBatches(saved.productIds, loadCatalogProduct),
      loadInBatches(saved.shopIds, loadPublicShop),
    ]);
    let ratingSummaries: PublicShopRatingSummaries = {};
    let hasRatingError = false;
    try {
      ratingSummaries = await loadPublicShopRatingSummaries(
        shopRows.flatMap((shop) => shop ? [shop.id] : []),
      );
    } catch {
      hasRatingError = true;
    }

    return {
      saved,
      products: productRows.filter((product): product is CatalogProduct => product !== null),
      shops: shopRows.filter((shop): shop is PublicShop => shop !== null),
      shopRatingSummaries: ratingSummaries,
      shopRatingError: hasRatingError,
    };
  }, [refreshFavorites, user]);

  const loadAndApplyFavorites = useCallback(async (isStillCurrent: () => boolean) => {
    const result = await loadFavorites();
    if (!isStillCurrent() || !result) return;
    setSavedProductIds(result.saved.productIds);
    setSavedShopIds(result.saved.shopIds);
    setProducts(result.products);
    setShops(result.shops);
    setShopRatingSummaries(result.shopRatingSummaries);
    setShopRatingError(result.shopRatingError);
  }, [loadFavorites]);

  useFocusEffect(useCallback(() => {
    let isCurrent = true;
    if (isAuthLoading) return () => { isCurrent = false; };

    setHasError(false);
    setIsLoading(Boolean(user));
    if (!user) return () => { isCurrent = false; };

    void loadAndApplyFavorites(() => isCurrent).catch(() => {
      if (isCurrent) setHasError(true);
    }).finally(() => {
      if (isCurrent) setIsLoading(false);
    });

    return () => { isCurrent = false; };
  }, [isAuthLoading, loadAndApplyFavorites, user]));

  function retryLoad() {
    setHasError(false);
    setIsLoading(true);
    void loadAndApplyFavorites(() => true).catch(() => {
      setHasError(true);
    }).finally(() => {
      setIsLoading(false);
    });
  }

  const visibleProducts = products.filter((product) => productIds.has(product.id));
  const visibleShops = shops.filter((shop) => shopIds.has(shop.id));
  const unavailableProductIds = savedProductIds.filter((id) => productIds.has(id) && !products.some((product) => product.id === id));
  const unavailableShopIds = savedShopIds.filter((id) => shopIds.has(id) && !shops.some((shop) => shop.id === id));
  const hasFavorites = visibleProducts.length + visibleShops.length + unavailableProductIds.length + unavailableShopIds.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader
        title="المفضلة"
        subtitle="منتجات ومحلات حفظتها بحسابك، وبتتزامن على أجهزتك."
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isAuthLoading ? (
          <SurfaceCard style={styles.stateCard}><ActivityIndicator color={DALLNI_COLORS.green} /><Text style={styles.stateText}>عم نتحقّق من حسابك…</Text></SurfaceCard>
        ) : !user ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>سجّل دخولك لمزامنة المفضلة</Text>
            <Text style={styles.stateText}>المفضلة بتنحفظ بحسابك لتشوفها من أجهزتك. التصفّح والتجربة بدون تسجيل دخول بيضلّوا متاحين.</Text>
            <PrimaryButton label="تسجيل الدخول" onPress={() => router.push('/auth' as Href)} />
          </SurfaceCard>
        ) : isLoading ? (
          <SurfaceCard style={styles.stateCard}><ActivityIndicator color={DALLNI_COLORS.green} /><Text style={styles.stateText}>عم نحمّل المفضلة…</Text></SurfaceCard>
        ) : hasError ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>ما قدرنا نحمّل المفضلة</Text>
            <Text style={styles.stateText}>تأكّد من الاتصال وحاول مرة تانية.</Text>
            <PrimaryButton label="إعادة المحاولة" onPress={retryLoad} />
          </SurfaceCard>
        ) : !hasFavorites ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>لسّه ما حفظت شي</Text>
            <Text style={styles.stateText}>اضغط على القلب ببطاقة منتج أو محل حتى ترجعله بسرعة.</Text>
            <PrimaryButton label="استكشف المنتجات والمحلات" onPress={() => router.push('/explore')} />
          </SurfaceCard>
        ) : (
          <>
            <SurfaceCard style={styles.syncNote}>
              <Text style={styles.syncText}>المفضلة مرتبطة بحسابك، مش بالجهاز. التفاصيل بتنعرض فقط إذا المنتج أو المحل بعده متاح.</Text>
            </SurfaceCard>

            {visibleProducts.length || unavailableProductIds.length ? (
              <>
                <Text style={styles.sectionTitle}>المنتجات ({visibleProducts.length})</Text>
                {visibleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onPress={() => router.push({ pathname: '/product/[productId]', params: { productId: product.id } } as Href)}
                    onShopPress={() => router.push({ pathname: '/shop/[shopId]', params: { shopId: product.shop_id } } as Href)}
                  />
                ))}
                {unavailableProductIds.map((id) => (
                  <UnavailableFavorite key={id} label="هالمنتج ما عاد متاح" itemId={id} itemType="product" />
                ))}
              </>
            ) : null}

            {visibleShops.length || unavailableShopIds.length ? (
              <>
                <Text style={styles.sectionTitle}>المحلات ({visibleShops.length})</Text>
                {visibleShops.map((shop) => (
                  <ShopCard
                    key={shop.id}
                    shop={shop}
                    ratingSummary={shopRatingSummaries[shop.id] ?? null}
                    ratingError={shopRatingError}
                    onPress={() => router.push({ pathname: '/shop/[shopId]', params: { shopId: shop.id } } as Href)}
                  />
                ))}
                {unavailableShopIds.map((id) => (
                  <UnavailableFavorite key={id} label="هالمحل ما عاد متاح" itemId={id} itemType="shop" />
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function UnavailableFavorite({ label, itemId, itemType }: { label: string; itemId: string; itemType: 'product' | 'shop' }) {
  return (
    <SurfaceCard style={styles.unavailableCard}>
      <View style={styles.unavailableCopy}>
        <Text style={styles.unavailableTitle}>{label}</Text>
        <Text style={styles.stateText}>ما فينا نعرض تفاصيله حالياً. فيك تشيله من المفضلة.</Text>
      </View>
      <FavoriteButton itemId={itemId} itemType={itemType} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: DALLNI_COLORS.background, flex: 1 },
  content: { gap: 12, paddingBottom: 34, paddingHorizontal: 20 },
  stateCard: { alignItems: 'flex-end', gap: 10, padding: 16 },
  stateTitle: { color: DALLNI_COLORS.ink, fontSize: 14, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  stateText: { color: DALLNI_COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
  syncNote: { backgroundColor: DALLNI_COLORS.greenLight, padding: 12 },
  syncText: { color: DALLNI_COLORS.greenDark, fontSize: 10, lineHeight: 16, textAlign: 'right', writingDirection: 'rtl' },
  sectionTitle: { color: DALLNI_COLORS.ink, fontSize: 15, fontWeight: '900', marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  unavailableCard: { alignItems: 'center', flexDirection: 'row-reverse', gap: 10, padding: 12 },
  unavailableCopy: { alignItems: 'flex-end', flex: 1, gap: 4 },
  unavailableTitle: { color: DALLNI_COLORS.ink, fontSize: 11, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
});
