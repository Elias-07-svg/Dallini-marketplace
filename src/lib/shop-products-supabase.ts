import { supabase } from '@/lib/supabase';

const PRODUCT_IMAGE_BUCKET = 'product-images';
const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const SIGNED_PRODUCT_IMAGE_SECONDS = 60 * 60;
const PRODUCT_COLUMNS =
  'id,shop_id,name,description,category,price_amount,currency_code,image_path,status,created_at,updated_at';

export type ShopProductStatus = 'draft' | 'active' | 'archived';

export type ShopProduct = {
  id: string;
  shop_id: string;
  name: string;
  description: string;
  category: string;
  price_amount: number;
  currency_code: 'USD' | 'LBP';
  image_path: string | null;
  image_url: string | null;
  status: ShopProductStatus;
  created_at: string;
  updated_at: string;
};

export type ProductFields = {
  name: string;
  description: string;
  category: string;
  priceAmount: number;
  currencyCode: 'USD' | 'LBP';
};

function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  return supabase;
}

async function withImageUrl(product: Omit<ShopProduct, 'image_url'>): Promise<ShopProduct> {
  if (!product.image_path) return { ...product, image_url: null };

  const { data, error } = await requireSupabase()
    .storage
    .from(PRODUCT_IMAGE_BUCKET)
    .createSignedUrl(product.image_path, SIGNED_PRODUCT_IMAGE_SECONDS);

  return {
    ...product,
    image_url: error ? null : data.signedUrl,
  };
}

export async function loadOwnerProducts(shopId: string) {
  const { data, error } = await requireSupabase()
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return Promise.all(((data ?? []) as Omit<ShopProduct, 'image_url'>[]).map(withImageUrl));
}

export async function loadOwnerProduct(shopId: string, productId: string) {
  const { data, error } = await requireSupabase()
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('shop_id', shopId)
    .eq('id', productId)
    .maybeSingle();

  if (error) throw error;
  return data ? withImageUrl(data as Omit<ShopProduct, 'image_url'>) : null;
}

export async function createOwnerProductDraft(shopId: string, fields: ProductFields) {
  const { data, error } = await requireSupabase()
    .from('products')
    .insert({
      shop_id: shopId,
      name: fields.name,
      description: fields.description,
      category: fields.category,
      price_amount: fields.priceAmount,
      currency_code: fields.currencyCode,
    })
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) throw error;
  return data as Omit<ShopProduct, 'image_url'>;
}

export async function updateOwnerProduct(
  shopId: string,
  productId: string,
  fields: ProductFields & { imagePath: string; status: ShopProductStatus },
) {
  const { data, error } = await requireSupabase()
    .from('products')
    .update({
      name: fields.name,
      description: fields.description,
      category: fields.category,
      price_amount: fields.priceAmount,
      currency_code: fields.currencyCode,
      image_path: fields.imagePath,
      status: fields.status,
    })
    .eq('shop_id', shopId)
    .eq('id', productId)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) throw error;
  return data as Omit<ShopProduct, 'image_url'>;
}

export async function archiveOwnerProduct(shopId: string, productId: string) {
  const { error } = await requireSupabase()
    .from('products')
    .update({ status: 'archived' })
    .eq('shop_id', shopId)
    .eq('id', productId);

  if (error) throw error;
}

export async function uploadOwnerProductImage(
  shopId: string,
  productId: string,
  localUri: string,
) {
  const response = await fetch(localUri);
  if (!response.ok) throw new Error('PRODUCT_IMAGE_READ_FAILED');

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('PRODUCT_IMAGE_READ_FAILED');
  if (bytes.byteLength > PRODUCT_IMAGE_MAX_BYTES) throw new Error('PRODUCT_IMAGE_TOO_LARGE');

  const imagePath = `${shopId}/${productId}/product.jpg`;
  const { error } = await requireSupabase()
    .storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(imagePath, bytes, {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) throw error;
  return imagePath;
}
