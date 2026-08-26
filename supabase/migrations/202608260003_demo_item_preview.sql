begin;

-- Temporary, non-operational cards for reviewing the public LOST and FOUND UI.
-- They intentionally have no reporter, contact, claim, verification, or photo
-- data and never enter the authenticated workflow tables.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.demo_item_cards (
  id uuid primary key,
  university_id uuid not null references public.universities(id) on delete cascade,
  batch_key text not null check (char_length(trim(batch_key)) between 2 and 80),
  active boolean not null default true,
  kind public.report_kind not null,
  title text not null check (char_length(trim(title)) between 2 and 100),
  category text not null check (
    category in (
      'electronics',
      'identity',
      'keys',
      'bags',
      'clothing',
      'books',
      'bottles',
      'other'
    )
  ),
  color text check (color is null or char_length(trim(color)) between 2 and 40),
  description text not null default '' check (char_length(description) <= 280),
  location text not null check (char_length(trim(location)) between 2 and 160),
  observed_at timestamptz not null,
  handoff_due_at timestamptz,
  status public.item_status not null default 'listed',
  handoff_point text check (
    handoff_point is null or char_length(trim(handoff_point)) between 2 and 120
  ),
  created_at timestamptz not null default now(),
  check (
    (kind = 'lost' and handoff_due_at is null and handoff_point is null)
    or (kind = 'found' and handoff_due_at is not null)
  )
);

alter table private.demo_item_cards enable row level security;
revoke all on table private.demo_item_cards from public, anon, authenticated;

create index if not exists demo_item_cards_active_created_idx
  on private.demo_item_cards (created_at desc)
  where active;

comment on table private.demo_item_cards is
  'Temporary, non-operational UI preview cards. These rows contain no user or contact data.';

insert into public.universities (
  id,
  name,
  slug,
  lost_found_name,
  active
) values (
  '00000000-0000-4000-8000-000000000101',
  'Strathmore University',
  'strathmore-university',
  'Lost & Found',
  true
)
on conflict (slug) do nothing;

with campus as (
  select id
  from public.universities
  where slug = 'strathmore-university'
)
insert into private.demo_item_cards (
  id,
  university_id,
  batch_key,
  active,
  kind,
  title,
  category,
  color,
  description,
  location,
  observed_at,
  handoff_due_at,
  status,
  handoff_point,
  created_at
)
select
  preview.id,
  campus.id,
  'strathfind-demo-v1',
  true,
  preview.kind::public.report_kind,
  preview.title,
  preview.category,
  preview.color,
  preview.description,
  preview.location,
  preview.observed_at,
  preview.handoff_due_at,
  preview.status::public.item_status,
  preview.handoff_point,
  preview.created_at
from campus
cross join (
  values
    (
      '10000000-0000-4000-8000-000000000001'::uuid,
      'lost',
      'DEMO · Black earbuds',
      'electronics',
      'Black',
      'Preview listing. Small charging case with a light scratch.',
      'Student Centre cafeteria',
      now() - interval '45 minutes',
      null::timestamptz,
      'listed',
      null::text,
      now() - interval '10 minutes'
    ),
    (
      '10000000-0000-4000-8000-000000000003'::uuid,
      'lost',
      'DEMO · Student ID holder',
      'identity',
      'Blue and clear',
      'Preview listing. Clear holder with a blue lanyard.',
      'Library, Level 2',
      now() - interval '3 hours',
      null::timestamptz,
      'listed',
      null::text,
      now() - interval '25 minutes'
    ),
    (
      '10000000-0000-4000-8000-000000000002'::uuid,
      'found',
      'DEMO · Three-key ring',
      'keys',
      'Silver',
      'Preview listing. Three keys on a plain silver ring.',
      'Main gate',
      now() - interval '2 hours',
      now() + interval '22 hours',
      'listed',
      'Main gate security desk',
      now() - interval '15 minutes'
    ),
    (
      '10000000-0000-4000-8000-000000000004'::uuid,
      'found',
      'DEMO · Navy laptop backpack',
      'bags',
      'Navy blue',
      'Preview listing. Two zipped compartments and a side pocket.',
      'Management Science Building',
      now() - interval '30 hours',
      now() - interval '6 hours',
      'handoff_due',
      'Student Centre Lost & Found',
      now() - interval '35 minutes'
    ),
    (
      '10000000-0000-4000-8000-000000000005'::uuid,
      'found',
      'DEMO · Green water bottle',
      'bottles',
      'Green',
      'Preview listing. Insulated bottle with a black lid.',
      'Sports Complex reception',
      now() - interval '5 hours',
      now() + interval '19 hours',
      'listed',
      'Sports office reception',
      now() - interval '5 minutes'
    )
) as preview (
  id,
  kind,
  title,
  category,
  color,
  description,
  location,
  observed_at,
  handoff_due_at,
  status,
  handoff_point,
  created_at
)
on conflict (id) do update
set university_id = excluded.university_id,
    batch_key = excluded.batch_key,
    active = excluded.active,
    kind = excluded.kind,
    title = excluded.title,
    category = excluded.category,
    color = excluded.color,
    description = excluded.description,
    location = excluded.location,
    observed_at = excluded.observed_at,
    handoff_due_at = excluded.handoff_due_at,
    status = excluded.status,
    handoff_point = excluded.handoff_point,
    created_at = excluded.created_at;

