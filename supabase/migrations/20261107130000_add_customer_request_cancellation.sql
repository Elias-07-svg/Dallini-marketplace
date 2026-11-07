-- Customers can cancel only their own open request before offer selection.
-- Offer selection creates an order, and both operations lock the same request row.
create or replace function public.dallni_cancel_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_status text;
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = '42501',
      message = 'Sign in before cancelling a request.';
  end if;

  select r.status
    into v_request_status
  from public.requests r
  where r.id = p_request_id
    and r.customer_id = (select auth.uid())
  for update;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Only your own request can be cancelled.';
  end if;

  if v_request_status <> 'open' then
    raise exception using
      errcode = '23514',
      message = 'Only an open request can be cancelled.';
  end if;

  -- Selection is represented by an order row and also locks the request first.
  if exists (
    select 1
    from public.orders o
    where o.request_id = p_request_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'A request with a selected offer cannot be cancelled.';
  end if;

  update public.requests r
  set status = 'cancelled'
  where r.id = p_request_id
    and r.customer_id = (select auth.uid())
    and r.status = 'open';

  if not found then
    raise exception using
      errcode = '23514',
      message = 'The request is no longer open.';
  end if;

  return p_request_id;
end;
$$;

revoke all on function public.dallni_cancel_request(uuid) from public, anon;
grant execute on function public.dallni_cancel_request(uuid) to authenticated;
