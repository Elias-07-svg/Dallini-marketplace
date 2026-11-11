-- Product discovery and owner-managed listings for DALLNI.
-- Product photos use a separate private bucket with an active-listing read
-- policy. The existing request-images bucket remains private and is untouched.
-- Subscription entitlements are backend-managed; mobile clients cannot write
-- plan tiers, subscription state, or featured placement.

begin;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1200),
  category text not null check (char_length(btrim(category)) between 1 and 80),
  price_amount numeric(12, 2) not null check (price_amount > 0),
  currency_code text not null check (currency_code in ('USD', 'LBP')),
  image_path text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_image_path_belongs_to_product check (
    image_path is null
    or image_path = shop_id::text || '/' || id::text || '/product.jpg'
  ),
  constraint products_active_requires_image check (
    status <> 'active' or image_path is not null
  )
);

create index products_shop_status_created_idx
  on public.products (shop_id, status, created_at desc);
create index products_active_category_price_idx
  on public.products (category, currency_code, price_amount, created_at desc)
  where status = 'active';

create table public.shop_subscriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  plan_tier text not null check (plan_tier in ('vip', 'vvip')),
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'active', 'past_due', 'cancelled', 'expired')),
  payment_provider text not null check (char_length(btrim(payment_provider)) between 1 and 80),
  provider_subscription_ref text not null
    check (char_length(btrim(provider_subscription_ref)) between 1 and 200),
  current_period_start timestamptz,
  current_period_end timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_subscriptions_provider_ref_unique
    unique (payment_provider, provider_subscription_ref),
  constraint shop_subscriptions_active_requires_verification check (
    status <> 'active'
    or (
      verified_at is not null
      and current_period_start is not null
      and current_period_end is not null
      and current_period_end > current_period_start
    )
  )
);

create index shop_subscriptions_rank_idx
  on public.shop_subscriptions (shop_id, status, plan_tier, current_period_end desc);

alter table public.products enable row level security;
alter table public.shop_subscriptions enable row level security;

revoke all on table public.products, public.shop_subscriptions from anon, authenticated;
grant select on public.products to authenticated;
grant insert (shop_id, name, description, category, price_amount, currency_code)
  on public.products to authenticated;
grant update (name, description, category, price_amount, currency_code, image_path, status)
  on public.products to authenticated;
grant all on table public.shop_subscriptions to service_role;

create policy products_read_own_shop
  on public.products for select to authenticated
  using (public.dallni_is_shop_owner(shop_id));

create policy products_create_draft_for_own_shop
  on public.products for insert to authenticated
  with check (
    public.dallni_is_shop_owner(shop_id)
    and status = 'draft'
    and image_path is null
  );

create policy products_update_own_shop
  on public.products for update to authenticated
  using (public.dallni_is_shop_owner(shop_id))
  with check (
    public.dallni_is_shop_owner(shop_id)
    and (status <> 'active' or public.dallni_is_active_shop_owner(shop_id))
  );

