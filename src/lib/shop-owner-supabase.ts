import { supabase } from '@/lib/supabase';
import type { OrderStage } from '@/context/demo-session';

const REQUEST_IMAGE_BUCKET = 'request-images';
const SIGNED_IMAGE_URL_SECONDS = 300;

const SHOP_COLUMNS =
  'id,owner_user_id,shop_name,whatsapp_number,location,service_areas,product_categories,status,created_at';
const REQUEST_COLUMNS =
  'id,title,details,category,requested_area,image_path,status,published_at,created_at';
const OFFER_COLUMNS =
  'id,request_id,shop_id,item_name,price_amount,currency_code,delivery_note,shop_name_snapshot,shop_location_snapshot,created_at';
const ORDER_COLUMNS = 'id,request_id,offer_id,shop_id,stage,created_at,updated_at';
const ORDER_STAGES: OrderStage[] = ['confirmed', 'preparing', 'ready', 'completed'];

export type ShopStatus = 'pending' | 'active' | 'suspended';

export type OwnerShopProfile = {
  id: string;
  owner_user_id: string;
  shop_name: string;
  whatsapp_number: string;
  location: string;
  service_areas: string[];
  product_categories: string[];
  status: ShopStatus;
  created_at: string;
};

export type OwnerShopProfileInput = {
  shop_name: string;
  whatsapp_number: string;
  location: string;
  service_areas: string[];
  product_categories: string[];
};

export type ShopInboxRequest = {
  id: string;
  title: string;
  details: string;
  category: string;
  requested_area: string;
  image_path: string | null;
  status: 'draft' | 'open' | 'closed' | 'cancelled';
  published_at: string | null;
  created_at: string;
  image_url: string | null;
};

export type ShopOffer = {
  id: string;
  request_id: string;
  shop_id: string;
  item_name: string;
  price_amount: number;
  currency_code: 'USD' | 'LBP';
  delivery_note: string;
  shop_name_snapshot: string;
  shop_location_snapshot: string;
  created_at: string;
};

export type ShopOwnerOrder = {
  id: string;
  request_id: string;
  offer_id: string;
  shop_id: string;
  stage: OrderStage;
  created_at: string;
  updated_at: string;
};

export type ShopOwnerOrderSummary = ShopOwnerOrder & {
  request_title: string;
  request_category: string;
  requested_area: string;
  item_name: string;
  price_amount: number;
  currency_code: 'USD' | 'LBP';
  delivery_note: string;
};

export type ShopOwnerRating = {
  id: string;
  order_id: string;
  shop_id: string;
  stars: number;
  comment: string;
  created_at: string;
};

type ShopCustomerContact = {
  order_id: string;
  whatsapp_number: string;
};

function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  return supabase;
}

function errorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

export function shopOwnerErrorCode(error: unknown) {
  return errorCode(error) ?? 'UNKNOWN';
}

async function createAuthorizedImageUrl(imagePath: string | null) {
  if (!imagePath) return null;

  const { data, error } = await requireSupabase()
    .storage
    .from(REQUEST_IMAGE_BUCKET)
    .createSignedUrl(imagePath, SIGNED_IMAGE_URL_SECONDS);

  if (error) return null;
  return data.signedUrl;
}

export async function loadOwnerShop(ownerUserId: string) {
  const { data, error } = await requireSupabase()
    .from('shops')
    .select(SHOP_COLUMNS)
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();

  if (error) throw error;
  return (data as OwnerShopProfile | null) ?? null;
}

export async function createOwnerShop(
  ownerUserId: string,
  profile: OwnerShopProfileInput,
) {
  const { data, error } = await requireSupabase()
    .from('shops')
    .insert({
      owner_user_id: ownerUserId,
      shop_name: profile.shop_name,
      whatsapp_number: profile.whatsapp_number,
      location: profile.location,
      service_areas: profile.service_areas,
      product_categories: profile.product_categories,
    })
    .select(SHOP_COLUMNS)
    .single();

  if (error) throw error;
  return data as OwnerShopProfile;
}

export async function updateOwnerShop(
  ownerUserId: string,
  shopId: string,
  profile: OwnerShopProfileInput,
) {
  const { data, error } = await requireSupabase()
    .from('shops')
    .update({
      shop_name: profile.shop_name,
      whatsapp_number: profile.whatsapp_number,
      location: profile.location,
      service_areas: profile.service_areas,
      product_categories: profile.product_categories,
    })
    .eq('id', shopId)
    .eq('owner_user_id', ownerUserId)
    .select(SHOP_COLUMNS)
    .single();

  if (error) throw error;
  return data as OwnerShopProfile;
}

