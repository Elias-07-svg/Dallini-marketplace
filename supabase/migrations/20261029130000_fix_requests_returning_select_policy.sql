alter policy requests_read_customer_or_visible_shop
on public.requests
using (
  customer_id = (select auth.uid())
  or public.dallni_can_read_request(id)
);
