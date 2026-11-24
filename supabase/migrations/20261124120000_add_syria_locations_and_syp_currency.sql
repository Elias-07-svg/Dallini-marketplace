begin;

-- New app releases store OpenSyria location IDs (sy-...) in the existing
-- text/text[] columns. Existing location strings remain untouched; catalog
-- RPCs below only return shops with a Syria catalog ID.
alter table public.requests
  drop constraint requests_requested_area_check;

alter table public.requests
  add constraint requests_requested_area_check
  check (char_length(btrim(requested_area)) between 1 and 120);

-- Keep legacy LBP rows readable and allow SYP. Existing amounts and currency
-- values are not rewritten; the prior constraints already limit existing rows
-- to USD or LBP.
alter table public.offers
  drop constraint offers_currency_code_check;

alter table public.offers
  add constraint offers_currency_code_check
  check (currency_code in ('USD', 'SYP', 'LBP'));

alter table public.products
  drop constraint products_currency_code_check;

alter table public.products
  add constraint products_currency_code_check
  check (currency_code in ('USD', 'SYP', 'LBP'));

-- Old LBP records remain readable and can still be archived. New offers and
-- products cannot store LBP, and an existing LBP product cannot change its
-- price while retaining LBP. This avoids converting historic amounts.
create or replace function public.dallni_reject_new_lbp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.currency_code <> 'LBP' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.currency_code = 'LBP'
      and new.currency_code = 'LBP'
      and new.price_amount is not distinct from old.price_amount then
      return new;
    end if;
  end if;

  raise exception using errcode = '23514', message = 'New prices must use USD or SYP.';
end;
$$;

create trigger dallni_offers_currency_guard
before insert or update on public.offers
for each row execute function public.dallni_reject_new_lbp();

create trigger dallni_products_currency_guard
before insert or update on public.products
for each row execute function public.dallni_reject_new_lbp();

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
  if p_currency_code is not null and p_currency_code not in ('USD', 'SYP') then
    raise exception using errcode = '22023', message = 'Unsupported catalog currency.';
  end if;

  if nullif(btrim(p_area), '') is not null
    and btrim(p_area) !~ '^sy-[a-z0-9-]+$' then
    raise exception using errcode = '22023', message = 'Unsupported catalog location.';
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
    and p.currency_code in ('USD', 'SYP')
    and s.status = 'active'
    and s.location ~ '^sy-[a-z0-9-]+$'
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
      or exists (
        select 1
        from unnest(array_prepend(s.location, s.service_areas)) as area(value)
        where area.value ~ '^sy-[a-z0-9-]+$'
          and (
            area.value = btrim(p_area)
            or area.value like btrim(p_area) || '-%'
            or btrim(p_area) like area.value || '-%'
          )
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
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(p_area), '') is not null
    and btrim(p_area) !~ '^sy-[a-z0-9-]+$' then
    raise exception using errcode = '22023', message = 'Unsupported catalog location.';
  end if;

  return query
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
        and p.currency_code in ('USD', 'SYP')
    ) as active_product_count,
    s.created_at
  from public.shops s
  where s.status = 'active'
    and s.location ~ '^sy-[a-z0-9-]+$'
    and (p_shop_id is null or s.id = p_shop_id)
    and (
      nullif(btrim(p_search), '') is null
      or s.shop_name ilike '%' || btrim(p_search) || '%'
    )
    and (
      nullif(btrim(p_area), '') is null
      or exists (
        select 1
        from unnest(array_prepend(s.location, s.service_areas)) as area(value)
        where area.value ~ '^sy-[a-z0-9-]+$'
          and (
            area.value = btrim(p_area)
            or area.value like btrim(p_area) || '-%'
            or btrim(p_area) like area.value || '-%'
          )
      )
    )
    and (
      nullif(btrim(p_category), '') is null
      or btrim(p_category) = any(s.product_categories)
    )
  order by s.shop_name, s.id
  limit least(greatest(coalesce(p_limit, 60), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

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
    and p.currency_code in ('USD', 'SYP')
    and s.status = 'active'
    and s.location ~ '^sy-[a-z0-9-]+$';
$$;

revoke all on function public.dallni_list_catalog_products(
  text, text, text, text, numeric, numeric, uuid, integer, integer
) from public;
revoke all on function public.dallni_list_public_shops(
  text, text, text, uuid, integer, integer
) from public;
revoke all on function public.dallni_get_catalog_product(uuid) from public;

grant execute on function public.dallni_list_catalog_products(
  text, text, text, text, numeric, numeric, uuid, integer, integer
) to anon, authenticated;
grant execute on function public.dallni_list_public_shops(
  text, text, text, uuid, integer, integer
) to anon, authenticated;
grant execute on function public.dallni_get_catalog_product(uuid) to anon, authenticated;

commit;
