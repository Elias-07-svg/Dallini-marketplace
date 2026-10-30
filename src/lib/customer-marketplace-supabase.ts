import type { OrderStage } from '@/context/demo-session';
import { supabase } from '@/lib/supabase';
import { normalizeInternationalWhatsAppNumber } from '@/utils/whatsapp';

const REQUEST_IMAGE_BUCKET = 'request-images';
const SIGNED_IMAGE_URL_SECONDS = 300;

type RequestRow = {
  id: string;
  title: string;
  details: string;
  category: string;
  requested_area: string;
  image_path: string | null;
  status: 'draft' | 'open' | 'closed' | 'cancelled';
  published_at: string | null;
  created_at: string;
};

export type CustomerCloudOffer = {
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

type OrderRow = {
  id: string;
  request_id: string;
  offer_id: string;
  shop_id: string;
  stage: OrderStage;
  created_at: string;
  updated_at: string;
};

export type CustomerCloudRating = {
  id: string;
  order_id: string;
  shop_id: string;
  stars: number;
  comment: string;
  created_at: string;
};

type OfferContactRow = {
  offer_id: string;
  whatsapp_number: string;
};

type CustomerOrderContactRow = {
  order_id: string;
  whatsapp_number: string;
};

export type CustomerMarketplaceEntry = {
  request: RequestRow;
  offers: CustomerCloudOffer[];
  order: OrderRow | null;
  rating: CustomerCloudRating | null;
  selectedOffer: CustomerCloudOffer | null;
  selectedOfferWhatsApp: string | null;
  contactReadErrorCode: string | null;
  customerWhatsAppNumber: string | null;
  imageUrl: string | null;
  imageUnavailable: boolean;
};

function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  return supabase;
}

export function customerMarketplaceErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'UNKNOWN';
}

async function createAuthorizedImageUrl(imagePath: string | null) {
  if (!imagePath) return { url: null, unavailable: false };

  try {
    const { data, error } = await requireSupabase()
      .storage
      .from(REQUEST_IMAGE_BUCKET)
      .createSignedUrl(imagePath, SIGNED_IMAGE_URL_SECONDS);

    if (error) return { url: null, unavailable: true };
    return { url: data.signedUrl, unavailable: false };
  } catch {
    return { url: null, unavailable: true };
  }
}

