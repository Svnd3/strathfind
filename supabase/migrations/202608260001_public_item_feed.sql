begin;

-- StrathFind is intentionally scoped to Strathmore University. Anonymous
-- clients have no profile from which to derive a campus, so this function
-- anchors the public feed to the university's unique production slug.
--
-- Keep this return list intentionally small. In particular, do not expose
-- reporter/profile identifiers, contact details, verification questions,
-- claim evidence, photo storage paths, or audit records here.
create or replace function public.get_public_item_cards(
  p_kind text default null,
  p_category text default null,
  p_search text default null,
  p_limit integer default 48
)
returns table (
  id uuid,
  kind text,
  title text,
  category text,
  color text,
  description text,
  location text,
  observed_at timestamptz,
  handoff_due_at timestamptz,
  status text,
  handoff_point text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with inputs as (
    select
      nullif(lower(trim(p_kind)), '') as kind,
      nullif(lower(trim(p_category)), '') as category,
      nullif(lower(left(trim(p_search), 80)), '') as search,
      least(greatest(coalesce(p_limit, 48), 1), 100) as result_limit
  )
  select
    item.id,
    item.kind::text,
    item.title,
    item.category,
    coalesce(item.color, ''),
    left(item.description, 280),
    item.location_found,
    item.found_at,
    item.handoff_due_at,
    item.status::text,
    item.handoff_point,
    item.created_at
  from public.found_items item
  join public.universities university
    on university.id = item.university_id
  cross join inputs
  where university.slug = 'strathmore-university'
    and university.active
    and item.status not in ('returned', 'archived')
    and (inputs.kind is null or item.kind::text = inputs.kind)
    and (inputs.category is null or lower(item.category) = inputs.category)
    and (
      inputs.search is null
      or position(
        inputs.search in lower(concat_ws(
          ' ',
          item.title,
          item.category,
          item.color,
          item.description,
          item.location_found,
          item.handoff_point
        ))
      ) > 0
    )
  order by item.created_at desc, item.id
  limit (select result_limit from inputs);
$$;

revoke all on function public.get_public_item_cards(text, text, text, integer) from public;
grant execute on function public.get_public_item_cards(text, text, text, integer)
  to anon, authenticated;

comment on function public.get_public_item_cards(text, text, text, integer) is
  'Anonymous-safe Strathmore item feed. Omits identities, contact data, verification details, claims, media paths, and audit data.';

commit;
