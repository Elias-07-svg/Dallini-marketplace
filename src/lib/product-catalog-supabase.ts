import { supabase } from '@/lib/supabase';

const PRODUCT_IMAGE_BUCKET = 'product-images';
const SIGNED_PRODUCT_IMAGE_SECONDS = 60 * 60;

export type ProductCatalogFilters = {
  search?: string;
  category?: string;
  area?: string;
  currencyCode?: 'USD' | 'LBP' | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  shopId?: string | null;
};

export type CatalogProduct = {
  id: string;
  shop_id: string;
  name: string;
  description: string;
  category: string;
  price_amount: number;
  currency_code: 'USD' | 'LBP';
  image_path: string | null;
  image_url: string | null;
  shop_name: string;
  shop_location: string;
  service_areas: string[];
  featured_tier: 'vip' | 'vvip' | null;
  created_at: string;
};

export type PublicShop = {
  id: string;
  shop_name: string;
  location: string;
  service_areas: string[];
  product_categories: string[];
  active_product_count: number;
  created_at: string;
};

function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  return supabase;
}

async function signedProductImage(imagePath: string | null) {
  if (!imagePath) return null;

  const { data, error } = await requireSupabase()
    .storage
    .from(PRODUCT_IMAGE_BUCKET)
    .createSignedUrl(imagePath, SIGNED_PRODUCT_IMAGE_SECONDS);

  return error ? null : data.signedUrl;
}

export async function loadCatalogProducts(filters: ProductCatalogFilters = {}) {
  const { data, error } = await requireSupabase().rpc('dallni_list_catalog_products', {
    p_search: filters.search?.trim() || null,
    p_category: filters.category || null,
    p_area: filters.area?.trim() || null,
    p_currency_code: filters.currencyCode || null,
    p_min_price: filters.minPrice ?? null,
    p_max_price: filters.maxPrice ?? null,
    p_shop_id: filters.shopId || null,
    p_limit: 60,
    p_offset: 0,
  });

  if (error) throw error;

  const rows = (data ?? []) as Omit<CatalogProduct, 'image_url'>[];
  return Promise.all(rows.map(async (row) => ({
    ...row,
    price_amount: Number(row.price_amount),
    image_url: await signedProductImage(row.image_path),
  } satisfies CatalogProduct)));
}

export async function loadPublicShops(filters: {
  search?: string;
  area?: string;
  category?: string;
} = {}) {
  const { data, error } = await requireSupabase().rpc('dallni_list_public_shops', {
    p_search: filters.search?.trim() || null,
    p_area: filters.area?.trim() || null,
    p_category: filters.category || null,
    p_shop_id: null,
    p_limit: 60,
    p_offset: 0,
  });

  if (error) throw error;
  return (data ?? []) as PublicShop[];
}

export async function loadPublicShop(shopId: string) {
  const { data, error } = await requireSupabase().rpc('dallni_list_public_shops', {
    p_search: null,
    p_area: null,
    p_category: null,
    p_shop_id: shopId,
    p_limit: 1,
    p_offset: 0,
  });

  if (error) throw error;
  return ((data ?? []) as PublicShop[])[0] ?? null;
}
