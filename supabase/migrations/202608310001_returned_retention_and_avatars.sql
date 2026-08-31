begin;

-- A return has a distinct lifecycle timestamp. updated_at is not suitable for
-- retention because later administrative edits would move the deletion date.
alter table public.found_items
  add column if not exists returned_at timestamptz;

-- Prefer the first audited transition so a later edit cannot extend retention.
-- Legacy returned rows without a matching audit record use their last update as
-- the only deterministic timestamp already available.
update public.found_items item
set returned_at = coalesce(
  (
    select min(history.changed_at)
    from public.item_status_history history
    where history.item_id = item.id
      and history.new_status = 'returned'
  ),
  item.updated_at
)
where item.returned_at is null
  and (
    item.status = 'returned'
    or exists (
      select 1
      from public.item_status_history history
      where history.item_id = item.id
        and history.new_status = 'returned'
    )
  );

create or replace function public.set_found_item_returned_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'returned' then
      -- An explicit value is useful for trusted imports of historical records.
      new.returned_at := coalesce(new.returned_at, now());
    else
      new.returned_at := null;
    end if;
  elsif old.returned_at is not null then
    -- Once recorded, the first return timestamp is immutable, including if an
    -- administrator legitimately reopens and later returns the report again.
    new.returned_at := old.returned_at;
  elsif new.status = 'returned' and old.status is distinct from 'returned' then
    new.returned_at := now();
  else
    new.returned_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists found_items_set_returned_at on public.found_items;
create trigger found_items_set_returned_at
before insert or update of status, returned_at on public.found_items
for each row execute function public.set_found_item_returned_at();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.found_items'::regclass
      and conname = 'found_items_returned_at_required'
  ) then
    alter table public.found_items
      add constraint found_items_returned_at_required
      check (status <> 'returned' or returned_at is not null);
  end if;
end
$$;

create index if not exists found_items_returned_retention_idx
  on public.found_items (returned_at)
  where status = 'returned';

revoke all on function public.set_found_item_returned_at() from public;

-- Storage reads follow the same 72-hour boundary as the card feed. The
-- reporter retains access until the 30-day purge so their account history is
-- still complete, while other campus users cannot reuse an old object path.
create or replace function public.can_view_item_photo_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.found_items item
    join public.profiles profile on profile.id = auth.uid()
    where p_path ~ '^[^/]+/items/[^/]+/[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
      and split_part(p_path, '/', 2) = 'items'
      and public.path_segment_uuid(p_path, 3) = item.id
      and public.path_segment_uuid(p_path, 1) = item.university_id
      and item.university_id = profile.university_id
      and item.status <> 'archived'
      and (
        item.status <> 'returned'
        or item.returned_at > now() - interval '72 hours'
        or item.reporter_id = auth.uid()
      )
  )
$$;

revoke all on function public.can_view_item_photo_path(text) from public, anon;
grant execute on function public.can_view_item_photo_path(text) to authenticated;

-- Apply the reunion boundary to legacy direct-table reads too. The safe view
-- below has the same predicate, and reporters keep their own history.
drop policy if exists found_items_read_same_university on public.found_items;
create policy found_items_read_same_university
on public.found_items for select
to authenticated
using (
  university_id = public.current_university_id()
  and status <> 'archived'
  and (
    status <> 'returned'
    or returned_at > now() - interval '72 hours'
    or reporter_id = auth.uid()
  )
);

-- Keep the authenticated campus feed useful for up to 72 hours after return,
-- then hide the report while it awaits the separate 30-day retention purge.
create or replace view public.found_item_cards
with (security_barrier = true, security_invoker = false)
as
select
  i.id,
  i.title,
  i.category,
  i.color,
  i.location_found,
  i.found_at,
  i.handoff_due_at,
  i.status,
  i.reporter_id = auth.uid() as is_mine,
  (
    select photo.storage_path
    from public.found_item_photos photo
    where photo.item_id = i.id
      and photo.storage_path ~ '^[^/]+/items/[^/]+/[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
      and public.path_segment_uuid(photo.storage_path, 1) = i.university_id
      and public.path_segment_uuid(photo.storage_path, 3) = i.id
    order by photo.sort_order, photo.created_at
    limit 1
  ) as cover_photo_path,
  i.created_at,
  i.kind,
  i.description,
  i.location_found as location,
  i.found_at as observed_at,
  i.handoff_point,
  case
    when i.status = 'in_admin_custody' then u.lost_found_name
    else public.mask_display_name(reporter.display_name)
  end as contact_name,
  public.masked_item_contact(i.id) as masked_phone,
  i.returned_at
from public.found_items i
join public.universities u on u.id = i.university_id
join public.profiles reporter on reporter.id = i.reporter_id
where i.status <> 'archived'
  and (
    i.status <> 'returned'
    or i.returned_at > now() - interval '72 hours'
    or i.reporter_id = auth.uid()
  )
  and i.university_id = public.current_university_id();

revoke all on table public.found_item_cards from anon, authenticated;
grant select on table public.found_item_cards to authenticated;

comment on view public.found_item_cards is
  'Campus-scoped safe report feed. Returned reports remain publicly discoverable for less than 72 hours and stay visible to their reporter until retention; personal contact names are masked and reporter ids are omitted.';