-- Customers use these functions instead of direct table reads. The result
-- contains catalog fields only and deliberately omits WhatsApp and owner IDs.
create or replace function public.dallni_list_catalog_products(
  p_search text default null,
  p_category text default null,
  p_area text default null,
  p_currency_code text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_shop_id uuid default null,
  p_limit integer default 60,
  p_offset integer default 0
)
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
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_currency_code is not null and p_currency_code not in ('USD', 'LBP') then
    raise exception using errcode = '22023', message = 'Unsupported catalog currency.';
  end if;

  if (p_min_price is not null or p_max_price is not null)
    and p_currency_code is null then
    raise exception using errcode = '22023', message = 'Choose a currency before filtering prices.';
  end if;

  if p_min_price is not null and p_min_price < 0
    or p_max_price is not null and p_max_price < 0
    or p_min_price is not null and p_max_price is not null and p_min_price > p_max_price then
    raise exception using errcode = '22023', message = 'Invalid catalog price range.';
  end if;

  return query
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
  where p.status = 'active'
    and s.status = 'active'
    and (p_shop_id is null or p.shop_id = p_shop_id)
    and (
      nullif(btrim(p_search), '') is null
      or p.name ilike '%' || btrim(p_search) || '%'
      or p.description ilike '%' || btrim(p_search) || '%'
      or s.shop_name ilike '%' || btrim(p_search) || '%'
    )
    and (nullif(btrim(p_category), '') is null or p.category = btrim(p_category))
    and (
      nullif(btrim(p_area), '') is null
      or lower(btrim(s.location)) = lower(btrim(p_area))
      or exists (
        select 1
        from unnest(s.service_areas) as area(value)
        where lower(btrim(area.value)) = lower(btrim(p_area))
      )
    )
    and (p_currency_code is null or p.currency_code = p_currency_code)
    and (p_min_price is null or p.price_amount >= p_min_price)
    and (p_max_price is null or p.price_amount <= p_max_price)
  order by case featured.plan_tier when 'vvip' then 2 when 'vip' then 1 else 0 end desc,
    p.created_at desc,
    p.id
  limit least(greatest(coalesce(p_limit, 60), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.dallni_list_public_shops(
  p_search text default null,
  p_area text default null,
  p_category text default null,
  p_shop_id uuid default null,
  p_limit integer default 60,
  p_offset integer default 0
)
returns table (
  id uuid,
  shop_name text,
  location text,
  service_areas text[],
  product_categories text[],
  active_product_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.shop_name,
    s.location,
    s.service_areas,
    s.product_categories,
    (
      select count(*)
      from public.products p
      where p.shop_id = s.id and p.status = 'active'
    ) as active_product_count,
    s.created_at
  from public.shops s
  where s.status = 'active'
    and (p_shop_id is null or s.id = p_shop_id)
    and (
      nullif(btrim(p_search), '') is null
      or s.shop_name ilike '%' || btrim(p_search) || '%'
      or s.location ilike '%' || btrim(p_search) || '%'
      or exists (
        select 1 from unnest(s.service_areas) as area(value)
        where area.value ilike '%' || btrim(p_search) || '%'
      )
    )
    and (
      nullif(btrim(p_area), '') is null
      or lower(btrim(s.location)) = lower(btrim(p_area))
      or exists (
        select 1 from unnest(s.service_areas) as area(value)
        where lower(btrim(area.value)) = lower(btrim(p_area))
      )
    )
    and (
      nullif(btrim(p_category), '') is null
      or btrim(p_category) = any(s.product_categories)
    )
  order by s.shop_name, s.id
  limit least(greatest(coalesce(p_limit, 60), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.dallni_list_catalog_products(
  text, text, text, text, numeric, numeric, uuid, integer, integer
) from public;
revoke all on function public.dallni_list_public_shops(
  text, text, text, uuid, integer, integer
) from public;
grant usage on schema public to anon, authenticated;
grant execute on function public.dallni_list_catalog_products(
  text, text, text, text, numeric, numeric, uuid, integer, integer
) to anon, authenticated;
grant execute on function public.dallni_list_public_shops(
  text, text, text, uuid, integer, integer
) to anon, authenticated;

-- Product photos are isolated from private request images and only active
-- catalog listings may create a signed read URL for them.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  false,
  5242880,
  array['image/jpeg']::text[]
);

create or replace function public.dallni_can_manage_product_image(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shop_id uuid;
  v_product_id uuid;
begin
  if p_object_name is null
    or p_object_name !~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/product\.jpg$' then
    return false;
  end if;

  begin
    v_shop_id := split_part(p_object_name, '/', 1)::uuid;
    v_product_id := split_part(p_object_name, '/', 2)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return exists (
    select 1
    from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = v_product_id
      and p.shop_id = v_shop_id
      and s.owner_user_id = (select auth.uid())
  );
end;
$$;

create or replace function public.dallni_can_read_product_image(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shop_id uuid;
  v_product_id uuid;
begin
  if p_object_name is null
    or p_object_name !~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/product\.jpg$' then
    return false;
  end if;

  begin
    v_shop_id := split_part(p_object_name, '/', 1)::uuid;
    v_product_id := split_part(p_object_name, '/', 2)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return exists (
    select 1
    from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = v_product_id
      and p.shop_id = v_shop_id
      and p.status = 'active'
      and p.image_path = p_object_name
      and s.status = 'active'
  );
end;
$$;

revoke all on function public.dallni_can_manage_product_image(text) from public, anon;
revoke all on function public.dallni_can_read_product_image(text) from public, anon;
grant execute on function public.dallni_can_manage_product_image(text) to authenticated;
grant execute on function public.dallni_can_read_product_image(text) to anon, authenticated;

create policy dallni_product_images_active_catalog_select
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'product-images'
    and public.dallni_can_read_product_image(name)
  );

create policy dallni_product_images_owner_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'product-images'
    and public.dallni_can_manage_product_image(name)
  );

create policy dallni_product_images_owner_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and public.dallni_can_manage_product_image(name)
  );

create policy dallni_product_images_owner_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and public.dallni_can_manage_product_image(name)
  )
  with check (
    bucket_id = 'product-images'
    and public.dallni_can_manage_product_image(name)
  );

commit;
