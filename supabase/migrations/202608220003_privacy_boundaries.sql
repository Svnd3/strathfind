begin;

-- Return only the new claim id. Callers retrieve the resulting safe row via
-- list_visible_claims, never from a base-table INSERT ... RETURNING payload.
create or replace function public.create_item_claim(
  p_item_id uuid,
  p_message text,
  p_proof_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim_id uuid;
begin
  insert into public.claims (item_id, message, proof_description)
  values (p_item_id, trim(p_message), trim(p_proof_description))
  returning id into v_claim_id;

  return v_claim_id;
end;
$$;

-- Claims contain private ownership evidence. This RPC is the supported listing
-- boundary: participants can see the claim, but only the claimant and campus
-- admins receive the claimant's stable profile id and full display name.
create or replace function public.list_visible_claims(p_item_id uuid default null)
returns table (
  id uuid,
  item_id uuid,
  claimant_id uuid,
  is_mine boolean,
  claimant_label text,
  status public.claim_status,
  message text,
  proof_description text,
  review_note text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
begin
  select p.* into v_actor
  from public.profiles p
  where p.id = auth.uid();

  if v_actor.id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.item_id,
    case
      when v_actor.role = 'admin' or c.claimant_id = v_actor.id
        then c.claimant_id
      else null::uuid
    end as claimant_id,
    c.claimant_id = v_actor.id as is_mine,
    case
      when v_actor.role = 'admin' or c.claimant_id = v_actor.id
        then claimant.display_name
      else public.mask_display_name(claimant.display_name)
    end as claimant_label,
    c.status,
    c.message,
    c.proof_description,
    c.review_note,
    c.created_at,
    c.updated_at
  from public.claims c
  join public.found_items i
    on i.id = c.item_id
   and i.university_id = c.university_id
  join public.profiles claimant
    on claimant.id = c.claimant_id
   and claimant.university_id = c.university_id
  where c.university_id = v_actor.university_id
    and (p_item_id is null or c.item_id = p_item_id)
    and (
      v_actor.role = 'admin'
      or c.claimant_id = v_actor.id
      or i.reporter_id = v_actor.id
    )
  order by c.created_at desc, c.id;
end;
$$;

revoke all on function public.create_item_claim(uuid, text, text) from public;
revoke all on function public.list_visible_claims(uuid) from public;
grant execute on function public.create_item_claim(uuid, text, text) to authenticated;
grant execute on function public.list_visible_claims(uuid) to authenticated;

-- The participant RLS policy remains defense in depth, but callers cannot use
-- the base table to recover claimant ids that list_visible_claims intentionally
-- suppresses. The restricted INSERT grant remains for return-minimal legacy
-- writes; new clients should use create_item_claim.
revoke select on table public.claims from authenticated;
revoke select (
  id,
  item_id,
  university_id,
  claimant_id,
  message,
  proof_description,
  status,
  reviewed_by,
  reviewed_at,
  review_note,
  created_at,
  updated_at
) on table public.claims from authenticated;

-- Audit consumers need event facts, not participant UUIDs. Keeping these
-- columns off the wire prevents history/audit joins from reconstructing the
-- reporter or claimant identities hidden by the safe feed and claims RPC.
revoke select on table public.item_status_history from authenticated;
revoke select (
  id,
  item_id,
  old_status,
  new_status,
  changed_by,
  changed_at
) on table public.item_status_history from authenticated;
grant select (
  id,
  item_id,
  old_status,
  new_status,
  changed_at
) on table public.item_status_history to authenticated;

revoke select on table public.contact_reveal_audit from authenticated;
revoke select (
  id,
  item_id,
  viewer_id,
  contact_owner_id,
  revealed_at
) on table public.contact_reveal_audit from authenticated;
grant select (
  id,
  item_id,
  revealed_at
) on table public.contact_reveal_audit to authenticated;

-- RLS policies must not depend on the caller having SELECT permission for the
-- identity-bearing found_items columns that this migration revokes.
create or replace function public.can_access_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.found_items i
    join public.profiles actor on actor.id = auth.uid()
    where i.id = p_item_id
      and i.university_id = actor.university_id
  )
$$;

create or replace function public.can_administer_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.found_items i
    join public.profiles actor on actor.id = auth.uid()
    where i.id = p_item_id
      and i.university_id = actor.university_id
      and actor.role = 'admin'
  )
$$;

revoke all on function public.can_access_item(uuid) from public;
revoke all on function public.can_administer_item(uuid) from public;
grant execute on function public.can_access_item(uuid) to authenticated;
grant execute on function public.can_administer_item(uuid) to authenticated;

drop policy if exists status_history_read_same_university
  on public.item_status_history;
create policy status_history_read_same_university
on public.item_status_history for select
to authenticated
using (public.can_access_item(item_id));

drop policy if exists contact_audit_read_involved_or_admin
  on public.contact_reveal_audit;
create policy contact_audit_read_involved_or_admin
on public.contact_reveal_audit for select
to authenticated
using (
  viewer_id = auth.uid()
  or contact_owner_id = auth.uid()
  or public.can_administer_item(item_id)
);