-- A deliberately narrow public feed for recently returned belongings. It is
-- fixed to the active Strathmore campus and exposes no identity, contact,
-- verification, claim, audit, or media-path fields.
create or replace function public.get_recent_returned_item_cards(
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
  created_at timestamptz,
  returned_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
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
    item.created_at,
    item.returned_at
  from public.found_items item
  join public.universities university
    on university.id = item.university_id
  where university.slug = 'strathmore-university'
    and university.active
    and item.status = 'returned'
    and item.returned_at > now() - interval '72 hours'
  order by item.returned_at desc, item.id
  limit least(greatest(coalesce(p_limit, 48), 1), 100);
$$;

revoke all on function public.get_recent_returned_item_cards(integer) from public;
grant execute on function public.get_recent_returned_item_cards(integer)
  to anon, authenticated;

comment on function public.get_recent_returned_item_cards(integer) is
  'Anonymous-safe Strathmore feed containing only reports returned within the previous 72 hours.';

-- This function is intentionally not a client API. A trusted retention worker
-- passes only item ids whose eligible report-photo objects it has already
-- deleted from Storage, together with the exact cutoff used for that cleanup.
create or replace function public.process_returned_item_retention(
  p_item_ids uuid[],
  p_cutoff timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_ids uuid[];
  v_deleted_count integer := 0;
begin
  if p_cutoff is null then
    raise exception 'A fixed retention cutoff is required'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(candidate.id), array[]::uuid[])
  into v_item_ids
  from (
    select item.id
    from public.found_items item
    where item.id = any(coalesce(p_item_ids, array[]::uuid[]))
      and item.status = 'returned'
      and item.returned_at is not null
      and item.returned_at <= p_cutoff - interval '30 days'
    order by item.returned_at, item.id
    for update
  ) candidate;

  if cardinality(v_item_ids) = 0 then
    return 0;
  end if;

  -- These tables use RESTRICT because they are normally permanent audit and
  -- custody records. The retention worker is the single explicit exception.
  delete from public.custody_events
  where item_id = any(v_item_ids);

  delete from public.item_custody
  where item_id = any(v_item_ids);

  delete from public.contact_reveal_audit
  where item_id = any(v_item_ids);

  delete from public.claims
  where item_id = any(v_item_ids);

  delete from public.item_status_history
  where item_id = any(v_item_ids);

  delete from public.found_items
  where id = any(v_item_ids)
    and status = 'returned'
    and returned_at is not null
    and returned_at <= p_cutoff - interval '30 days';

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

revoke all on function public.process_returned_item_retention(uuid[], timestamptz)
  from public, anon, authenticated;
grant execute on function public.process_returned_item_retention(uuid[], timestamptz)
  to service_role;

comment on function public.process_returned_item_retention(uuid[], timestamptz) is
  'Service-only retention step. Deletes only the supplied, Storage-cleaned returned report ids that were eligible at the supplied fixed cutoff.';

-- Avatar object keys are exactly {profile_id}/{opaque-file-name}. Both the
-- storage policy and profile trigger enforce that the first segment is the
-- profile owner, preventing cross-account object references.
create or replace function public.is_profile_avatar_path(p_path text, p_profile_id uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_path ~ '^[^/]+/[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
    and public.path_segment_uuid(p_path, 1) = p_profile_id,
    false
  )
$$;

create or replace function public.can_manage_profile_avatar_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.is_profile_avatar_path(p_path, auth.uid())
$$;

create or replace function public.validate_profile_avatar_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.avatar_path := nullif(btrim(new.avatar_path), '');

  if new.avatar_path is not null
    and not public.is_profile_avatar_path(new.avatar_path, new.id) then
    raise exception 'avatar_path must use {profile_id}/{opaque-file-name}'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_validate_avatar_path on public.profiles;
create trigger profiles_validate_avatar_path
before insert or update of avatar_path on public.profiles
for each row execute function public.validate_profile_avatar_path();

revoke all on function public.is_profile_avatar_path(text, uuid) from public;
revoke all on function public.can_manage_profile_avatar_path(text) from public;
revoke all on function public.validate_profile_avatar_path() from public;
grant execute on function public.can_manage_profile_avatar_path(text)
  to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'profile-avatars',
  'profile-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their own profile avatar" on storage.objects;
create policy "Users can read their own profile avatar"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and public.can_manage_profile_avatar_path(name)
);

drop policy if exists "Users can upload their own profile avatar" on storage.objects;
create policy "Users can upload their own profile avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and public.can_manage_profile_avatar_path(name)
);

drop policy if exists "Users can update their own profile avatar" on storage.objects;
create policy "Users can update their own profile avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and public.can_manage_profile_avatar_path(name)
)
with check (
  bucket_id = 'profile-avatars'
  and public.can_manage_profile_avatar_path(name)
);

drop policy if exists "Users can delete their own profile avatar" on storage.objects;
create policy "Users can delete their own profile avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and public.can_manage_profile_avatar_path(name)
);

-- Deliberately do not schedule the database deletion here. A trusted external
-- worker must first delete each eligible report's private Storage objects via
-- the Storage API, then invoke process_returned_item_retention(). Scheduling a
-- database-only purge would erase the paths while leaving sensitive bytes
-- orphaned and impossible to discover for later cleanup.

commit;
