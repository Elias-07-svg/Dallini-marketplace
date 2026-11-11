import { supabase } from '@/lib/supabase';

export type PublicShopRatingSummary = {
  shop_id: string;
  average_stars: number | null;
  review_count: number;
};

export type PublicShopRatingSummaries = Record<string, PublicShopRatingSummary>;

type RatingSummaryRow = {
  shop_id: string;
  average_stars: number | string | null;
  review_count: number | string;
};

const MAX_SHOPS_PER_REQUEST = 100;

function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  return supabase;
}

export async function loadPublicShopRatingSummaries(shopIds: string[]): Promise<PublicShopRatingSummaries> {
  const uniqueIds = [...new Set(shopIds.filter(Boolean))];
  const summaries: PublicShopRatingSummaries = {};

  for (let index = 0; index < uniqueIds.length; index += MAX_SHOPS_PER_REQUEST) {
    const batch = uniqueIds.slice(index, index + MAX_SHOPS_PER_REQUEST);
    const { data, error } = await requireSupabase().rpc('dallni_get_public_shop_rating_summaries', {
      p_shop_ids: batch,
    });

    if (error) throw error;

    for (const row of (data ?? []) as RatingSummaryRow[]) {
      summaries[row.shop_id] = {
        shop_id: row.shop_id,
        average_stars: row.average_stars === null ? null : Number(row.average_stars),
        review_count: Number(row.review_count),
      };
    }
  }

  return summaries;
}
