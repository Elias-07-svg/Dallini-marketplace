-- DALLNI marketplace schema for a small, email/password-authenticated pilot.
-- Apply only to a local Supabase database first. This migration does not seed
-- the prototype's sample requests and does not change the Expo app.

begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users (id) on delete restrict,
  shop_name text not null check (char_length(btrim(shop_name)) between 1 and 70),
  whatsapp_number text not null default '',
  location text not null default '' check (char_length(location) <= 100),
  service_areas text[] not null default array[]::text[],
  product_categories text[] not null default array[]::text[],
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  constraint shops_whatsapp_format check (
    whatsapp_number = '' or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'
  )
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 72),
  details text not null default '' check (char_length(details) <= 1400),
  category text not null check (char_length(btrim(category)) between 1 and 80),
  requested_area text not null check (
    char_length(btrim(requested_area)) between 1 and 80
  ),
  image_path text,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'closed', 'cancelled')),
  sharing_notice_version text,
  sharing_notice_accepted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint requests_published_requires_acknowledgement check (
    status = 'draft'
    or (
      sharing_notice_version = 'shop-sharing-v1'
      and sharing_notice_accepted_at is not null
      and published_at is not null
    )
  ),
  constraint requests_image_path_belongs_to_request check (
    image_path is null or split_part(image_path, '/', 1) = id::text
  ),
  constraint requests_id_customer_unique unique (id, customer_id)
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  item_name text not null check (char_length(btrim(item_name)) between 1 and 120),
  price_amount numeric(12, 2) not null check (price_amount > 0),
  currency_code text not null check (currency_code in ('USD', 'LBP')),
  delivery_note text not null check (
    char_length(btrim(delivery_note)) between 1 and 500
  ),
  shop_name_snapshot text not null,
  shop_location_snapshot text not null,
  created_at timestamptz not null default now(),
  constraint offers_request_id_id_unique unique (request_id, id),
  constraint offers_id_shop_unique unique (id, shop_id)
);