-- A student may read only their own profile. Campus admins retain the member
-- directory they need for moderation, and list_university_members remains the
-- explicit admin-only full directory contract.
drop policy if exists profiles_read_same_university on public.profiles;
drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or public.is_university_admin(auth.uid(), university_id)
);

-- Even admins must use reveal_item_contact for somebody else's phone so every
-- disclosure is authorized, rate-limited, and written to the reveal audit.
drop policy if exists profile_contacts_read_owner_or_admin
  on public.profile_contacts;
drop policy if exists profile_contacts_read_self on public.profile_contacts;
create policy profile_contacts_read_self
on public.profile_contacts for select
to authenticated
using (profile_id = auth.uid());

-- New object keys intentionally contain no user id:
--   {university_id}/items/{item_id}/{opaque_file_name}
-- Legacy university/user/item/file keys are denied by these helpers and are
-- omitted from the feed until a trusted service copies them to the new key.
create or replace function public.can_view_item_photo_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.found_items i
    join public.profiles p on p.id = auth.uid()
    where p_path ~ '^[^/]+/items/[^/]+/[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
      and split_part(p_path, '/', 2) = 'items'
      and public.path_segment_uuid(p_path, 3) = i.id
      and public.path_segment_uuid(p_path, 1) = i.university_id
      and i.university_id = p.university_id
  )
$$;

create or replace function public.can_manage_item_photo_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.found_items i
    join public.profiles p on p.id = auth.uid()
    where p_path ~ '^[^/]+/items/[^/]+/[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
      and split_part(p_path, '/', 2) = 'items'
      and public.path_segment_uuid(p_path, 3) = i.id
      and public.path_segment_uuid(p_path, 1) = i.university_id
      and i.university_id = p.university_id
      and (i.reporter_id = auth.uid() or p.role = 'admin')
      and i.status not in ('returned', 'archived')
  )
$$;

create or replace function public.validate_found_item_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.found_items%rowtype;
begin
  select * into v_item from public.found_items where id = new.item_id;
  if not found then
    raise exception 'Item does not exist' using errcode = '23503';
  end if;

  if auth.uid() is not null then
    new.uploader_id := auth.uid();
  end if;

  if new.storage_path !~ '^[^/]+/items/[^/]+/[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
    or public.path_segment_uuid(new.storage_path, 1) is distinct from v_item.university_id
    or split_part(new.storage_path, '/', 2) <> 'items'
    or public.path_segment_uuid(new.storage_path, 3) is distinct from new.item_id
  then
    raise exception 'Photo path must be university/items/item/opaque-file'
      using errcode = '22023';
  end if;

  if tg_op = 'INSERT' and (
    select count(*) from public.found_item_photos p where p.item_id = new.item_id
  ) >= 6 then
    raise exception 'An item can have at most 6 photos' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.can_view_item_photo_path(text) from public;
revoke all on function public.can_manage_item_photo_path(text) from public;
revoke all on function public.validate_found_item_photo() from public;
grant execute on function public.can_view_item_photo_path(text) to authenticated;
grant execute on function public.can_manage_item_photo_path(text) to authenticated;

-- Metadata writes use the same definer helper as Storage policies. This keeps
-- uploads working after reporter_id/university_id become non-selectable.
drop policy if exists found_item_photos_read_same_university
  on public.found_item_photos;
create policy found_item_photos_read_same_university
on public.found_item_photos for select
to authenticated
using (public.can_access_item(item_id));

drop policy if exists found_item_photos_create_owner_or_admin
  on public.found_item_photos;
create policy found_item_photos_create_owner_or_admin
on public.found_item_photos for insert
to authenticated
with check (
  uploader_id = auth.uid()
  and public.can_manage_item_photo_path(storage_path)
);

drop policy if exists found_item_photos_delete_owner_or_admin
  on public.found_item_photos;
create policy found_item_photos_delete_owner_or_admin
on public.found_item_photos for delete
to authenticated
using (public.can_manage_item_photo_path(storage_path));

