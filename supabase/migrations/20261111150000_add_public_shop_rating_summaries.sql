-- Public discovery may show only aggregate ratings for active shops.
-- Individual rating rows remain private under ratings_read_order_parties.

begin;

create or replace function public.dallni_get_public_shop_rating_summaries(p_shop_ids uuid[])
returns table (
  shop_id uuid,
  average_stars numeric,
  review_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_shop_ids is null or cardinality(p_shop_ids) < 1 or cardinality(p_shop_ids) > 100 then
    raise exception using
      errcode = '22023',
      message = 'Provide between 1 and 100 shop IDs.';
  end if;

  return query
  select
    s.id,
    round(avg(r.stars)::numeric, 1),
    count(r.id)::bigint
  from public.shops s
  left join public.orders o
    on o.shop_id = s.id
    and o.stage = 'completed'
  left join public.ratings r
    on r.order_id = o.id
    and r.shop_id = s.id
  where s.status = 'active'
    and s.id = any(p_shop_ids)
  group by s.id;
end;
$$;

revoke all on function public.dallni_get_public_shop_rating_summaries(uuid[])
  from public, anon, authenticated;
grant execute on function public.dallni_get_public_shop_rating_summaries(uuid[])
  to anon, authenticated;

commit;
