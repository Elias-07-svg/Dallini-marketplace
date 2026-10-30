begin;

-- A customer may share a WhatsApp number only after an offer is selected.
-- The number is isolated from the public request and is visible only to the
-- customer and the shop that owns the selected order.
create table public.order_customer_contacts (
  order_id uuid primary key references public.orders (id) on delete cascade,
  whatsapp_number text not null check (
    whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'
  ),
  created_at timestamptz not null default now()
);

alter table public.order_customer_contacts enable row level security;

revoke all on table public.order_customer_contacts from anon, authenticated;
grant select on public.order_customer_contacts to authenticated;
grant insert (order_id, whatsapp_number)
  on public.order_customer_contacts to authenticated;
grant update (order_id, whatsapp_number)
  on public.order_customer_contacts to authenticated;
grant delete on public.order_customer_contacts to authenticated;

create policy order_customer_contacts_read_order_parties
  on public.order_customer_contacts for select to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_customer_contacts.order_id
        and (
          o.customer_id = (select auth.uid())
          or public.dallni_is_shop_owner(o.shop_id)
        )
    )
  );

create policy order_customer_contacts_create_own_order
  on public.order_customer_contacts for insert to authenticated
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_customer_contacts.order_id
        and o.customer_id = (select auth.uid())
    )
  );

create policy order_customer_contacts_update_own_order
  on public.order_customer_contacts for update to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_customer_contacts.order_id
        and o.customer_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_customer_contacts.order_id
        and o.customer_id = (select auth.uid())
    )
  );

create policy order_customer_contacts_delete_own_order
  on public.order_customer_contacts for delete to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_customer_contacts.order_id
        and o.customer_id = (select auth.uid())
    )
  );

commit;