export async function loadOwnerInboxRequests(): Promise<ShopInboxRequest[]> {
  const { data, error } = await requireSupabase()
    .from('requests')
    .select(REQUEST_COLUMNS)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;

  const rows = (data ?? []) as Omit<ShopInboxRequest, 'image_url'>[];
  return Promise.all(
    rows.map(async (request) => ({
      ...request,
      image_url: await createAuthorizedImageUrl(request.image_path),
    })),
  );
}

export async function loadOwnerRequest(requestId: string) {
  const { data, error } = await requireSupabase()
    .from('requests')
    .select(REQUEST_COLUMNS)
    .eq('id', requestId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const request = data as Omit<ShopInboxRequest, 'image_url'>;
  return {
    ...request,
    image_url: await createAuthorizedImageUrl(request.image_path),
  } satisfies ShopInboxRequest;
}

export async function loadOwnerOffers(requestId: string, shopId: string) {
  const { data, error } = await requireSupabase()
    .from('offers')
    .select(OFFER_COLUMNS)
    .eq('request_id', requestId)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ShopOffer[];
}

export async function loadOwnerOrder(requestId: string, shopId: string) {
  const { data, error } = await requireSupabase()
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('request_id', requestId)
    .eq('shop_id', shopId)
    .maybeSingle();

  if (error) throw error;
  return (data as ShopOwnerOrder | null) ?? null;
}

export async function loadOwnerCustomerWhatsApp(orderId: string) {
  const { data, error } = await requireSupabase()
    .from('order_customer_contacts')
    .select('order_id,whatsapp_number')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  return (data as ShopCustomerContact | null)?.whatsapp_number ?? null;
}

export async function loadOwnerOrders(shopId: string): Promise<ShopOwnerOrderSummary[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('shop_id', shopId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  const orders = (data ?? []) as ShopOwnerOrder[];
  if (orders.length === 0) return [];

  const requestIds = Array.from(new Set(orders.map((order) => order.request_id)));
  const offerIds = Array.from(new Set(orders.map((order) => order.offer_id)));
  const [requestResult, offerResult] = await Promise.all([
    client
      .from('requests')
      .select('id,title,category,requested_area')
      .in('id', requestIds),
    client
      .from('offers')
      .select('id,item_name,price_amount,currency_code,delivery_note')
      .eq('shop_id', shopId)
      .in('id', offerIds),
  ]);

  if (requestResult.error) throw requestResult.error;
  if (offerResult.error) throw offerResult.error;

  const requestsById = new Map(
    (requestResult.data ?? []).map((request) => [request.id, request]),
  );
  const offersById = new Map(
    (offerResult.data ?? []).map((offer) => [offer.id, offer]),
  );

  return orders.map((order) => {
    const request = requestsById.get(order.request_id);
    const offer = offersById.get(order.offer_id);
    return {
      ...order,
      request_title: request?.title ?? 'طلب',
      request_category: request?.category ?? '',
      requested_area: request?.requested_area ?? '',
      item_name: offer?.item_name ?? '',
      price_amount: offer?.price_amount ?? 0,
      currency_code: offer?.currency_code === 'LBP' ? 'LBP' : 'USD',
      delivery_note: offer?.delivery_note ?? '',
    };
  });
}

export async function advanceOwnerOrderStage(orderId: string, nextStage: OrderStage) {
  const { data, error } = await requireSupabase().rpc('dallni_advance_order_stage', {
    p_order_id: orderId,
    p_next_stage: nextStage,
  });

  if (error) throw error;
  if (typeof data !== 'string' || !ORDER_STAGES.includes(data as OrderStage)) {
    throw new Error('INVALID_ORDER_STAGE_RESPONSE');
  }
  return data as OrderStage;
}

export async function loadOwnerRatings(shopId: string): Promise<ShopOwnerRating[]> {
  const { data, error } = await requireSupabase()
    .from('ratings')
    .select('id,order_id,shop_id,stars,comment,created_at')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as ShopOwnerRating[];
}

export async function createOwnerOffer(input: {
  requestId: string;
  shopId: string;
  itemName: string;
  priceAmount: number;
  currencyCode: 'USD' | 'LBP';
  deliveryNote: string;
}) {
  const { data, error } = await requireSupabase()
    .from('offers')
    .insert({
      request_id: input.requestId,
      shop_id: input.shopId,
      item_name: input.itemName,
      price_amount: input.priceAmount,
      currency_code: input.currencyCode,
      delivery_note: input.deliveryNote,
    })
    .select(OFFER_COLUMNS)
    .single();

  if (error) throw error;
  return data as ShopOffer;
}
