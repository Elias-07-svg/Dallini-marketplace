-- Narrow public lookup for a single active catalog product.
-- Product table reads remain restricted to the owning shop.

begin;

create or replace function public.dallni_get_catalog_product(p_product_id uuid)
returns table (
  id uuid,
  shop_id uuid,
  name text,
  description text,
  category text,
  price_amount numeric,
  currency_code text,
  image_path text,
  shop_name text,
  shop_location text,
  service_areas text[],
  featured_tier text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.shop_id,
    p.name,
    p.description,
    p.category,
    p.price_amount,
    p.currency_code,
    p.image_path,
    s.shop_name,
    s.location,
    s.service_areas,
    featured.plan_tier,
    p.created_at
  from public.products p
  join public.shops s on s.id = p.shop_id
  left join lateral (
    select sub.plan_tier
    from public.shop_subscriptions sub
    where sub.shop_id = s.id
      and sub.status = 'active'
      and sub.verified_at is not null
      and sub.current_period_start <= now()
      and sub.current_period_end > now()
    order by case sub.plan_tier when 'vvip' then 2 else 1 end desc,
      sub.current_period_end desc
    limit 1
  ) featured on true
  where p.id = p_product_id
    and p.status = 'active'
    and s.status = 'active';
$$;

revoke all on function public.dallni_get_catalog_product(uuid) from public;
grant execute on function public.dallni_get_catalog_product(uuid) to anon, authenticated;

commit;