-- The contact number is kept separately so customers can read it only after
-- selecting this offer. Offer cards can show the name/location snapshots.
create table public.offer_contacts (
  offer_id uuid primary key,
  shop_id uuid not null,
  whatsapp_number text not null check (
    whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'
  ),
  created_at timestamptz not null default now(),
  constraint offer_contacts_offer_shop_fk
    foreign key (offer_id, shop_id)
    references public.offers (id, shop_id)
    on delete cascade
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  offer_id uuid not null,
  customer_id uuid not null references auth.users (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  stage text not null default 'confirmed'
    check (stage in ('confirmed', 'preparing', 'ready', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_request_customer_fk
    foreign key (request_id, customer_id)
    references public.requests (id, customer_id)
    on delete restrict,
  constraint orders_request_offer_fk
    foreign key (request_id, offer_id)
    references public.offers (request_id, id)
    on delete restrict,
  constraint orders_offer_shop_fk
    foreign key (offer_id, shop_id)
    references public.offers (id, shop_id)
    on delete restrict,
  constraint orders_id_shop_unique unique (id, shop_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete restrict,
  sender_user_id uuid not null references auth.users (id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique,
  shop_id uuid not null,
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 240),
  created_at timestamptz not null default now(),
  constraint ratings_order_shop_fk
    foreign key (order_id, shop_id)
    references public.orders (id, shop_id)
    on delete restrict
);

create index requests_customer_created_idx
  on public.requests (customer_id, created_at desc);
create index requests_open_created_idx
  on public.requests (created_at desc)
  where status = 'open';
create index shops_owner_idx on public.shops (owner_user_id);
create index shops_active_idx on public.shops (status) where status = 'active';
create index offers_request_created_idx
  on public.offers (request_id, created_at desc);
create index offers_shop_created_idx
  on public.offers (shop_id, created_at desc);
create index orders_customer_updated_idx
  on public.orders (customer_id, updated_at desc);
create index orders_shop_updated_idx
  on public.orders (shop_id, updated_at desc);
create index messages_request_created_idx
  on public.messages (request_id, created_at);
create index ratings_shop_created_idx
  on public.ratings (shop_id, created_at desc);

-- A profile is created by Auth. The client cannot create a profile for another
-- user or assign itself a privileged role; profiles intentionally have no role
-- or shop-approval column.
create or replace function public.dallni_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.dallni_handle_new_user() from public, anon, authenticated;

create trigger dallni_auth_user_profile
after insert on auth.users
for each row execute function public.dallni_handle_new_user();

-- SECURITY DEFINER helpers keep related-row checks scoped to auth.uid() and
-- avoid recursive RLS. The offer helper is volatile because it locks a request.
create or replace function public.dallni_is_shop_owner(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shops s
    where s.id = p_shop_id
      and s.owner_user_id = (select auth.uid())
  );
$$;

create or replace function public.dallni_is_active_shop_owner(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shops s
    where s.id = p_shop_id
      and s.owner_user_id = (select auth.uid())
      and s.status = 'active'
  );
$$;

create or replace function public.dallni_is_request_customer(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.requests r
    where r.id = p_request_id
      and r.customer_id = (select auth.uid())
  );
$$;

create or replace function public.dallni_can_read_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.requests r
    where r.id = p_request_id
      and (
        r.customer_id = (select auth.uid())
        or (
          r.status = 'open'
          and exists (
            select 1
            from public.shops s
            where s.owner_user_id = (select auth.uid())
              and s.status = 'active'
          )
        )
        or exists (
          select 1
          from public.orders o
          join public.shops s on s.id = o.shop_id
          where o.request_id = r.id
            and s.owner_user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function public.dallni_lock_request_for_offer(
  p_request_id uuid,
  p_shop_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request_status text;
  v_consent_at timestamptz;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  -- Selection takes this same row lock before it checks the request and closes it.
  select r.status, r.sharing_notice_accepted_at
    into v_request_status, v_consent_at
  from public.requests r
  where r.id = p_request_id
  for update;

  if not found
    or v_request_status <> 'open'
    or v_consent_at is null
    or exists (
      select 1 from public.orders o where o.request_id = p_request_id
    )
    or not exists (
      select 1
      from public.shops s
      where s.id = p_shop_id
        and s.owner_user_id = (select auth.uid())
        and s.status = 'active'
    )
  then
    return false;
  end if;

  -- The request lock remains held until the enclosing transaction completes.
  return true;
end;
$$;

create or replace function public.dallni_can_read_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    join public.shops s on s.id = o.shop_id
    where o.id = p_order_id
      and (
        o.customer_id = (select auth.uid())
        or s.owner_user_id = (select auth.uid())
      )
  );
$$;

create or replace function public.dallni_can_read_offer_contact(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.offer_contacts oc
    where oc.offer_id = p_offer_id
      and (
        exists (
          select 1
          from public.shops s
          where s.id = oc.shop_id
            and s.owner_user_id = (select auth.uid())
        )
        or exists (
          select 1
          from public.orders o
          where o.offer_id = oc.offer_id
            and o.customer_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function public.dallni_can_upload_request_image(
  p_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_object_name ~
      '^[0-9a-fA-F-]{36}/[A-Za-z0-9_.-]{1,100}\.(jpg|jpeg|png|webp)$'
    and exists (
      select 1
      from public.requests r
      where r.id::text = split_part(p_object_name, '/', 1)
        and r.customer_id = (select auth.uid())
        and r.status = 'draft'
    );
$$;

create or replace function public.dallni_can_read_request_image(
  p_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_object_name ~
      '^[0-9a-fA-F-]{36}/[A-Za-z0-9_.-]{1,100}\.(jpg|jpeg|png|webp)$'
    and exists (
      select 1
      from public.requests r
      where r.id::text = split_part(p_object_name, '/', 1)
        and public.dallni_can_read_request(r.id)
    );
$$;

create or replace function public.dallni_can_delete_request_image(
  p_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.dallni_can_upload_request_image(p_object_name);
$$;

revoke all on function public.dallni_is_shop_owner(uuid) from public, anon;
revoke all on function public.dallni_is_active_shop_owner(uuid) from public, anon;
revoke all on function public.dallni_is_request_customer(uuid) from public, anon;
revoke all on function public.dallni_can_read_request(uuid) from public, anon;
revoke all on function public.dallni_lock_request_for_offer(uuid, uuid)
  from public, anon;
revoke all on function public.dallni_can_read_order(uuid) from public, anon;
revoke all on function public.dallni_can_read_offer_contact(uuid) from public, anon;
revoke all on function public.dallni_can_upload_request_image(text) from public, anon;
revoke all on function public.dallni_can_read_request_image(text) from public, anon;
revoke all on function public.dallni_can_delete_request_image(text) from public, anon;

grant execute on function public.dallni_is_shop_owner(uuid) to authenticated;
grant execute on function public.dallni_is_active_shop_owner(uuid) to authenticated;
grant execute on function public.dallni_is_request_customer(uuid) to authenticated;
grant execute on function public.dallni_can_read_request(uuid) to authenticated;
grant execute on function public.dallni_lock_request_for_offer(uuid, uuid) to authenticated;
grant execute on function public.dallni_can_read_order(uuid) to authenticated;
grant execute on function public.dallni_can_read_offer_contact(uuid) to authenticated;
grant execute on function public.dallni_can_upload_request_image(text) to authenticated;
grant execute on function public.dallni_can_read_request_image(text) to authenticated;
grant execute on function public.dallni_can_delete_request_image(text) to authenticated;

-- Shop name/location are snapshotted into an offer, while the WhatsApp number
-- is written to offer_contacts so it is not readable by a customer pre-selection.
create or replace function public.dallni_prepare_offer_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop_name text;
  v_location text;
  v_whatsapp text;
begin
  -- RLS also calls this helper. Keeping the lock here makes the insert safe
  -- regardless of whether policy checks or row triggers run first.
  if not public.dallni_lock_request_for_offer(new.request_id, new.shop_id) then
    raise exception using errcode = '42501', message = 'Only an active shop can offer on an open, unselected request.';
  end if;

  select s.shop_name, s.location, s.whatsapp_number
    into v_shop_name, v_location, v_whatsapp
  from public.shops s
  where s.id = new.shop_id
    and s.owner_user_id = (select auth.uid())
    and s.status = 'active'
  for share;

  if not found then
    raise exception using errcode = '42501', message = 'An active shop profile is required to create an offer.';
  end if;

  if v_whatsapp = '' or v_whatsapp !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception using errcode = '23514', message = 'Set a valid international WhatsApp number before offering.';
  end if;

  new.shop_name_snapshot := v_shop_name;
  new.shop_location_snapshot := v_location;
  return new;
end;
$$;

create or replace function public.dallni_snapshot_offer_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.offer_contacts (offer_id, shop_id, whatsapp_number)
  select new.id, s.id, s.whatsapp_number
  from public.shops s
  where s.id = new.shop_id;
  return new;
end;
$$;

revoke all on function public.dallni_prepare_offer_snapshot() from public, anon, authenticated;
revoke all on function public.dallni_snapshot_offer_contact() from public, anon, authenticated;

create trigger dallni_offer_snapshot_before_insert
before insert on public.offers
for each row execute function public.dallni_prepare_offer_snapshot();

create trigger dallni_offer_contact_after_insert
after insert on public.offers
for each row execute function public.dallni_snapshot_offer_contact();

-- Publishing requires the app to show a disclosure first and pass true here.
-- The database records the accepted disclosure version and blocks direct client
-- updates to status/consent fields. Disclosure text for the UI:
-- "بعد ما تنشر طلبك، أصحاب المحلات الموثّقين بيقدروا يشوفوا وصف الطلب وفئته
-- ومنطقته والصورة المرفقة ليقدّموا عروض. إذا اخترت عرض، المحل المختار بيضل
-- عنده وصول لتفاصيل الطلب والصورة للمتابعة."
create or replace function public.dallni_publish_request(
  p_request_id uuid,
  p_accept_shop_sharing boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Sign in before publishing a request.';
  end if;

  if p_accept_shop_sharing is distinct from true then
    raise exception using errcode = '42501', message = 'Shop-sharing disclosure must be accepted.';
  end if;

  update public.requests r
  set status = 'open',
      sharing_notice_version = 'shop-sharing-v1',
      sharing_notice_accepted_at = now(),
      published_at = now()
  where r.id = p_request_id
    and r.customer_id = (select auth.uid())
    and r.status = 'draft';

  if not found then
    raise exception using errcode = '42501', message = 'Only your own draft request can be published.';
  end if;

  return p_request_id;
end;
$$;

-- Selection locks the same request row as offer creation before checking it.
-- The request closes to new offers and exactly one order is created for an offer
-- belonging to that request.
create or replace function public.dallni_select_offer(
  p_request_id uuid,
  p_offer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_shop_id uuid;
  v_order_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Sign in before selecting an offer.';
  end if;

  select r.customer_id
    into v_customer_id
  from public.requests r
  where r.id = p_request_id
    and r.customer_id = (select auth.uid())
    and r.status = 'open'
    and r.sharing_notice_accepted_at is not null
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Only the customer can select an offer for an open request.';
  end if;

  select o.shop_id
    into v_shop_id
  from public.offers o
  join public.shops s on s.id = o.shop_id
  where o.id = p_offer_id
    and o.request_id = p_request_id
    and s.status = 'active';

  if not found then
    raise exception using errcode = '42501', message = 'The offer does not belong to this request or its shop is inactive.';
  end if;

  insert into public.orders (request_id, offer_id, customer_id, shop_id, stage)
  values (p_request_id, p_offer_id, v_customer_id, v_shop_id, 'confirmed')
  returning id into v_order_id;

  update public.requests
  set status = 'closed'
  where id = p_request_id;

  return v_order_id;
end;
$$;

-- The selected shop can advance exactly one stage at a time.
create or replace function public.dallni_advance_order_stage(
  p_order_id uuid,
  p_next_stage text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_expected_stage text;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Sign in before updating an order.';
  end if;

  select o.* into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found or not public.dallni_is_active_shop_owner(v_order.shop_id) then
    raise exception using errcode = '42501', message = 'Only the selected active shop can update this order.';
  end if;

  v_expected_stage := case v_order.stage
    when 'confirmed' then 'preparing'
    when 'preparing' then 'ready'
    when 'ready' then 'completed'
    else null
  end;

  if p_next_stage is distinct from v_expected_stage then
    raise exception using errcode = '23514', message = 'Order stages must advance one step at a time.';
  end if;

  update public.orders
  set stage = p_next_stage,
      updated_at = now()
  where id = p_order_id;

  return p_next_stage;
end;
$$;

revoke all on function public.dallni_publish_request(uuid, boolean) from public, anon;
revoke all on function public.dallni_select_offer(uuid, uuid) from public, anon;
revoke all on function public.dallni_advance_order_stage(uuid, text) from public, anon;

grant execute on function public.dallni_publish_request(uuid, boolean) to authenticated;
grant execute on function public.dallni_select_offer(uuid, uuid) to authenticated;
grant execute on function public.dallni_advance_order_stage(uuid, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.requests enable row level security;
alter table public.offers enable row level security;
alter table public.offer_contacts enable row level security;
alter table public.orders enable row level security;
alter table public.messages enable row level security;
alter table public.ratings enable row level security;

revoke all on table
  public.profiles,
  public.shops,
  public.requests,
  public.offers,
  public.offer_contacts,
  public.orders,
  public.messages,
  public.ratings
from anon, authenticated;

grant usage on schema public to authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.shops to authenticated;
grant insert (
  owner_user_id,
  shop_name,
  whatsapp_number,
  location,
  service_areas,
  product_categories
) on public.shops to authenticated;
grant update (
  shop_name,
  whatsapp_number,
  location,
  service_areas,
  product_categories
) on public.shops to authenticated;

grant select on public.requests to authenticated;
grant insert (customer_id, title, details, category, requested_area)
  on public.requests to authenticated;
grant update (title, details, category, requested_area, image_path)
  on public.requests to authenticated;

grant select on public.offers to authenticated;
grant insert (
  request_id,
  shop_id,
  item_name,
  price_amount,
  currency_code,
  delivery_note
) on public.offers to authenticated;

grant select on public.offer_contacts to authenticated;
grant select on public.orders to authenticated;
grant select on public.messages to authenticated;
grant insert (request_id, sender_user_id, body)
  on public.messages to authenticated;
grant select on public.ratings to authenticated;
grant insert (order_id, shop_id, stars, comment)
  on public.ratings to authenticated;

create policy profiles_read_own
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Shop status is intentionally not writable by authenticated app clients.
-- A pilot operator approves shops in the Supabase Dashboard after verification.
create policy shops_read_own
  on public.shops for select to authenticated
  using (owner_user_id = (select auth.uid()));

create policy shops_create_pending_own
  on public.shops for insert to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and status = 'pending'
  );

create policy shops_update_own_profile
  on public.shops for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy requests_read_customer_or_visible_shop
  on public.requests for select to authenticated
  using (public.dallni_can_read_request(id));

create policy requests_create_own_draft
  on public.requests for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and status = 'draft'
    and sharing_notice_accepted_at is null
    and sharing_notice_version is null
    and published_at is null
  );

create policy requests_update_own_draft
  on public.requests for update to authenticated
  using (
    customer_id = (select auth.uid())
    and status = 'draft'
  )
  with check (
    customer_id = (select auth.uid())
    and status = 'draft'
    and sharing_notice_accepted_at is null
    and sharing_notice_version is null
    and published_at is null
  );

create policy offers_read_own_shop_or_request_customer
  on public.offers for select to authenticated
  using (
    public.dallni_is_shop_owner(shop_id)
    or public.dallni_is_request_customer(request_id)
  );

create policy offers_create_for_open_request
  on public.offers for insert to authenticated
  with check (public.dallni_lock_request_for_offer(request_id, shop_id));

create policy offer_contacts_read_shop_or_selected_customer
  on public.offer_contacts for select to authenticated
  using (public.dallni_can_read_offer_contact(offer_id));

create policy orders_read_customer_or_selected_shop
  on public.orders for select to authenticated
  using (public.dallni_can_read_order(id));

create policy messages_read_order_participants
  on public.messages for select to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.request_id = messages.request_id
        and public.dallni_can_read_order(o.id)
    )
  );

create policy messages_create_for_order_participants
  on public.messages for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and exists (
      select 1
      from public.orders o
      where o.request_id = messages.request_id
        and public.dallni_can_read_order(o.id)
    )
  );

-- A customer can read their own rating and a shop owner can read ratings for
-- their own shop. Public customer-facing review access can be added separately.
create policy ratings_read_order_parties
  on public.ratings for select to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = ratings.order_id
        and (
          o.customer_id = (select auth.uid())
          or public.dallni_is_shop_owner(o.shop_id)
        )
    )
  );

create policy ratings_create_after_completed_order
  on public.ratings for insert to authenticated
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = ratings.order_id
        and o.shop_id = ratings.shop_id
        and o.customer_id = (select auth.uid())
        and o.stage = 'completed'
    )
  );

-- Private bucket. Uploads are limited to an owner's draft request; reads follow
-- the same audience as request details; draft owners can remove/replace an image.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'request-images',
  'request-images',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy dallni_request_images_upload_draft_owner
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'request-images'
    and public.dallni_can_upload_request_image(name)
  );

create policy dallni_request_images_read_request_audience
  on storage.objects for select to authenticated
  using (
    bucket_id = 'request-images'
    and public.dallni_can_read_request_image(name)
  );

create policy dallni_request_images_delete_draft_owner
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'request-images'
    and public.dallni_can_delete_request_image(name)
  );

-- Enable Postgres Changes for the tables the two-phone flow will subscribe to.
-- This is guarded so the migration also works in a database without that
-- publication; subscriptions can be enabled later in that case.
do $$
declare
  v_table_name text;
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    foreach v_table_name in array array[
      'requests', 'offers', 'orders', 'messages', 'ratings'
    ] loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table_name
      ) then
        execute format(
          'alter publication supabase_realtime add table public.%I',
          v_table_name
        );
      end if;
    end loop;
  end if;
end;
$$;

commit;
