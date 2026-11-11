-- Customer favorites store item references only. Catalog details continue to
-- come from the visibility-checked product and shop functions.

begin;

create table public.customer_product_favorites (
  customer_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, product_id)
);

create index customer_product_favorites_customer_created_idx
  on public.customer_product_favorites (customer_id, created_at desc);

create table public.customer_shop_favorites (
  customer_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, shop_id)
);

create index customer_shop_favorites_customer_created_idx
  on public.customer_shop_favorites (customer_id, created_at desc);

alter table public.customer_product_favorites enable row level security;
alter table public.customer_shop_favorites enable row level security;

revoke all on table public.customer_product_favorites, public.customer_shop_favorites
  from public, anon, authenticated;
grant select, insert, delete on table public.customer_product_favorites,
  public.customer_shop_favorites to authenticated;

create policy customer_product_favorites_read_own
  on public.customer_product_favorites for select to authenticated
  using (customer_id = (select auth.uid()));

create policy customer_product_favorites_add_own
  on public.customer_product_favorites for insert to authenticated
  with check (customer_id = (select auth.uid()));

create policy customer_product_favorites_remove_own
  on public.customer_product_favorites for delete to authenticated
  using (customer_id = (select auth.uid()));

create policy customer_shop_favorites_read_own
  on public.customer_shop_favorites for select to authenticated
  using (customer_id = (select auth.uid()));

create policy customer_shop_favorites_add_own
  on public.customer_shop_favorites for insert to authenticated
  with check (customer_id = (select auth.uid()));

create policy customer_shop_favorites_remove_own
  on public.customer_shop_favorites for delete to authenticated
  using (customer_id = (select auth.uid()));

commit;
