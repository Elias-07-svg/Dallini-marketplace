import { supabase } from '@/lib/supabase';

let channelSequence = 0;

function nextChannelName(scope: string) {
  channelSequence += 1;
  return `dallni-${scope}-${channelSequence}`;
}

export function subscribeToCustomerMarketplace(
  customerId: string,
  onChange: () => void,
) {
  if (!supabase) return () => {};
  const client = supabase;

  const channel = client
    .channel(nextChannelName('customer-marketplace'))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'requests', filter: `customer_id=eq.${customerId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${customerId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToCustomerRequestOffers(
  requestIds: string[],
  onChange: () => void,
) {
  if (!supabase || requestIds.length === 0) return () => {};
  const client = supabase;

  const channelBuilder = client.channel(nextChannelName('customer-offers'));
  for (const requestId of new Set(requestIds)) {
    channelBuilder.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'offers', filter: `request_id=eq.${requestId}` },
      onChange,
    );
  }
  const channel = channelBuilder.subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToShopInboxRequests(onChange: () => void) {
  if (!supabase) return () => {};
  const client = supabase;

  const channel = client
    .channel(nextChannelName('shop-inbox-requests'))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'requests' },
      onChange,
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToShopOrders(shopId: string, onChange: () => void) {
  if (!supabase) return () => {};
  const client = supabase;

  const channel = client
    .channel(nextChannelName('shop-orders'))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToShopRequestOrder(requestId: string, onChange: () => void) {
  if (!supabase) return () => {};
  const client = supabase;

  const channel = client
    .channel(nextChannelName('shop-request-order'))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `request_id=eq.${requestId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
