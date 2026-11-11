import { useFocusEffect, router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
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

import { DALLNI_COLORS, PrimaryButton, SurfaceCard } from '@/components/dallni/flow-ui';
import { ProductCard } from '@/components/dallni/product-card';
import { ShopCard } from '@/components/dallni/shop-card';
import {
  REQUEST_CATEGORIES,
  REQUEST_CATEGORY_ICONS,
  REQUEST_CATEGORY_PROMPTS,
} from '@/data/request-categories';
import {
  loadCatalogProducts,
  loadPublicShops,
  type CatalogProduct,
  type PublicShop,
} from '@/lib/product-catalog-supabase';

type ExploreView = 'products' | 'shops';
type Currency = '' | 'USD' | 'LBP';
type PriceRanges = Record<'USD' | 'LBP', { min: string; max: string }>;
type AppliedFilters = {
  search: string;
  category: string;
  area: string;
  currency: Currency;
  ranges: PriceRanges;
};

const EMPTY_RANGES: PriceRanges = {
  USD: { min: '', max: '' },
  LBP: { min: '', max: '' },
};

export default function ExploreScreen() {
  const [view, setView] = useState<ExploreView>('products');
  const [searchDraft, setSearchDraft] = useState('');
  const [categoryDraft, setCategoryDraft] = useState('');
  const [areaDraft, setAreaDraft] = useState('');
  const [currencyDraft, setCurrencyDraft] = useState<Currency>('');
  const [rangesDraft, setRangesDraft] = useState<PriceRanges>(EMPTY_RANGES);
  const [filters, setFilters] = useState<AppliedFilters>({
    search: '', category: '', area: '', currency: '', ranges: EMPTY_RANGES,
  });
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [shops, setShops] = useState<PublicShop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filterError, setFilterError] = useState('');

  useFocusEffect(useCallback(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError(false);

    const request = view === 'products'
      ? loadCatalogProducts({
          search: filters.search,
          category: filters.category,
          area: filters.area,
          currencyCode: filters.currency || null,
          minPrice: filters.currency ? parseOptionalPrice(filters.ranges[filters.currency].min) : null,
          maxPrice: filters.currency ? parseOptionalPrice(filters.ranges[filters.currency].max) : null,
        })
      : loadPublicShops({ search: filters.search, category: filters.category, area: filters.area });

    void request.then((result) => {
      if (!isCurrent) return;
      if (view === 'products') setProducts(result as CatalogProduct[]);
      else setShops(result as PublicShop[]);
    }).catch(() => {
      if (isCurrent) setError(true);
    }).finally(() => {
      if (isCurrent) setIsLoading(false);
    });

    return () => { isCurrent = false; };
  }, [filters, view]));

  function applyFilters() {
    const selectedRange = currencyDraft ? rangesDraft[currencyDraft] : null;
    const min = selectedRange ? parseOptionalPrice(selectedRange.min) : null;
    const max = selectedRange ? parseOptionalPrice(selectedRange.max) : null;
    const hasPriceValue = Boolean(selectedRange?.min.trim() || selectedRange?.max.trim());

    if (hasPriceValue && !currencyDraft) {
      setFilterError('اختار العملة قبل تحديد مجال السعر.');
      return;
    }
    if ((selectedRange?.min.trim() && min === null) || (selectedRange?.max.trim() && max === null)) {
      setFilterError('اكتب سعراً صحيحاً بالأرقام.');
      return;
    }
    if (min !== null && max !== null && min > max) {
      setFilterError('الحد الأدنى لازم يكون أقل من الحد الأقصى.');
      return;
    }

    setFilterError('');
    setFilters({
      search: searchDraft.trim(),
      category: categoryDraft,
      area: areaDraft.trim(),
      currency: currencyDraft,
      ranges: rangesDraft,
    });
  }

  function updateRange(which: 'min' | 'max', value: string) {
    if (!currencyDraft) return;
    const clean = value.replace(/[^0-9.]/gu, '').replace(/(\..*)\./gu, '$1');
    setRangesDraft((current) => ({
      ...current,
      [currencyDraft]: { ...current[currencyDraft], [which]: clean },
    }));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.brandHeader}>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>دَلّني</Text>
            <Text style={styles.brandSub}>DALLNI</Text>
          </View>
          <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>تسوّق أذكى</Text></View>
        </View>

        <Text style={styles.eyebrow}>اكتشف دَلّني</Text>
        <Text style={styles.title}>منتجات ومحلات قريبة منك</Text>
        <Text style={styles.subtitle}>فتّش بالمنتجات أو تصفّح المحلات. رقم واتساب ما بيظهر بهالكتالوج.</Text>

        <View style={styles.viewSwitch} accessibilityRole="tablist">
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: view === 'shops' }} onPress={() => setView('shops')} style={[styles.viewTab, view === 'shops' && styles.viewTabSelected]}>
            <Text style={[styles.viewTabText, view === 'shops' && styles.viewTabTextSelected]}>المحلات</Text>
          </Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: view === 'products' }} onPress={() => setView('products')} style={[styles.viewTab, view === 'products' && styles.viewTabSelected]}>
            <Text style={[styles.viewTabText, view === 'products' && styles.viewTabTextSelected]}>المنتجات</Text>
          </Pressable>
        </View>

        <SurfaceCard style={styles.filterCard}>
          <TextInput
            accessibilityLabel="ابحث عن منتج أو محل"
            onChangeText={setSearchDraft}
            placeholder={view === 'products' ? 'اسم المنتج أو المحل' : 'اسم المحل'}
            placeholderTextColor="#9AA8A0"
            returnKeyType="search"
            style={styles.searchInput}
            textAlign="right"
            value={searchDraft}
          />
          <Text style={styles.filterLabel}>الفئة</Text>
          <ScrollView horizontal contentContainerStyle={styles.chipRow} showsHorizontalScrollIndicator={false}>
            <FilterChip label="الكل" selected={!categoryDraft} onPress={() => setCategoryDraft('')} />
            {REQUEST_CATEGORIES.map((category) => (
              <FilterChip key={category} label={category} selected={categoryDraft === category} onPress={() => setCategoryDraft((current) => current === category ? '' : category)} />
            ))}
          </ScrollView>
          <TextInput
            accessibilityLabel="منطقة الخدمة"
            onChangeText={setAreaDraft}
            placeholder="المنطقة، مثلاً الحمرا"
            placeholderTextColor="#9AA8A0"
            style={styles.searchInput}
            textAlign="right"
            value={areaDraft}
          />
          {view === 'products' ? (
            <>
              <Text style={styles.filterLabel}>العملة ومجال السعر</Text>
              <View style={styles.currencyRow}>
                <FilterChip label="كل العملات" selected={!currencyDraft} onPress={() => setCurrencyDraft('')} />
                <FilterChip label="USD" selected={currencyDraft === 'USD'} onPress={() => setCurrencyDraft('USD')} />
                <FilterChip label="LBP" selected={currencyDraft === 'LBP'} onPress={() => setCurrencyDraft('LBP')} />
              </View>
              {currencyDraft ? (
                <View style={styles.priceRow}>
                  <TextInput
                    accessibilityLabel={`السعر الأعلى ${currencyDraft}`}
                    keyboardType="decimal-pad"
                    onChangeText={(value) => updateRange('max', value)}
                    placeholder={`أعلى ${currencyDraft}`}
                    placeholderTextColor="#9AA8A0"
                    style={styles.priceInput}
                    textAlign="right"
                    value={rangesDraft[currencyDraft].max}
                  />
                  <TextInput
                    accessibilityLabel={`السعر الأدنى ${currencyDraft}`}
                    keyboardType="decimal-pad"
                    onChangeText={(value) => updateRange('min', value)}
                    placeholder={`أدنى ${currencyDraft}`}
                    placeholderTextColor="#9AA8A0"
                    style={styles.priceInput}
                    textAlign="right"
                    value={rangesDraft[currencyDraft].min}
                  />
                </View>
              ) : null}
            </>
          ) : null}
          {filterError ? <Text style={styles.filterError}>{filterError}</Text> : null}
          <Pressable accessibilityRole="button" onPress={applyFilters} style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}>
            <Text style={styles.searchButtonText}>تطبيق البحث والفلاتر</Text>
          </Pressable>
        </SurfaceCard>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionCount}>{view === 'products' ? products.length : shops.length} نتيجة</Text>
          <Text style={styles.sectionTitle}>{view === 'products' ? 'المنتجات المتاحة' : 'دليل المحلات'}</Text>
        </View>

        {isLoading ? (
          <SurfaceCard style={styles.stateCard}><ActivityIndicator color={DALLNI_COLORS.green} /><Text style={styles.stateText}>عم نحمّل النتائج…</Text></SurfaceCard>
        ) : error ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>ما قدرنا نحمّل النتائج</Text>
            <Text style={styles.stateText}>تأكّد من اتصال الإنترنت وإعداد قاعدة البيانات، وجرّب مرة تانية.</Text>
            <Pressable accessibilityRole="button" onPress={() => setFilters((current) => ({ ...current }))} style={styles.retryButton}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable>
          </SurfaceCard>
        ) : view === 'products' ? (
          products.length ? products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onPress={() => router.push({ pathname: '/product/[productId]', params: { productId: product.id } } as Href)}
              onShopPress={() => router.push({ pathname: '/shop/[shopId]', params: { shopId: product.shop_id } } as Href)}
            />
          )) : <EmptyState text="ما لقينا منتجات بهالفلاتر. جرّب توسّع البحث." />
        ) : (
          shops.length ? shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} onPress={() => router.push({ pathname: '/shop/[shopId]', params: { shopId: shop.id } } as Href)} />
          )) : <EmptyState text="ما لقينا محلات بهالبحث." />
        )}

        <SurfaceCard style={styles.requestCard}>
          <Text style={styles.requestTitle}>ما لقيت اللي بدك ياه؟</Text>
          <Text style={styles.requestText}>اكتب طلبك وخلي المحلات المناسبة تبعتلك عروض.</Text>
          <PrimaryButton label="اكتب طلب جديد" onPress={() => router.push('/request')} />
        </SurfaceCard>

        <Text style={styles.categoryHeading}>أو بلّش طلبك حسب الفئة</Text>
        <View style={styles.categoryGrid}>
          {REQUEST_CATEGORIES.map((category) => (
            <Pressable
              key={category}
              accessibilityRole="button"
              accessibilityLabel={`ابدأ طلباً ضمن فئة ${category}`}
              onPress={() => router.push({ pathname: '/request', params: { prompt: REQUEST_CATEGORY_PROMPTS[category], category } })}
              style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}>
              <Text style={styles.categoryIcon}>{REQUEST_CATEGORY_ICONS[category]}</Text>
              <Text style={styles.categoryName}>{category}</Text>
              <Text style={styles.categoryAction}>ابدأ طلبك ←</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function parseOptionalPrice(value: string) {
  if (!value.trim()) return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.filterChip, selected && styles.filterChipSelected]}>
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({ text }: { text: string }) {
  return <SurfaceCard style={styles.stateCard}><Text style={styles.stateText}>{text}</Text></SurfaceCard>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: DALLNI_COLORS.background, flex: 1 },
  content: { gap: 11, paddingBottom: 34, paddingHorizontal: 18, paddingTop: 14 },
  brandHeader: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 5 },
  brandCopy: { alignItems: 'flex-end' },
  brandName: { color: DALLNI_COLORS.green, fontSize: 24, fontWeight: '900', writingDirection: 'rtl' },
  brandSub: { color: '#8A9992', fontSize: 9, letterSpacing: 2.2 },
  headerBadge: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 11, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  headerBadgeText: { color: DALLNI_COLORS.greenDark, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  eyebrow: { color: DALLNI_COLORS.green, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  title: { color: DALLNI_COLORS.ink, fontSize: 23, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { color: DALLNI_COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
  viewSwitch: { backgroundColor: '#EAF0EC', borderRadius: 13, flexDirection: 'row-reverse', gap: 4, padding: 4 },
  viewTab: { alignItems: 'center', borderRadius: 10, flex: 1, minHeight: 40, justifyContent: 'center' },
  viewTabSelected: { backgroundColor: '#FFFFFF', elevation: 1 },
  viewTabText: { color: DALLNI_COLORS.muted, fontSize: 12, fontWeight: '800', writingDirection: 'rtl' },
  viewTabTextSelected: { color: DALLNI_COLORS.greenDark },
  filterCard: { gap: 10, padding: 13 },
  searchInput: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 11, borderWidth: 1, color: DALLNI_COLORS.ink, fontSize: 12, minHeight: 44, paddingHorizontal: 11, writingDirection: 'rtl' },
  filterLabel: { color: DALLNI_COLORS.ink, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  chipRow: { flexDirection: 'row-reverse', gap: 7, paddingVertical: 1 },
  currencyRow: { alignItems: 'center', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  filterChip: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  filterChipSelected: { backgroundColor: DALLNI_COLORS.greenLight, borderColor: '#A9CFC0' },
  filterChipText: { color: DALLNI_COLORS.muted, fontSize: 10, fontWeight: '700', writingDirection: 'rtl' },
  filterChipTextSelected: { color: DALLNI_COLORS.greenDark, fontWeight: '900' },
  priceRow: { flexDirection: 'row-reverse', gap: 8 },
  priceInput: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 10, borderWidth: 1, color: DALLNI_COLORS.ink, flex: 1, fontSize: 11, minHeight: 42, paddingHorizontal: 10 },
  filterError: { color: '#A43D35', fontSize: 10, textAlign: 'right', writingDirection: 'rtl' },
  searchButton: { alignItems: 'center', backgroundColor: DALLNI_COLORS.green, borderRadius: 11, justifyContent: 'center', minHeight: 42 },
  searchButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', writingDirection: 'rtl' },
  sectionHeading: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 5 },
  sectionTitle: { color: DALLNI_COLORS.ink, fontSize: 15, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  sectionCount: { color: DALLNI_COLORS.muted, fontSize: 10, writingDirection: 'rtl' },
  stateCard: { alignItems: 'flex-end', gap: 9, padding: 16 },
  stateTitle: { color: DALLNI_COLORS.ink, fontSize: 13, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  stateText: { color: DALLNI_COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  retryButton: { alignSelf: 'flex-start', backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  retryText: { color: DALLNI_COLORS.greenDark, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  requestCard: { gap: 8, marginTop: 5, padding: 14 },
  requestTitle: { color: DALLNI_COLORS.ink, fontSize: 14, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  requestText: { color: DALLNI_COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  categoryHeading: { color: DALLNI_COLORS.ink, fontSize: 14, fontWeight: '900', marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  categoryGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9 },
  categoryCard: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 14, borderWidth: 1, minHeight: 96, padding: 10, width: '48.5%' },
  categoryIcon: { fontSize: 20, textAlign: 'right' },
  categoryName: { color: DALLNI_COLORS.ink, fontSize: 11, fontWeight: '800', marginTop: 7, textAlign: 'right', writingDirection: 'rtl' },
  categoryAction: { color: DALLNI_COLORS.green, fontSize: 9, fontWeight: '700', marginTop: 3, textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.8 },
});
