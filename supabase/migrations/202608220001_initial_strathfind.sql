begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.app_role as enum ('student', 'admin');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.item_status as enum (
    'listed',
    'claim_pending',
    'handoff_due',
    'in_admin_custody',
    'return_arranged',
    'returned',
    'archived'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.claim_status as enum (
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'completed'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.custody_event_kind as enum (
    'checked_in',
    'released',
    'transferred',
    'note'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.notification_kind as enum (
    'claim_received',
    'claim_updated',
    'contact_revealed',
    'handoff_reminder',
    'handoff_due',
    'admin_custody',
    'item_returned'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  lost_found_name text not null default 'Lost & Found',
  lost_found_location text,
  lost_found_phone_e164 text check (
    lost_found_phone_e164 is null
    or lost_found_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
  ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete restrict,
  role public.app_role not null default 'student',
  display_name text not null check (char_length(trim(display_name)) between 2 and 80),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_contacts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_role_audit (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  old_role public.app_role not null,
  new_role public.app_role not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create table if not exists public.university_join_codes (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  code_hash bytea not null unique,
  label text not null check (char_length(trim(label)) between 2 and 80),
  active boolean not null default true,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (max_uses is null or use_count <= max_uses)
);

create table if not exists public.found_items (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete restrict,
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 2 and 100),
  description text not null default '' check (char_length(description) <= 1200),
  category text not null check (char_length(trim(category)) between 2 and 50),
  color text check (color is null or char_length(trim(color)) between 2 and 40),
  location_found text not null check (char_length(trim(location_found)) between 2 and 160),
  found_at timestamptz not null default now() check (found_at <= now() + interval '5 minutes'),
  handoff_due_at timestamptz not null default (now() + interval '24 hours'),
  status public.item_status not null default 'listed',
  reminder_sent_at timestamptz,
  overdue_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.found_item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.found_items(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic')),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  blurhash text,
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.found_items(id) on delete restrict,
  university_id uuid not null references public.universities(id) on delete restrict,
  claimant_id uuid not null references public.profiles(id) on delete restrict,
  message text not null check (char_length(trim(message)) between 10 and 800),
  proof_description text not null check (char_length(trim(proof_description)) between 10 and 1200),
  status public.claim_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_reveal_audit (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.found_items(id) on delete restrict,
  viewer_id uuid not null references public.profiles(id) on delete restrict,
  contact_owner_id uuid references public.profiles(id) on delete restrict,
  revealed_at timestamptz not null default now()
);

create table if not exists public.item_custody (
  item_id uuid primary key references public.found_items(id) on delete restrict,
  university_id uuid not null references public.universities(id) on delete restrict,
  checked_in_by uuid not null references public.profiles(id) on delete restrict,
  checked_in_at timestamptz not null default now(),
  storage_reference text not null check (char_length(trim(storage_reference)) between 2 and 120),
  released_by uuid references public.profiles(id) on delete restrict,
  released_at timestamptz,
  released_to_claim_id uuid references public.claims(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (
    (released_at is null and released_by is null and released_to_claim_id is null)
    or (released_at is not null and released_by is not null)
  )
);

create table if not exists public.custody_events (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.found_items(id) on delete restrict,
  university_id uuid not null references public.universities(id) on delete restrict,
  kind public.custody_event_kind not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  claim_id uuid references public.claims(id) on delete restrict,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists public.item_status_history (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.found_items(id) on delete restrict,
  old_status public.item_status,
  new_status public.item_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind public.notification_kind not null,
  item_id uuid references public.found_items(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 80),
  body text not null check (char_length(trim(body)) between 2 and 240),
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists claims_one_open_claim_per_user_item
  on public.claims (item_id, claimant_id)
  where status in ('pending', 'approved');
create index if not exists profiles_university_idx on public.profiles (university_id);
create index if not exists join_codes_university_active_idx
  on public.university_join_codes (university_id, active);
create index if not exists found_items_university_status_found_idx
  on public.found_items (university_id, status, found_at desc);
create index if not exists found_items_handoff_due_idx
  on public.found_items (handoff_due_at)
  where status not in ('in_admin_custody', 'returned', 'archived');
create index if not exists found_item_photos_item_sort_idx
  on public.found_item_photos (item_id, sort_order, created_at);
create index if not exists claims_item_status_idx on public.claims (item_id, status, created_at);
create index if not exists claims_claimant_idx on public.claims (claimant_id, created_at desc);
create index if not exists contact_reveal_viewer_time_idx
  on public.contact_reveal_audit (viewer_id, revealed_at desc);
create index if not exists custody_events_item_time_idx
  on public.custody_events (item_id, created_at desc);
create index if not exists status_history_item_time_idx
  on public.item_status_history (item_id, changed_at desc);
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

create or replace function public.current_university_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.university_id
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function public.is_university_admin(
  p_user_id uuid default auth.uid(),
  p_university_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'admin'
      and (p_university_id is null or p.university_id = p_university_id)
  )
$$;

create or replace function public.path_segment_uuid(p_path text, p_position integer)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value text;
begin
  v_value := split_part(p_path, '/', p_position);
  if v_value = '' then
    return null;
  end if;
  return v_value::uuid;
exception
  when invalid_text_representation then return null;
end;
$$;

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
    where i.id = public.path_segment_uuid(p_path, 3)
      and i.university_id = p.university_id
      and public.path_segment_uuid(p_path, 1) = i.university_id
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
    where i.id = public.path_segment_uuid(p_path, 3)
      and i.university_id = p.university_id
      and public.path_segment_uuid(p_path, 1) = i.university_id
      and (
        (
          public.path_segment_uuid(p_path, 2) = auth.uid()
          and i.reporter_id = auth.uid()
        )
        or p.role = 'admin'
      )
      and i.status not in ('returned', 'archived')
  )
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_university_id uuid;
  v_display_name text;
  v_phone text;
begin
  v_code := lower(trim(coalesce(new.raw_user_meta_data ->> 'university_code', '')));
  v_display_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  v_phone := trim(coalesce(new.raw_user_meta_data ->> 'phone_e164', ''));

  if v_code = '' then
    raise exception 'A university code is required' using errcode = '22023';
  end if;

  update public.university_join_codes j
  set use_count = j.use_count + 1,
      last_used_at = now()
  from public.universities u
  where j.university_id = u.id
    and j.code_hash = extensions.digest(v_code, 'sha256')
    and j.active
    and u.active
    and (j.expires_at is null or j.expires_at > now())
    and (j.max_uses is null or j.use_count < j.max_uses)
  returning j.university_id into v_university_id;

  if v_university_id is null then
    raise exception 'Invalid or expired university code' using errcode = '22023';
  end if;

  if char_length(v_display_name) not between 2 and 80 then
    raise exception 'Display name must be between 2 and 80 characters' using errcode = '22023';
  end if;

  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone must be in E.164 format' using errcode = '22023';
  end if;

  insert into public.profiles (id, university_id, role, display_name)
  values (new.id, v_university_id, 'student', v_display_name);

  insert into public.profile_contacts (profile_id, phone_e164)
  values (new.id, v_phone);

  -- Do not retain a reusable join code or misleading client-supplied authority data.
  update auth.users
  set raw_user_meta_data = raw_user_meta_data
    - 'university_code'
    - 'role'
    - 'university_id'
  where id = new.id;

  return new;
end;
$$;

create or replace function public.audit_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    insert into public.profile_role_audit (
      profile_id,
      old_role,
      new_role,
      changed_by
    ) values (
      new.id,
      old.role,
      new.role,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create or replace function public.set_found_item_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is not null then
    select * into v_profile from public.profiles where id = auth.uid();
    if not found then
      raise exception 'A profile is required' using errcode = '42501';
    end if;
    new.reporter_id := auth.uid();
    new.university_id := v_profile.university_id;
    new.status := 'listed';
  end if;
  return new;
end;
$$;

create or replace function public.set_handoff_due_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.handoff_due_at := new.found_at + interval '24 hours';
  return new;
end;
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

  if public.path_segment_uuid(new.storage_path, 1) is distinct from v_item.university_id
    or public.path_segment_uuid(new.storage_path, 2) is distinct from new.uploader_id
    or public.path_segment_uuid(new.storage_path, 3) is distinct from new.item_id
    or split_part(new.storage_path, '/', 4) = ''
  then
    raise exception 'Photo path must be university/user/item/file' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' and (
    select count(*) from public.found_item_photos p where p.item_id = new.item_id
  ) >= 6 then
    raise exception 'An item can have at most 6 photos' using errcode = '22023';
  end if;

  return new;
end;
$$;

create or replace function public.set_claim_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.found_items%rowtype;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  select * into v_item from public.found_items where id = new.item_id for update;

  if v_item.id is null or v_profile.id is null
    or v_item.university_id <> v_profile.university_id
  then
    raise exception 'Item not available' using errcode = '42501';
  end if;

  if v_item.reporter_id = auth.uid() then
    raise exception 'You cannot claim your own report' using errcode = '22023';
  end if;

  if v_item.status in ('returned', 'archived') then
    raise exception 'Item is no longer claimable' using errcode = '22023';
  end if;

  new.claimant_id := auth.uid();
  new.university_id := v_item.university_id;
  new.status := 'pending';
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.review_note := null;
  return new;
end;
$$;

create or replace function public.after_claim_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reporter_id uuid;
  v_title text;
begin
  select reporter_id, title into v_reporter_id, v_title
  from public.found_items
  where id = new.item_id;

  update public.found_items
  set status = case when status = 'listed' then 'claim_pending' else status end,
      updated_at = now()
  where id = new.item_id;

  insert into public.notifications (
    recipient_id, kind, item_id, title, body, dedupe_key
  ) values (
    v_reporter_id,
    'claim_received',
    new.item_id,
    'New claim',
    'Someone submitted ownership details for ' || v_title || '.',
    'claim-received:' || new.id::text
  ) on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

create or replace function public.audit_item_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.item_status_history (item_id, old_status, new_status, changed_by)
    values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists universities_touch_updated_at on public.universities;
create trigger universities_touch_updated_at
before update on public.universities
for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists profile_contacts_touch_updated_at on public.profile_contacts;
create trigger profile_contacts_touch_updated_at
before update on public.profile_contacts
for each row execute function public.touch_updated_at();

drop trigger if exists profiles_audit_role on public.profiles;
create trigger profiles_audit_role
after update of role on public.profiles
for each row execute function public.audit_profile_role_change();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop trigger if exists found_items_set_defaults on public.found_items;
create trigger found_items_set_defaults
before insert on public.found_items
for each row execute function public.set_found_item_defaults();

drop trigger if exists found_items_set_handoff_due_at on public.found_items;
create trigger found_items_set_handoff_due_at
before insert or update of found_at on public.found_items
for each row execute function public.set_handoff_due_at();

drop trigger if exists found_items_touch_updated_at on public.found_items;
create trigger found_items_touch_updated_at
before update on public.found_items
for each row execute function public.touch_updated_at();

drop trigger if exists found_items_audit_status on public.found_items;
create trigger found_items_audit_status
after insert or update of status on public.found_items
for each row execute function public.audit_item_status_change();

drop trigger if exists found_item_photos_validate on public.found_item_photos;
create trigger found_item_photos_validate
before insert or update on public.found_item_photos
for each row execute function public.validate_found_item_photo();

drop trigger if exists claims_set_defaults on public.claims;
create trigger claims_set_defaults
before insert on public.claims
for each row execute function public.set_claim_defaults();

drop trigger if exists claims_after_created on public.claims;
create trigger claims_after_created
after insert on public.claims
for each row execute function public.after_claim_created();

drop trigger if exists claims_touch_updated_at on public.claims;
create trigger claims_touch_updated_at
before update on public.claims
for each row execute function public.touch_updated_at();

drop trigger if exists item_custody_touch_updated_at on public.item_custody;
create trigger item_custody_touch_updated_at
before update on public.item_custody
for each row execute function public.touch_updated_at();

create or replace function public.set_profile_role(
  p_profile_id uuid,
  p_role public.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  select * into v_target from public.profiles where id = p_profile_id for update;

  if v_actor.id is null or v_actor.role <> 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if v_target.id is null or v_target.university_id <> v_actor.university_id then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  if p_profile_id = auth.uid() and p_role <> 'admin' then
    raise exception 'Administrators cannot demote themselves' using errcode = '22023';
  end if;

  update public.profiles
  set role = p_role
  where id = p_profile_id
    and role is distinct from p_role;
end;
$$;

create or replace function public.create_university_join_code(
  p_label text,
  p_expires_at timestamptz default null,
  p_max_uses integer default null
)
returns table (join_code_id uuid, join_code text, valid_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_code text;
  v_id uuid;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if v_actor.id is null or v_actor.role <> 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if char_length(trim(p_label)) not between 2 and 80 then
    raise exception 'Label must be between 2 and 80 characters' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Expiry must be in the future' using errcode = '22023';
  end if;
  if p_max_uses is not null and p_max_uses <= 0 then
    raise exception 'Maximum uses must be positive' using errcode = '22023';
  end if;

  v_code := 'SF-' || upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 4))
    || '-' || upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 4))
    || '-' || upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 4));

  insert into public.university_join_codes (
    university_id,
    code_hash,
    label,
    expires_at,
    max_uses,
    created_by
  ) values (
    v_actor.university_id,
    extensions.digest(lower(v_code), 'sha256'),
    trim(p_label),
    p_expires_at,
    p_max_uses,
    auth.uid()
  ) returning id into v_id;

  return query select v_id, v_code, p_expires_at;
end;
$$;

create or replace function public.list_university_join_codes()
returns table (
  join_code_id uuid,
  label text,
  active boolean,
  expires_at timestamptz,
  max_uses integer,
  use_count integer,
  last_used_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if v_actor.id is null or v_actor.role <> 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return query
  select j.id, j.label, j.active, j.expires_at, j.max_uses,
         j.use_count, j.last_used_at, j.created_at
  from public.university_join_codes j
  where j.university_id = v_actor.university_id
  order by j.created_at desc;
end;
$$;

create or replace function public.set_join_code_active(
  p_join_code_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if v_actor.id is null or v_actor.role <> 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  update public.university_join_codes
  set active = p_active
  where id = p_join_code_id
    and university_id = v_actor.university_id;

  if not found then
    raise exception 'Join code not found' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.update_my_contact(p_phone_e164 text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if trim(p_phone_e164) !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone must be in E.164 format' using errcode = '22023';
  end if;

  insert into public.profile_contacts (profile_id, phone_e164)
  values (auth.uid(), trim(p_phone_e164))
  on conflict (profile_id) do update
  set phone_e164 = excluded.phone_e164,
      updated_at = now();
end;
$$;

create or replace function public.reveal_item_contact(p_item_id uuid)
returns table (contact_name text, phone_e164 text, contact_kind text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.found_items%rowtype;
  v_viewer public.profiles%rowtype;
  v_contact_owner uuid;
  v_name text;
  v_phone text;
  v_kind text;
  v_audit_id bigint;
begin
  select * into v_viewer from public.profiles where id = auth.uid();
  select * into v_item from public.found_items where id = p_item_id;

  if v_viewer.id is null or v_item.id is null
    or v_viewer.university_id <> v_item.university_id
    or v_item.status in ('returned', 'archived')
  then
    raise exception 'Item not available' using errcode = '42501';
  end if;

  if v_viewer.role <> 'admin' and (
    select count(*)
    from public.contact_reveal_audit a
    where a.viewer_id = auth.uid()
      and a.revealed_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'Contact reveal limit reached. Try again later.' using errcode = '42900';
  end if;

  if v_item.status = 'in_admin_custody' then
    select u.lost_found_name, u.lost_found_phone_e164
      into v_name, v_phone
    from public.universities u
    where u.id = v_item.university_id;
    v_contact_owner := null;
    v_kind := 'lost_found_desk';
  else
    select p.display_name, c.phone_e164
      into v_name, v_phone
    from public.profiles p
    join public.profile_contacts c on c.profile_id = p.id
    where p.id = v_item.reporter_id;
    v_contact_owner := v_item.reporter_id;
    v_kind := 'finder';
  end if;

  if v_phone is null then
    raise exception 'Contact details are unavailable' using errcode = '22023';
  end if;

  insert into public.contact_reveal_audit (
    item_id, viewer_id, contact_owner_id
  ) values (
    v_item.id, auth.uid(), v_contact_owner
  ) returning id into v_audit_id;

  if v_contact_owner is not null and v_contact_owner <> auth.uid() then
    insert into public.notifications (
      recipient_id, kind, item_id, title, body, dedupe_key
    ) values (
      v_contact_owner,
      'contact_revealed',
      v_item.id,
      'Contact opened',
      'A student opened your contact details for ' || v_item.title || '.',
      'contact-revealed:' || v_audit_id::text
    );
  end if;

  return query select v_name, v_phone, v_kind;
end;
$$;

create or replace function public.review_claim(
  p_claim_id uuid,
  p_approve boolean,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims%rowtype;
  v_item public.found_items%rowtype;
  v_is_admin boolean;
begin
  select * into v_claim from public.claims where id = p_claim_id for update;
  select * into v_item from public.found_items where id = v_claim.item_id for update;
  v_is_admin := public.is_university_admin(auth.uid(), v_item.university_id);

  if v_claim.id is null or v_item.id is null
    or (v_item.reporter_id <> auth.uid() and not v_is_admin)
  then
    raise exception 'Claim not available' using errcode = '42501';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'Claim has already been reviewed' using errcode = '22023';
  end if;
  if p_review_note is not null and char_length(p_review_note) > 500 then
    raise exception 'Review note is too long' using errcode = '22023';
  end if;

  update public.claims
  set status = case
        when p_approve then 'approved'::public.claim_status
        else 'rejected'::public.claim_status
      end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = nullif(trim(p_review_note), '')
  where id = v_claim.id;

  if p_approve then
    update public.claims
    set status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_note = 'Another claim was approved.'
    where item_id = v_item.id
      and id <> v_claim.id
      and status = 'pending';

    update public.found_items
    set status = case
          when status = 'in_admin_custody' then status
          else 'return_arranged'
        end
    where id = v_item.id;
  else
    update public.found_items
    set status = case
          when handoff_due_at <= now() then 'handoff_due'::public.item_status
          else 'listed'::public.item_status
        end
    where id = v_item.id
      and status = 'claim_pending'
      and not exists (
        select 1 from public.claims c
        where c.item_id = v_item.id and c.status = 'pending'
      );
  end if;

  insert into public.notifications (
    recipient_id, kind, item_id, title, body, dedupe_key
  ) values (
    v_claim.claimant_id,
    'claim_updated',
    v_item.id,
    case when p_approve then 'Claim approved' else 'Claim not verified' end,
    case
      when p_approve then 'Contact the finder or Lost & Found to arrange collection.'
      else 'The finder could not verify this claim.'
    end,
    'claim-reviewed:' || v_claim.id::text
  ) on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function public.cancel_my_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_id uuid;
begin
  update public.claims
  set status = 'cancelled'
  where id = p_claim_id
    and claimant_id = auth.uid()
    and status = 'pending'
  returning item_id into v_item_id;

  if v_item_id is null then
    raise exception 'Pending claim not found' using errcode = '22023';
  end if;

  update public.found_items
  set status = case
        when handoff_due_at <= now() then 'handoff_due'::public.item_status
        else 'listed'::public.item_status
      end
  where id = v_item_id
    and status = 'claim_pending'
    and not exists (
      select 1 from public.claims c
      where c.item_id = v_item_id and c.status = 'pending'
    );
end;
$$;

create or replace function public.accept_item_into_custody(
  p_item_id uuid,
  p_storage_reference text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.found_items%rowtype;
begin
  select * into v_item from public.found_items where id = p_item_id for update;
  if v_item.id is null
    or not public.is_university_admin(auth.uid(), v_item.university_id)
  then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if v_item.status in ('returned', 'archived') then
    raise exception 'Item is no longer active' using errcode = '22023';
  end if;
  if char_length(trim(p_storage_reference)) not between 2 and 120 then
    raise exception 'Storage reference must be between 2 and 120 characters' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note is too long' using errcode = '22023';
  end if;

  insert into public.item_custody (
    item_id, university_id, checked_in_by, checked_in_at, storage_reference
  ) values (
    v_item.id, v_item.university_id, auth.uid(), now(), trim(p_storage_reference)
  )
  on conflict (item_id) do update
  set checked_in_by = excluded.checked_in_by,
      checked_in_at = excluded.checked_in_at,
      storage_reference = excluded.storage_reference,
      released_by = null,
      released_at = null,
      released_to_claim_id = null;

  insert into public.custody_events (
    item_id, university_id, kind, actor_id, note
  ) values (
    v_item.id, v_item.university_id, 'checked_in', auth.uid(), nullif(trim(p_note), '')
  );

  update public.found_items
  set status = 'in_admin_custody'
  where id = v_item.id;

  insert into public.notifications (
    recipient_id, kind, item_id, title, body, dedupe_key
  ) values (
    v_item.reporter_id,
    'admin_custody',
    v_item.id,
    'Handoff confirmed',
    'Lost & Found now has ' || v_item.title || '.',
    'admin-custody:' || v_item.id::text
  ) on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function public.complete_item_return(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims%rowtype;
  v_item public.found_items%rowtype;
  v_is_admin boolean;
begin
  select * into v_claim from public.claims where id = p_claim_id for update;
  select * into v_item from public.found_items where id = v_claim.item_id for update;
  v_is_admin := public.is_university_admin(auth.uid(), v_item.university_id);

  if v_claim.id is null or v_claim.status <> 'approved'
    or (v_item.reporter_id <> auth.uid() and not v_is_admin)
  then
    raise exception 'Approved claim not available' using errcode = '42501';
  end if;
  if v_item.status = 'in_admin_custody' and not v_is_admin then
    raise exception 'Lost & Found must confirm this return' using errcode = '42501';
  end if;

  update public.claims
  set status = 'completed', updated_at = now()
  where id = v_claim.id;

  update public.found_items
  set status = 'returned'
  where id = v_item.id;

  if exists (select 1 from public.item_custody where item_id = v_item.id and released_at is null) then
    update public.item_custody
    set released_by = auth.uid(),
        released_at = now(),
        released_to_claim_id = v_claim.id
    where item_id = v_item.id;

    insert into public.custody_events (
      item_id, university_id, kind, actor_id, claim_id, note
    ) values (
      v_item.id, v_item.university_id, 'released', auth.uid(), v_claim.id, 'Returned to verified owner.'
    );
  end if;

  insert into public.notifications (
    recipient_id, kind, item_id, title, body, dedupe_key
  ) values (
    v_claim.claimant_id,
    'item_returned',
    v_item.id,
    'Return complete',
    v_item.title || ' was marked as returned.',
    'item-returned:' || v_item.id::text
  ) on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function public.process_handoff_deadlines(
  p_now timestamptz default now()
)
returns table (reminders_queued integer, overdue_items integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reminders integer := 0;
  v_overdue integer := 0;
begin
  insert into public.notifications (
    recipient_id, kind, item_id, title, body, dedupe_key
  )
  select i.reporter_id,
         'handoff_reminder',
         i.id,
         'Handoff soon',
         'Take ' || i.title || ' to Lost & Found within one hour if it remains unclaimed.',
         'handoff-reminder:' || i.id::text
  from public.found_items i
  where i.status not in ('in_admin_custody', 'returned', 'archived')
    and i.reminder_sent_at is null
    and i.handoff_due_at > p_now
    and i.handoff_due_at <= p_now + interval '1 hour'
  on conflict (dedupe_key) do nothing;

  update public.found_items i
  set reminder_sent_at = p_now
  where i.status not in ('in_admin_custody', 'returned', 'archived')
    and i.reminder_sent_at is null
    and i.handoff_due_at > p_now
    and i.handoff_due_at <= p_now + interval '1 hour';
  get diagnostics v_reminders = row_count;

  insert into public.notifications (
    recipient_id, kind, item_id, title, body, dedupe_key
  )
  select i.reporter_id,
         'handoff_due',
         i.id,
         'Handoff due',
         'Take ' || i.title || ' to Lost & Found now.',
         'handoff-due-reporter:' || i.id::text
  from public.found_items i
  where i.status not in ('in_admin_custody', 'returned', 'archived')
    and i.overdue_notified_at is null
    and i.handoff_due_at <= p_now
  on conflict (dedupe_key) do nothing;

  insert into public.notifications (
    recipient_id, kind, item_id, title, body, dedupe_key
  )
  select p.id,
         'handoff_due',
         i.id,
         'Incoming handoff',
         i.title || ' is due at Lost & Found.',
         'handoff-due-admin:' || i.id::text || ':' || p.id::text
  from public.found_items i
  join public.profiles p
    on p.university_id = i.university_id and p.role = 'admin'
  where i.status not in ('in_admin_custody', 'returned', 'archived')
    and i.overdue_notified_at is null
    and i.handoff_due_at <= p_now
  on conflict (dedupe_key) do nothing;

  update public.found_items i
  set status = 'handoff_due',
      overdue_notified_at = p_now
  where i.status not in ('in_admin_custody', 'returned', 'archived')
    and i.overdue_notified_at is null
    and i.handoff_due_at <= p_now;
  get diagnostics v_overdue = row_count;

  return query select v_reminders, v_overdue;
end;
$$;

alter table public.universities enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.profile_role_audit enable row level security;
alter table public.university_join_codes enable row level security;
alter table public.found_items enable row level security;
alter table public.found_item_photos enable row level security;
alter table public.claims enable row level security;
alter table public.contact_reveal_audit enable row level security;
alter table public.item_custody enable row level security;
alter table public.custody_events enable row level security;
alter table public.item_status_history enable row level security;
alter table public.notifications enable row level security;

drop policy if exists universities_read_own on public.universities;
create policy universities_read_own
on public.universities for select
to authenticated
using (id = public.current_university_id());

drop policy if exists universities_admin_update on public.universities;
create policy universities_admin_update
on public.universities for update
to authenticated
using (public.is_university_admin(auth.uid(), id))
with check (public.is_university_admin(auth.uid(), id));

drop policy if exists profiles_read_same_university on public.profiles;
create policy profiles_read_same_university
on public.profiles for select
to authenticated
using (university_id = public.current_university_id());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and university_id = public.current_university_id()
);

drop policy if exists profile_contacts_read_owner_or_admin on public.profile_contacts;
create policy profile_contacts_read_owner_or_admin
on public.profile_contacts for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_university_admin(
    auth.uid(),
    (select p.university_id from public.profiles p where p.id = profile_id)
  )
);

drop policy if exists role_audit_read_subject_or_admin on public.profile_role_audit;
create policy role_audit_read_subject_or_admin
on public.profile_role_audit for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_university_admin(
    auth.uid(),
    (select p.university_id from public.profiles p where p.id = profile_id)
  )
);

drop policy if exists join_codes_admin_read on public.university_join_codes;
create policy join_codes_admin_read
on public.university_join_codes for select
to authenticated
using (public.is_university_admin(auth.uid(), university_id));

drop policy if exists found_items_read_same_university on public.found_items;
create policy found_items_read_same_university
on public.found_items for select
to authenticated
using (university_id = public.current_university_id());

drop policy if exists found_items_create_self on public.found_items;
create policy found_items_create_self
on public.found_items for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and university_id = public.current_university_id()
  and status = 'listed'
);

drop policy if exists found_items_edit_reporter_or_admin on public.found_items;
create policy found_items_edit_reporter_or_admin
on public.found_items for update
to authenticated
using (
  university_id = public.current_university_id()
  and (
    public.is_university_admin(auth.uid(), university_id)
    or (reporter_id = auth.uid() and status not in ('in_admin_custody', 'returned', 'archived'))
  )
)
with check (
  university_id = public.current_university_id()
  and (
    public.is_university_admin(auth.uid(), university_id)
    or reporter_id = auth.uid()
  )
);

drop policy if exists found_item_photos_read_same_university on public.found_item_photos;
create policy found_item_photos_read_same_university
on public.found_item_photos for select
to authenticated
using (
  exists (
    select 1 from public.found_items i
    where i.id = item_id
      and i.university_id = public.current_university_id()
  )
);

drop policy if exists found_item_photos_create_owner_or_admin on public.found_item_photos;
create policy found_item_photos_create_owner_or_admin
on public.found_item_photos for insert
to authenticated
with check (
  uploader_id = auth.uid()
  and exists (
    select 1 from public.found_items i
    where i.id = item_id
      and i.university_id = public.current_university_id()
      and i.status not in ('returned', 'archived')
      and (
        i.reporter_id = auth.uid()
        or public.is_university_admin(auth.uid(), i.university_id)
      )
  )
);

drop policy if exists found_item_photos_delete_owner_or_admin on public.found_item_photos;
create policy found_item_photos_delete_owner_or_admin
on public.found_item_photos for delete
to authenticated
using (
  exists (
    select 1 from public.found_items i
    where i.id = item_id
      and i.university_id = public.current_university_id()
      and i.status not in ('returned', 'archived')
      and (
        uploader_id = auth.uid()
        or public.is_university_admin(auth.uid(), i.university_id)
      )
  )
);

drop policy if exists claims_read_participants_or_admin on public.claims;
create policy claims_read_participants_or_admin
on public.claims for select
to authenticated
using (
  claimant_id = auth.uid()
  or public.is_university_admin(auth.uid(), university_id)
  or exists (
    select 1 from public.found_items i
    where i.id = item_id and i.reporter_id = auth.uid()
  )
);

drop policy if exists claims_create_self on public.claims;
create policy claims_create_self
on public.claims for insert
to authenticated
with check (
  claimant_id = auth.uid()
  and university_id = public.current_university_id()
  and status = 'pending'
);

drop policy if exists contact_audit_read_involved_or_admin on public.contact_reveal_audit;
create policy contact_audit_read_involved_or_admin
on public.contact_reveal_audit for select
to authenticated
using (
  viewer_id = auth.uid()
  or contact_owner_id = auth.uid()
  or exists (
    select 1
    from public.found_items i
    where i.id = item_id
      and public.is_university_admin(auth.uid(), i.university_id)
  )
);

drop policy if exists custody_read_admin on public.item_custody;
create policy custody_read_admin
on public.item_custody for select
to authenticated
using (public.is_university_admin(auth.uid(), university_id));

drop policy if exists custody_events_read_admin on public.custody_events;
create policy custody_events_read_admin
on public.custody_events for select
to authenticated
using (public.is_university_admin(auth.uid(), university_id));

drop policy if exists status_history_read_same_university on public.item_status_history;
create policy status_history_read_same_university
on public.item_status_history for select
to authenticated
using (
  exists (
    select 1 from public.found_items i
    where i.id = item_id
      and i.university_id = public.current_university_id()
  )
);

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own
on public.notifications for select
to authenticated
using (recipient_id = auth.uid());

drop policy if exists notifications_mark_own_read on public.notifications;
create policy notifications_mark_own_read
on public.notifications for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create or replace view public.found_item_cards
with (security_invoker = true)
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
    select p.storage_path
    from public.found_item_photos p
    where p.item_id = i.id
    order by p.sort_order, p.created_at
    limit 1
  ) as cover_photo_path,
  i.created_at
from public.found_items i
where i.status <> 'archived';

revoke all on table public.universities from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.profile_contacts from anon, authenticated;
revoke all on table public.profile_role_audit from anon, authenticated;
revoke all on table public.university_join_codes from anon, authenticated;
revoke all on table public.found_items from anon, authenticated;
revoke all on table public.found_item_photos from anon, authenticated;
revoke all on table public.claims from anon, authenticated;
revoke all on table public.contact_reveal_audit from anon, authenticated;
revoke all on table public.item_custody from anon, authenticated;
revoke all on table public.custody_events from anon, authenticated;
revoke all on table public.item_status_history from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.found_item_cards from anon, authenticated;

grant usage on type public.app_role, public.item_status, public.claim_status,
  public.custody_event_kind, public.notification_kind to authenticated;

grant select on table public.universities to authenticated;
grant update (lost_found_name, lost_found_location, lost_found_phone_e164)
  on table public.universities to authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, avatar_path) on table public.profiles to authenticated;
grant select on table public.profile_contacts to authenticated;
grant select on table public.profile_role_audit to authenticated;
grant select on table public.found_items to authenticated;
grant insert (title, description, category, color, location_found, found_at)
  on table public.found_items to authenticated;
grant update (title, description, category, color, location_found)
  on table public.found_items to authenticated;
grant select on table public.found_item_photos to authenticated;
grant insert (item_id, storage_path, mime_type, width, height, blurhash, sort_order)
  on table public.found_item_photos to authenticated;
grant delete on table public.found_item_photos to authenticated;
grant select on table public.claims to authenticated;
grant insert (item_id, message, proof_description) on table public.claims to authenticated;
grant select on table public.contact_reveal_audit to authenticated;
grant select on table public.item_custody to authenticated;
grant select on table public.custody_events to authenticated;
grant select on table public.item_status_history to authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant select on table public.found_item_cards to authenticated;

revoke all on function public.current_university_id() from public;
revoke all on function public.is_university_admin(uuid, uuid) from public;
revoke all on function public.path_segment_uuid(text, integer) from public;
revoke all on function public.can_view_item_photo_path(text) from public;
revoke all on function public.can_manage_item_photo_path(text) from public;
revoke all on function public.touch_updated_at() from public;
revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.audit_profile_role_change() from public;
revoke all on function public.set_found_item_defaults() from public;
revoke all on function public.set_handoff_due_at() from public;
revoke all on function public.validate_found_item_photo() from public;
revoke all on function public.set_claim_defaults() from public;
revoke all on function public.after_claim_created() from public;
revoke all on function public.audit_item_status_change() from public;
revoke all on function public.set_profile_role(uuid, public.app_role) from public;
revoke all on function public.create_university_join_code(text, timestamptz, integer) from public;
revoke all on function public.list_university_join_codes() from public;
revoke all on function public.set_join_code_active(uuid, boolean) from public;
revoke all on function public.update_my_contact(text) from public;
revoke all on function public.reveal_item_contact(uuid) from public;
revoke all on function public.review_claim(uuid, boolean, text) from public;
revoke all on function public.cancel_my_claim(uuid) from public;
revoke all on function public.accept_item_into_custody(uuid, text, text) from public;
revoke all on function public.complete_item_return(uuid) from public;
revoke all on function public.process_handoff_deadlines(timestamptz) from public;

grant execute on function public.current_university_id() to authenticated;
grant execute on function public.is_university_admin(uuid, uuid) to authenticated;
grant execute on function public.path_segment_uuid(text, integer) to authenticated;
grant execute on function public.can_view_item_photo_path(text) to authenticated;
grant execute on function public.can_manage_item_photo_path(text) to authenticated;
grant execute on function public.set_profile_role(uuid, public.app_role) to authenticated;
grant execute on function public.create_university_join_code(text, timestamptz, integer) to authenticated;
grant execute on function public.list_university_join_codes() to authenticated;
grant execute on function public.set_join_code_active(uuid, boolean) to authenticated;
grant execute on function public.update_my_contact(text) to authenticated;
grant execute on function public.reveal_item_contact(uuid) to authenticated;
grant execute on function public.review_claim(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_my_claim(uuid) to authenticated;
grant execute on function public.accept_item_into_custody(uuid, text, text) to authenticated;
grant execute on function public.complete_item_return(uuid) to authenticated;
grant execute on function public.process_handoff_deadlines(timestamptz) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'found-item-photos',
  'found-item-photos',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists found_item_photo_objects_read on storage.objects;
create policy found_item_photo_objects_read
on storage.objects for select
to authenticated
using (
  bucket_id = 'found-item-photos'
  and public.can_view_item_photo_path(name)
);

drop policy if exists found_item_photo_objects_create on storage.objects;
create policy found_item_photo_objects_create
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'found-item-photos'
  and public.can_manage_item_photo_path(name)
);

drop policy if exists found_item_photo_objects_update on storage.objects;
create policy found_item_photo_objects_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'found-item-photos'
  and public.can_manage_item_photo_path(name)
)
with check (
  bucket_id = 'found-item-photos'
  and public.can_manage_item_photo_path(name)
);

drop policy if exists found_item_photo_objects_delete on storage.objects;
create policy found_item_photo_objects_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'found-item-photos'
  and public.can_manage_item_photo_path(name)
);

commit;
