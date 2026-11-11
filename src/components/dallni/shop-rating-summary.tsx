import { StyleSheet, Text } from 'react-native';

import { DALLNI_COLORS } from '@/components/dallni/flow-ui';
import type { PublicShopRatingSummary as RatingSummary } from '@/lib/public-shop-ratings';

export function ShopRatingSummary({
  summary,
  isLoading = false,
  hasError = false,
  compact = false,
}: {
  summary: RatingSummary | null;
  isLoading?: boolean;
  hasError?: boolean;
  compact?: boolean;
}) {
  const formattedAverage = summary?.average_stars == null ? null : summary.average_stars.toFixed(1);
  const hasRatings = Boolean(summary && summary.review_count > 0 && formattedAverage !== null);
  const label = isLoading
    ? 'عم نحمّل التقييمات…'
    : hasError
      ? 'التقييمات مش متاحة هلّق'
      : hasRatings && summary && formattedAverage !== null
        ? `${formattedAverage} ★ · ${summary.review_count} ${summary.review_count === 1 ? 'تقييم' : 'تقييمات'}`
        : 'ما في تقييمات بعد';

  return (
    <Text style={[styles.container, compact && styles.compact, hasRatings && !hasError && styles.rated]}>{label}</Text>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'flex-end', backgroundColor: '#FFF8E8', borderRadius: 9, color: DALLNI_COLORS.muted, fontSize: 10, fontWeight: '700', minHeight: 30, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 7, writingDirection: 'rtl' },
  compact: { alignSelf: 'flex-end', backgroundColor: '#F7F8F5', fontSize: 9, minHeight: 25, paddingHorizontal: 7, paddingVertical: 5 },
  rated: { color: '#815700' },
});
