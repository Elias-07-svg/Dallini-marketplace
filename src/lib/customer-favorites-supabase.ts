import { supabase } from '@/lib/supabase';

export type CustomerFavorites = {
  productIds: string[];
  shopIds: string[];
};

function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  return supabase;
}

export async function loadCustomerFavorites(customerId: string): Promise<CustomerFavorites> {
  const client = requireSupabase();
  const [products, shops] = await Promise.all([
    client
      .from('customer_product_favorites')
      .select('product_id')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    client
      .from('customer_shop_favorites')
      .select('shop_id')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
  ]);

  if (products.error) throw products.error;
  if (shops.error) throw shops.error;

  return {
    productIds: (products.data ?? []).map((row) => row.product_id as string),
    shopIds: (shops.data ?? []).map((row) => row.shop_id as string),
  };
}

export async function addCustomerProductFavorite(customerId: string, productId: string) {
  const { error } = await requireSupabase()
    .from('customer_product_favorites')
    .insert({ customer_id: customerId, product_id: productId });

  if (error && error.code !== '23505') throw error;
}

export async function removeCustomerProductFavorite(customerId: string, productId: string) {
  const { error } = await requireSupabase()
    .from('customer_product_favorites')
    .delete()
    .eq('customer_id', customerId)
    .eq('product_id', productId);

  if (error) throw error;
}

export async function addCustomerShopFavorite(customerId: string, shopId: string) {
  const { error } = await requireSupabase()
    .from('customer_shop_favorites')
    .insert({ customer_id: customerId, shop_id: shopId });

  if (error && error.code !== '23505') throw error;
}

export async function removeCustomerShopFavorite(customerId: string, shopId: string) {
  const { error } = await requireSupabase()
    .from('customer_shop_favorites')
    .delete()
    .eq('customer_id', customerId)
    .eq('shop_id', shopId);

  if (error) throw error;
}