-- The matching RPC is also a report-card boundary. Replacing the migration
-- 002 definition ensures an old user-id-bearing key can never escape through
-- match results while legacy objects are being re-keyed.
create or replace function public.possible_item_matches(
  p_item_id uuid,
  p_limit integer default 10
)
returns table (
  item_id uuid,
  kind public.report_kind,
  title text,
  category text,
  color text,
  description text,
  location text,
  observed_at timestamptz,
  handoff_due_at timestamptz,
  status public.item_status,
  cover_photo_path text,
  match_score integer,
  match_reasons text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_source public.found_items%rowtype;
begin
  select * into v_source
  from public.found_items
  where id = p_item_id;

  if v_source.id is null
    or v_source.university_id is distinct from public.current_university_id()
  then
    raise exception 'Report not available' using errcode = '42501';
  end if;
  if p_limit not between 1 and 50 then
    raise exception 'Match limit must be between 1 and 50' using errcode = '22023';
  end if;

  return query
  with scored as (
    select
      candidate.*,
      (
        50
        + case
            when public.normalize_match_text(candidate.color) <> ''
              and public.normalize_match_text(candidate.color) = public.normalize_match_text(v_source.color)
            then 20 else 0
          end
        + case
            when public.normalize_match_text(candidate.location_found) = public.normalize_match_text(v_source.location_found)
            then 20
            when public.normalize_match_text(candidate.location_found) like '%' || public.normalize_match_text(v_source.location_found) || '%'
              or public.normalize_match_text(v_source.location_found) like '%' || public.normalize_match_text(candidate.location_found) || '%'
            then 12 else 0
          end
        + case
            when abs(extract(epoch from (candidate.found_at - v_source.found_at))) <= 21600 then 10
            when abs(extract(epoch from (candidate.found_at - v_source.found_at))) <= 86400 then 7
            when abs(extract(epoch from (candidate.found_at - v_source.found_at))) <= 259200 then 4
            else 0
          end
      )::integer as score,
      array_remove(array[
        'category',
        case
          when public.normalize_match_text(candidate.color) <> ''
            and public.normalize_match_text(candidate.color) = public.normalize_match_text(v_source.color)
          then 'color'
        end,
        case
          when public.normalize_match_text(candidate.location_found) = public.normalize_match_text(v_source.location_found)
            or public.normalize_match_text(candidate.location_found) like '%' || public.normalize_match_text(v_source.location_found) || '%'
            or public.normalize_match_text(v_source.location_found) like '%' || public.normalize_match_text(candidate.location_found) || '%'
          then 'location'
        end,
        case
          when abs(extract(epoch from (candidate.found_at - v_source.found_at))) <= 259200
          then 'time'
        end
      ], null)::text[] as reasons
    from public.found_items candidate
    where candidate.university_id = v_source.university_id
      and candidate.id <> v_source.id
      and candidate.kind <> v_source.kind
      and public.normalize_match_text(candidate.category) = public.normalize_match_text(v_source.category)
      and candidate.status not in ('returned', 'archived')
      and abs(extract(epoch from (candidate.found_at - v_source.found_at))) <= 1209600
  )
  select
    s.id,
    s.kind,
    s.title,
    s.category,
    s.color,
    s.description,
    s.location_found,
    s.found_at,
    s.handoff_due_at,
    s.status,
    (
      select photo.storage_path
      from public.found_item_photos photo
      where photo.item_id = s.id
        and photo.storage_path ~ '^[^/]+/items/[^/]+/[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
        and public.path_segment_uuid(photo.storage_path, 1) = s.university_id
        and public.path_segment_uuid(photo.storage_path, 3) = s.id
      order by photo.sort_order, photo.created_at
      limit 1
    ),
    s.score,
    s.reasons
  from scored s
  order by s.score desc,
           abs(extract(epoch from (s.found_at - v_source.found_at))),
           s.created_at desc,
           s.id
  limit p_limit;
end;
$$;

revoke all on function public.possible_item_matches(uuid, integer) from public;
grant execute on function public.possible_item_matches(uuid, integer) to authenticated;

-- Keep useful report columns available to legacy clients, but do not expose
-- reporter_id (or university_id) from the base table. Identity and campus
-- scoping are supplied through safe views/RPCs instead.
revoke select on table public.found_items from authenticated;
revoke select (
  university_id,
  reporter_id,
  reminder_sent_at,
  overdue_notified_at
) on table public.found_items from authenticated;
grant select (
  id,
  title,
  description,
  category,
  color,
  location_found,
  found_at,
  handoff_due_at,
  status,
  created_at,
  updated_at,
  kind,
  handoff_point
) on table public.found_items to authenticated;

-- Photo reads are served through the safe card view and private bucket policy.
-- Direct metadata reads reveal uploader ids and user-id-bearing object paths.
revoke select on table public.found_item_photos from authenticated;
revoke select (
  id,
  item_id,
  uploader_id,
  storage_path,
  mime_type,
  width,
  height,
  blurhash,
  sort_order,
  created_at
) on table public.found_item_photos from authenticated;

-- This view must not depend on caller access to reporter_id or other students'
-- profile rows. It therefore runs with its owner's base-table privileges and
-- enforces the campus boundary in the view predicate itself. security_barrier
-- prevents caller predicates from being pushed through that boundary.
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
  public.masked_item_contact(i.id) as masked_phone
from public.found_items i
join public.universities u on u.id = i.university_id
join public.profiles reporter on reporter.id = i.reporter_id
where i.status <> 'archived'
  and i.university_id = public.current_university_id();

revoke all on table public.found_item_cards from anon, authenticated;
grant select on table public.found_item_cards to authenticated;

comment on function public.list_visible_claims(uuid) is
  'Participant-scoped claims. Other claimants are represented by a masked label and no stable claimant id.';
comment on function public.create_item_claim(uuid, text, text) is
  'Creates an ownership claim and returns only its id; use list_visible_claims to read claim data.';
comment on view public.found_item_cards is
  'Campus-scoped safe report feed. Personal contact names are masked and base reporter ids are omitted.';

commit;
