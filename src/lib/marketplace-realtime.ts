import { supabase } from '@/lib/supabase';

export type MarketplaceRealtimeAlert =
  | { kind: 'new-offer'; eventKey: string }
  | { kind: 'new-request'; eventKey: string }
  | { kind: 'order-stage-changed'; eventKey: string; stage: string };

export type MarketplaceRealtimeHandlers = {
  refresh: () => void;
  alert: (event: MarketplaceRealtimeAlert) => void;
};

let channelSequence = 0;

function nextChannelName(scope: string) {
  channelSequence += 1;
  return `dallni-${scope}-${channelSequence}`;
}

function readString(record: unknown, field: string) {
  if (typeof record !== 'object' || record === null) return null;
  const value = (record as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : null;
}

function alertForOrderUpdate(
  payload: { eventType: string; new: unknown },
  handlers: MarketplaceRealtimeHandlers,
) {
  handlers.refresh();
  if (payload.eventType !== 'UPDATE') return;

  const orderId = readString(payload.new, 'id');
  const stage = readString(payload.new, 'stage');
  if (!orderId || !stage) return;

  handlers.alert({
    kind: 'order-stage-changed',
    eventKey: `${orderId}:${stage}`,
    stage,
  });
}

export function subscribeToCustomerMarketplace(
  customerId: string,
  handlers: MarketplaceRealtimeHandlers,
) {
  if (!supabase) return () => {};
  const client = supabase;

  const channel = client
    .channel(nextChannelName('customer-marketplace'))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'requests', filter: `customer_id=eq.${customerId}` },
      () => handlers.refresh(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${customerId}` },
      (payload) => alertForOrderUpdate(payload, handlers),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToCustomerRequestOffers(
  requestIds: string[],
  handlers: MarketplaceRealtimeHandlers,
) {
  if (!supabase || requestIds.length === 0) return () => {};
  const client = supabase;

  const channelBuilder = client.channel(nextChannelName('customer-offers'));
  for (const requestId of new Set(requestIds)) {
    channelBuilder.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'offers', filter: `request_id=eq.${requestId}` },
      (payload) => {
        handlers.refresh();
        const offerId = readString(payload.new, 'id');
        if (offerId) handlers.alert({ kind: 'new-offer', eventKey: offerId });
      },
    );
  }
  const channel = channelBuilder.subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToShopInboxRequests(handlers: MarketplaceRealtimeHandlers) {
  if (!supabase) return () => {};
  const client = supabase;

  const channel = client
    .channel(nextChannelName('shop-inbox-requests'))
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'requests' },
      (payload) => {
        handlers.refresh();
        if (payload.eventType !== 'UPDATE' || readString(payload.new, 'status') !== 'open') return;
        const requestId = readString(payload.new, 'id');
        if (requestId) handlers.alert({ kind: 'new-request', eventKey: requestId });
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToShopOrders(
  shopId: string,
  handlers: MarketplaceRealtimeHandlers,
) {
  if (!supabase) return () => {};
  const client = supabase;

  const channel = client
    .channel(nextChannelName('shop-orders'))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` },
      (payload) => alertForOrderUpdate(payload, handlers),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToShopRequestOrder(
  requestId: string,
  handlers: MarketplaceRealtimeHandlers,
) {
  if (!supabase) return () => {};
  const client = supabase;

  const channel = client
    .channel(nextChannelName('shop-request-order'))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `request_id=eq.${requestId}` },
      (payload) => alertForOrderUpdate(payload, handlers),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
