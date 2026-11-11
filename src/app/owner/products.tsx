import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DALLNI_COLORS, FlowHeader, PrimaryButton, SurfaceCard } from '@/components/dallni/flow-ui';
import { useSupabaseAuth } from '@/context/supabase-auth';
import { loadOwnerShop, shopOwnerErrorCode, type OwnerShopProfile } from '@/lib/shop-owner-supabase';
import {
  archiveOwnerProduct,
  loadOwnerProducts,
  type ShopProduct,
} from '@/lib/shop-products-supabase';

export default function OwnerProductsScreen() {
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();
  const [shop, setShop] = useState<OwnerShopProfile | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setShop(null);
      setProducts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorCode(null);
    try {
      const ownerShop = await loadOwnerShop(user.id);
      setShop(ownerShop);
      setProducts(ownerShop ? await loadOwnerProducts(ownerShop.id) : []);
    } catch (error) {
      setErrorCode(shopOwnerErrorCode(error));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    if (!isAuthLoading) void load();
  }, [isAuthLoading, load]));

  function confirmArchive(product: ShopProduct) {
    Alert.alert(
      'أرشفة المنتج؟',
      'رح يختفي من كتالوج الزبائن، وبتقدر تعدّله وتنشره من جديد لاحقاً.',
      [
        { text: 'رجوع', style: 'cancel' },
        { text: 'أرشفة', style: 'destructive', onPress: () => void archive(product) },
      ],
    );
  }

  async function archive(product: ShopProduct) {
    if (!shop || busyProductId) return;
    setBusyProductId(product.id);
    setErrorCode(null);
    try {
      await archiveOwnerProduct(shop.id, product.id);
      await load();
    } catch (error) {
      setErrorCode(shopOwnerErrorCode(error));
    } finally {
      setBusyProductId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader title="كتالوج منتجات المحل" subtitle="أضف المنتجات وعدّلها أو أخفِها من كتالوج الزبائن." onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isAuthLoading || isLoading ? (
          <SurfaceCard style={styles.stateCard}><ActivityIndicator color={DALLNI_COLORS.green} /><Text style={styles.stateText}>عم نحمّل المنتجات…</Text></SurfaceCard>
        ) : !user ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>سجّل دخولك للمتابعة</Text>
            <Text style={styles.stateText}>إدارة المنتجات مرتبطة بحساب صاحب المحل.</Text>
            <PrimaryButton label="فتح تسجيل الدخول" onPress={() => router.push('/auth' as Href)} />
          </SurfaceCard>
        ) : !shop ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>ما في ملف محل لهالحساب</Text>
            <Text style={styles.stateText}>أنشئ ملف المحل أولاً. بتقدر تجهّز المنتجات كمسودات قبل تفعيل المحل.</Text>
            <PrimaryButton label="إنشاء ملف المحل" onPress={() => router.push('/owner/online-profile' as Href)} />
          </SurfaceCard>
        ) : (
          <>
            <SurfaceCard style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>{shop.shop_name} · {shopStatusLabel(shop.status)}</Text>
              {shop.status === 'active' ? (
                <Text style={styles.stateText}>المنتجات المنشورة بتظهر للزبائن. مساحة الخدمة بتنأخذ من ملف المحل.</Text>
              ) : (
                <Text style={styles.stateText}>بتقدر تجهّز مسودات؛ نشر المنتجات بيصير بعد تفعيل ملف المحل.</Text>
              )}
              <Text style={styles.areas}>مناطق الخدمة: {shop.service_areas.length ? shop.service_areas.join('، ') : shop.location || 'أضف المناطق من ملف المحل'}</Text>
            </SurfaceCard>

            {errorCode ? <Text style={styles.errorText}>ما قدرنا نحفظ أو نحمّل المنتجات. تأكّد من الاتصال وحاول مرة تانية.</Text> : null}
            <PrimaryButton label="إضافة منتج" onPress={() => router.push('/owner/product/new' as Href)} />
            <Text style={styles.listTitle}>منتجات المحل ({products.length})</Text>
            {products.length === 0 ? (
              <SurfaceCard style={styles.stateCard}><Text style={styles.stateText}>ما أضفت منتجات بعد. أضف أول منتج من الزر فوق.</Text></SurfaceCard>
            ) : products.map((product) => (
              <SurfaceCard key={product.id} style={styles.productCard}>
                {product.image_url ? <Image source={{ uri: product.image_url }} resizeMode="cover" style={styles.image} /> : <View style={styles.imagePlaceholder}><Text style={styles.imagePlaceholderText}>صورة</Text></View>}
                <View style={styles.productCopy}>
                  <View style={styles.productHeading}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={[styles.status, product.status === 'active' ? styles.statusActive : product.status === 'archived' ? styles.statusArchived : styles.statusDraft]}>{productStatusLabel(product.status)}</Text>
                  </View>
                  <Text style={styles.price}>{formatPrice(product.price_amount)} {product.currency_code}</Text>
                  <Text style={styles.category}>{product.category}</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/owner/product/[productId]', params: { productId: product.id } } as Href)} style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
                    <Text style={styles.editText}>تعديل المنتج</Text>
                  </Pressable>
                  {product.status !== 'archived' ? (
                    <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(busyProductId) }} disabled={Boolean(busyProductId)} onPress={() => confirmArchive(product)} style={({ pressed }) => [styles.archiveButton, pressed && styles.pressed]}>
                      <Text style={styles.archiveText}>{busyProductId === product.id ? 'عم تنأرشف…' : 'أرشفة المنتج'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </SurfaceCard>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function shopStatusLabel(status: OwnerShopProfile['status']) {
  if (status === 'active') return 'مفعّل';
  if (status === 'suspended') return 'موقوف';
  return 'قيد المراجعة';
}

function productStatusLabel(status: ShopProduct['status']) {
  if (status === 'active') return 'منشور';
  if (status === 'archived') return 'مؤرشف';
  return 'مسودة';
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: DALLNI_COLORS.background, flex: 1 },
  content: { gap: 12, paddingBottom: 34, paddingHorizontal: 20 },
  stateCard: { alignItems: 'flex-end', gap: 9, padding: 15 },
  stateTitle: { color: DALLNI_COLORS.ink, fontSize: 14, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  stateText: { color: DALLNI_COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
  noticeCard: { alignItems: 'flex-end', gap: 7, padding: 14 },
  noticeTitle: { color: DALLNI_COLORS.greenDark, fontSize: 12, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  areas: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  errorText: { color: '#A43D35', fontSize: 11, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  listTitle: { color: DALLNI_COLORS.ink, fontSize: 15, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  productCard: { alignItems: 'center', flexDirection: 'row-reverse', gap: 11, padding: 11 },
  image: { backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 12, height: 86, width: 86 },
  imagePlaceholder: { alignItems: 'center', backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 12, height: 86, justifyContent: 'center', width: 86 },
  imagePlaceholderText: { color: DALLNI_COLORS.greenDark, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  productCopy: { alignItems: 'flex-end', flex: 1, gap: 5 },
  productHeading: { alignItems: 'center', flexDirection: 'row-reverse', gap: 6 },
  productName: { color: DALLNI_COLORS.ink, flexShrink: 1, fontSize: 12, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  status: { borderRadius: 7, fontSize: 8, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 4, writingDirection: 'rtl' },
  statusActive: { backgroundColor: '#EAF5F0', color: DALLNI_COLORS.greenDark },
  statusArchived: { backgroundColor: '#F1F1F1', color: '#666666' },
  statusDraft: { backgroundColor: '#FFF4D9', color: '#8A5A00' },
  price: { color: DALLNI_COLORS.green, fontSize: 12, fontWeight: '900' },
  category: { color: DALLNI_COLORS.muted, fontSize: 9, writingDirection: 'rtl' },
  editButton: { alignSelf: 'stretch', alignItems: 'center', backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 8, paddingVertical: 7 },
  editText: { color: DALLNI_COLORS.greenDark, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  archiveButton: { alignSelf: 'stretch', alignItems: 'center', borderColor: '#EAD5D3', borderRadius: 8, borderWidth: 1, paddingVertical: 6 },
  archiveText: { color: '#A43D35', fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  pressed: { opacity: 0.8 },
});
