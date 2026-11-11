import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DALLNI_COLORS, SurfaceCard } from '@/components/dallni/flow-ui';
import type { PublicShop } from '@/lib/product-catalog-supabase';

export function ShopCard({ shop, onPress }: { shop: PublicShop; onPress: () => void }) {
  const areas = [...new Set([shop.location, ...shop.service_areas].map((item) => item.trim()).filter(Boolean))];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`فتح ملف ${shop.shop_name}`}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      <SurfaceCard style={styles.card}>
        <View style={styles.topLine}>
          <Text style={styles.arrow}>←</Text>
          <View style={styles.copy}>
            <Text style={styles.name}>{shop.shop_name}</Text>
            <Text style={styles.location}>{areas.length ? areas.join('، ') : 'الموقع غير محدد'}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.count}>{shop.active_product_count}</Text>
          </View>
        </View>
        {shop.product_categories.length > 0 ? (
          <Text numberOfLines={2} style={styles.categories}>{shop.product_categories.join('، ')}</Text>
        ) : null}
      </SurfaceCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 9, padding: 14 },
  topLine: { alignItems: 'center', flexDirection: 'row-reverse', gap: 10 },
  arrow: { color: '#9AA8A0', fontSize: 18 },
  copy: { alignItems: 'flex-end', flex: 1, gap: 3 },
  name: { color: DALLNI_COLORS.ink, fontSize: 14, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  location: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'right', writingDirection: 'rtl' },
  badge: { alignItems: 'center', backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 11, height: 34, justifyContent: 'center', minWidth: 34, paddingHorizontal: 6 },
  count: { color: DALLNI_COLORS.greenDark, fontSize: 11, fontWeight: '900' },
  categories: { color: DALLNI_COLORS.green, fontSize: 10, textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.85 },
});
