import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { FavoriteButton } from '@/components/dallni/favorite-button';
import { DALLNI_COLORS, SurfaceCard } from '@/components/dallni/flow-ui';
import type { CatalogProduct } from '@/lib/product-catalog-supabase';

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function ProductCard({
  product,
  onPress,
  onShopPress,
}: {
  product: CatalogProduct;
  onPress?: () => void;
  onShopPress?: () => void;
}) {
  const area = [...new Set([product.shop_location, ...product.service_areas].map((item) => item.trim()).filter(Boolean))]
    .join('، ');
  const featuredLabel = product.featured_tier === 'vvip'
    ? 'مميّز VVIP'
    : product.featured_tier === 'vip'
      ? 'مميّز VIP'
      : null;

  const content = (
    <SurfaceCard style={styles.card}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `تفاصيل ${product.name}، ${formatPrice(product.price_amount)} ${product.currency_code}` : undefined}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.productContent, pressed && onPress && styles.pressed]}>
        <View style={styles.copy}>
          <View style={styles.topLine}>
            <Text numberOfLines={1} style={styles.name}>{product.name}</Text>
            {featuredLabel ? <Text style={styles.featured}>{featuredLabel}</Text> : null}
          </View>
          <Text style={styles.price}>{formatPrice(product.price_amount)} {product.currency_code}</Text>
          <Text style={styles.category}>{product.category}</Text>
          {area ? <Text numberOfLines={2} style={styles.area}>{area}</Text> : null}
        </View>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} resizeMode="cover" style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderIcon}>صورة</Text>
          </View>
        )}
      </Pressable>
      <View style={styles.actionRow}>
        {onShopPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`فتح ملف محل ${product.shop_name}`}
            onPress={onShopPress}
            style={({ pressed }) => [styles.shopLink, pressed && styles.shopLinkPressed]}>
            <Text style={styles.shopLinkArrow}>←</Text>
            <Text style={styles.shopName}>{product.shop_name}</Text>
            <Text style={styles.shopLinkHint}>من المحل</Text>
          </Pressable>
        ) : (
          <View style={styles.shopLinkStatic}>
            <Text style={styles.shopName}>{product.shop_name}</Text>
            <Text style={styles.shopLinkHint}>من المحل</Text>
          </View>
        )}
        <FavoriteButton itemId={product.id} itemType="product" />
      </View>
    </SurfaceCard>
  );

  return content;
}

const styles = StyleSheet.create({
  card: { gap: 9, padding: 11 },
  productContent: { alignItems: 'center', flexDirection: 'row-reverse', gap: 12 },
  actionRow: { alignItems: 'center', flexDirection: 'row-reverse', gap: 8 },
  copy: { alignItems: 'flex-end', flex: 1, gap: 5 },
  topLine: { alignItems: 'center', flexDirection: 'row-reverse', gap: 6, width: '100%' },
  name: { color: DALLNI_COLORS.ink, flex: 1, fontSize: 14, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  featured: { backgroundColor: '#FFF4D9', borderRadius: 8, color: '#8A5A00', fontSize: 9, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4 },
  price: { color: DALLNI_COLORS.green, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  metaLine: { alignItems: 'center', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  category: { backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 8, color: DALLNI_COLORS.greenDark, fontSize: 9, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, writingDirection: 'rtl' },
  shopName: { color: DALLNI_COLORS.greenDark, flexShrink: 1, fontSize: 10, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  shopLink: { alignItems: 'center', backgroundColor: '#F7FAF8', borderRadius: 9, flex: 1, flexDirection: 'row-reverse', gap: 6, minHeight: 38, paddingHorizontal: 9 },
  shopLinkStatic: { alignItems: 'center', flex: 1, flexDirection: 'row-reverse', gap: 6, minHeight: 28, paddingHorizontal: 4 },
  shopLinkHint: { color: DALLNI_COLORS.muted, fontSize: 9, writingDirection: 'rtl' },
  shopLinkArrow: { color: DALLNI_COLORS.green, fontSize: 14 },
  area: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 15, textAlign: 'right', writingDirection: 'rtl' },
  image: { backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 13, height: 100, width: 100 },
  imagePlaceholder: { alignItems: 'center', backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 13, height: 100, justifyContent: 'center', width: 100 },
  placeholderIcon: { color: DALLNI_COLORS.greenDark, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  pressed: { opacity: 0.85 },
  shopLinkPressed: { opacity: 0.75 },
});