export async function loadCustomerMarketplace(customerId: string) {
  const client = requireSupabase();
  const { data: requestData, error: requestError } = await client
    .from('requests')
    .select('id,title,details,category,requested_area,image_path,status,published_at,created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (requestError) throw requestError;
  const requestRows = (requestData ?? []) as RequestRow[];
  if (requestRows.length === 0) return [];

  const requestIds = requestRows.map((request) => request.id);
  const [offerResult, orderResult] = await Promise.all([
    client
      .from('offers')
      .select('id,request_id,shop_id,item_name,price_amount,currency_code,delivery_note,shop_name_snapshot,shop_location_snapshot,created_at')
      .in('request_id', requestIds)
      .order('created_at', { ascending: false }),
    client
      .from('orders')
      .select('id,request_id,offer_id,shop_id,stage,created_at,updated_at')
      .in('request_id', requestIds),
  ]);

  if (offerResult.error) throw offerResult.error;
  if (orderResult.error) throw orderResult.error;

  const offerRows = (offerResult.data ?? []) as CustomerCloudOffer[];
  const orderRows = (orderResult.data ?? []) as OrderRow[];
  const orderIds = Array.from(new Set(orderRows.map((order) => order.id)));
  const selectedOfferIds = Array.from(new Set(orderRows.map((order) => order.offer_id)));

  let ratingRows: CustomerCloudRating[] = [];
  if (orderIds.length > 0) {
    const { data, error } = await client
      .from('ratings')
      .select('id,order_id,shop_id,stars,comment,created_at')
      .in('order_id', orderIds);

    if (error) throw error;
    ratingRows = (data ?? []) as CustomerCloudRating[];
  }

  let customerContactRows: CustomerOrderContactRow[] = [];
  if (orderIds.length > 0) {
    const { data, error } = await client
      .from('order_customer_contacts')
      .select('order_id,whatsapp_number')
      .in('order_id', orderIds);

    if (error) throw error;
    customerContactRows = (data ?? []) as CustomerOrderContactRow[];
  }

  // A contact read is attempted only for offer IDs returned by the customer's
  // own orders. RLS independently verifies this selection before returning it.
  let contactRows: OfferContactRow[] = [];
  let contactReadErrorCode: string | null = null;
  if (selectedOfferIds.length > 0) {
    try {
      const { data, error } = await client
        .from('offer_contacts')
        .select('offer_id,whatsapp_number')
        .in('offer_id', selectedOfferIds);

      if (error) contactReadErrorCode = customerMarketplaceErrorCode(error);
      else contactRows = (data ?? []) as OfferContactRow[];
    } catch (error) {
      contactReadErrorCode = customerMarketplaceErrorCode(error);
    }
  }

  const offersByRequest = new Map<string, CustomerCloudOffer[]>();
  for (const offer of offerRows) {
    const current = offersByRequest.get(offer.request_id) ?? [];
    current.push(offer);
    offersByRequest.set(offer.request_id, current);
  }

  const ordersByRequest = new Map(orderRows.map((order) => [order.request_id, order]));
  const ratingsByOrder = new Map(ratingRows.map((rating) => [rating.order_id, rating]));
  const contactsByOffer = new Map(
    contactRows.map((contact) => [contact.offer_id, contact.whatsapp_number]),
  );
  const customerContactsByOrder = new Map(
    customerContactRows.map((contact) => [contact.order_id, contact.whatsapp_number]),
  );

  return Promise.all(requestRows.map(async (request) => {
    const order = ordersByRequest.get(request.id) ?? null;
    const offers = offersByRequest.get(request.id) ?? [];
    const selectedOffer = order
      ? offers.find((offer) => offer.id === order.offer_id) ?? null
      : null;
    const image = await createAuthorizedImageUrl(request.image_path);

    return {
      request,
      offers,
      order,
      rating: order ? ratingsByOrder.get(order.id) ?? null : null,
      selectedOffer,
      selectedOfferWhatsApp: order
        ? contactsByOffer.get(order.offer_id) ?? null
        : null,
      contactReadErrorCode: order ? contactReadErrorCode : null,
      customerWhatsAppNumber: order ? customerContactsByOrder.get(order.id) ?? null : null,
      imageUrl: image.url,
      imageUnavailable: image.unavailable,
    } satisfies CustomerMarketplaceEntry;
  }));
}

export async function saveCustomerWhatsAppNumber(input: {
  orderId: string;
  customerId: string;
  whatsappNumber: string;
}) {
  const whatsappNumber = normalizeInternationalWhatsAppNumber(input.whatsappNumber);
  if (!whatsappNumber) throw new Error('INVALID_WHATSAPP_NUMBER');

  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user || authData.user.id !== input.customerId) {
    throw new Error('AUTH_USER_MISMATCH');
  }

  const { data, error } = await client
    .from('order_customer_contacts')
    .upsert({ order_id: input.orderId, whatsapp_number: whatsappNumber }, { onConflict: 'order_id' })
    .select('order_id,whatsapp_number')
    .single();

  if (error) throw error;
  return data as CustomerOrderContactRow;
}

export async function removeCustomerWhatsAppNumber(orderId: string, customerId: string) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user || authData.user.id !== customerId) {
    throw new Error('AUTH_USER_MISMATCH');
  }

  const { error } = await client
    .from('order_customer_contacts')
    .delete()
    .eq('order_id', orderId);

  if (error) throw error;
}

export async function selectCustomerOffer(requestId: string, offerId: string) {
  const { data, error } = await requireSupabase().rpc('dallni_select_offer', {
    p_request_id: requestId,
    p_offer_id: offerId,
  });

  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('ORDER_NOT_CREATED');
  return data;
}

export async function submitCustomerRating(input: {
  orderId: string;
  shopId: string;
  stars: number;
  comment: string;
}) {
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) {
    throw new Error('INVALID_RATING_STARS');
  }
  if (input.comment.length > 240) throw new Error('RATING_COMMENT_TOO_LONG');

  const { data, error } = await requireSupabase()
    .from('ratings')
    .insert({
      order_id: input.orderId,
      shop_id: input.shopId,
      stars: input.stars,
      comment: input.comment.trim(),
    })
    .select('id,order_id,shop_id,stars,comment,created_at')
    .single();

  if (error) throw error;
  return data as CustomerCloudRating;
}