do $$
begin
  if (
    select count(*)
    from private.demo_item_cards
    where batch_key = 'strathfind-demo-v1'
      and active
  ) <> 5 then
    raise exception 'Expected exactly five active StrathFind demo cards';
  end if;

  if (
    select count(*)
    from private.demo_item_cards
    where batch_key = 'strathfind-demo-v1'
      and active
      and kind = 'lost'
  ) <> 2 or (
    select count(*)
    from private.demo_item_cards
    where batch_key = 'strathfind-demo-v1'
      and active
      and kind = 'found'
  ) <> 3 then
    raise exception 'Expected two lost and three found StrathFind demo cards';
  end if;
end
$$;

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
  ),
  feed as (
    select
      item.id,
      item.kind::text as kind,
      item.title,
      item.category,
      coalesce(item.color, '') as color,
      left(item.description, 280) as description,
      item.location_found as location,
      item.found_at as observed_at,
      item.handoff_due_at,
      item.status::text as status,
      item.handoff_point,
      item.created_at
    from public.found_items item
    join public.universities university
      on university.id = item.university_id
    where university.slug = 'strathmore-university'
      and university.active
      and item.status not in ('returned', 'archived')

    union all

    select
      demo.id,
      demo.kind::text,
      demo.title,
      demo.category,
      coalesce(demo.color, ''),
      left(demo.description, 280),
      demo.location,
      demo.observed_at,
      demo.handoff_due_at,
      demo.status::text,
      demo.handoff_point,
      demo.created_at
    from private.demo_item_cards demo
    join public.universities university
      on university.id = demo.university_id
    where demo.active
      and demo.batch_key = 'strathfind-demo-v1'
      and university.slug = 'strathmore-university'
      and university.active
      and demo.status not in ('returned', 'archived')
  )
  select
    feed.id,
    feed.kind,
    feed.title,
    feed.category,
    feed.color,
    feed.description,
    feed.location,
    feed.observed_at,
    feed.handoff_due_at,
    feed.status,
    feed.handoff_point,
    feed.created_at
  from feed
  cross join inputs
  where (inputs.kind is null or feed.kind = inputs.kind)
    and (inputs.category is null or lower(feed.category) = inputs.category)
    and (
      inputs.search is null
      or position(
        inputs.search in lower(concat_ws(
          ' ',
          feed.title,
          feed.category,
          feed.color,
          feed.description,
          feed.location,
          feed.handoff_point
        ))
      ) > 0
    )
  order by feed.created_at desc, feed.id
  limit (select result_limit from inputs);
$$;

revoke all on function public.get_public_item_cards(text, text, text, integer) from public;
grant execute on function public.get_public_item_cards(text, text, text, integer)
  to anon, authenticated;

comment on function public.get_public_item_cards(text, text, text, integer) is
  'Anonymous-safe Strathmore feed, including active non-operational UI preview cards. Omits identities, contacts, verification details, claims, media paths, and audit data.';

commit;
