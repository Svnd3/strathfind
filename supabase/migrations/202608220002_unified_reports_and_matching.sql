begin;

do $$
begin
  create type public.report_kind as enum ('lost', 'found');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.item_flag_reason as enum (
    'spam',
    'duplicate',
    'incorrect',
    'unsafe',
    'inappropriate',
    'other'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.item_flag_status as enum ('open', 'dismissed', 'actioned');
exception
  when duplicate_object then null;
end
$$;

alter table public.profiles
  add column if not exists student_number text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_student_number_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_student_number_format_check
      check (
        student_number is null
        or student_number ~ '^[A-Z0-9][A-Z0-9._/-]{2,31}$'
      );
  end if;
end
$$;

create unique index if not exists profiles_university_student_number_unique
  on public.profiles (university_id, lower(student_number))
  where student_number is not null;

alter table public.found_items
  add column if not exists kind public.report_kind not null default 'found';
alter table public.found_items
  add column if not exists handoff_point text;
alter table public.found_items
  alter column handoff_due_at drop not null;
alter table public.found_items
  alter column handoff_due_at drop default;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.found_items'::regclass
      and conname = 'found_items_kind_handoff_deadline_check'
  ) then
    alter table public.found_items
      add constraint found_items_kind_handoff_deadline_check
      check (
        (kind = 'found' and handoff_due_at is not null)
        or (kind = 'lost' and handoff_due_at is null)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.found_items'::regclass
      and conname = 'found_items_handoff_point_check'
  ) then
    alter table public.found_items
      add constraint found_items_handoff_point_check
      check (
        (kind = 'lost' and handoff_point is null)
        or (
          kind = 'found'
          and (handoff_point is null or char_length(trim(handoff_point)) between 2 and 120)
        )
      );
  end if;
end
$$;

create table if not exists public.item_verification_questions (
  item_id uuid primary key references public.found_items(id) on delete cascade,
  question text not null check (char_length(trim(question)) between 5 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The answer to an ownership question is deliberately not stored. A claimant's
-- private response belongs in claims.proof_description for human review.

create table if not exists public.item_flags (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.found_items(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete restrict,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  reason public.item_flag_reason not null,
  details text not null check (char_length(trim(details)) between 10 and 1000),
  status public.item_flag_status not null default 'open',
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  resolution_note text check (
    resolution_note is null or char_length(trim(resolution_note)) between 3 and 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'open' and reviewed_by is null and reviewed_at is null)
    or (status <> 'open' and reviewed_by is not null and reviewed_at is not null)
  )
);

create table if not exists public.item_handoff_tokens (
  item_id uuid primary key references public.found_items(id) on delete cascade,
  token_hash bytea not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  failed_attempts smallint not null default 0 check (failed_attempts between 0 and 5),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop index if exists public.found_items_handoff_due_idx;
create index if not exists found_items_handoff_due_idx
  on public.found_items (handoff_due_at)
  where kind = 'found'
    and status not in ('return_arranged', 'in_admin_custody', 'returned', 'archived');

create index if not exists found_items_matching_idx
  on public.found_items (university_id, kind, category, found_at desc)
  where status not in ('returned', 'archived');

create unique index if not exists item_flags_one_open_per_student_item
  on public.item_flags (item_id, submitted_by)
  where status = 'open';

create index if not exists item_flags_admin_queue_idx
  on public.item_flags (university_id, status, created_at desc);

create or replace function public.normalize_match_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(trim(coalesce(p_value, ''))), '\s+', ' ', 'g')
$$;

create or replace function public.mask_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_phone is null then null
    when char_length(p_phone) <= 8 then repeat('•', greatest(char_length(p_phone) - 4, 0)) || right(p_phone, 4)
    else left(p_phone, 4) || repeat('•', char_length(p_phone) - 8) || right(p_phone, 4)
  end
$$;

create or replace function public.mask_display_name(p_display_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  with normalized as (
    select regexp_replace(trim(coalesce(p_display_name, '')), '\s+', ' ', 'g') as value
  )
  select case
    when p_display_name is null or value = '' then null
    when position(' ' in value) = 0 then value
    else split_part(value, ' ', 1)
      || ' '
      || left((regexp_split_to_array(value, ' '))[array_length(regexp_split_to_array(value, ' '), 1)], 1)
      || '.'
  end
  from normalized
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
  v_student_number text;
begin
  v_code := lower(trim(coalesce(new.raw_user_meta_data ->> 'university_code', '')));
  v_display_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  v_phone := trim(coalesce(new.raw_user_meta_data ->> 'phone_e164', ''));
  v_student_number := upper(trim(coalesce(new.raw_user_meta_data ->> 'student_number', '')));

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
  if v_student_number !~ '^[A-Z0-9][A-Z0-9._/-]{2,31}$' then
    raise exception 'Student number must be 3-32 letters, numbers, dots, slashes, underscores, or hyphens'
      using errcode = '22023';
  end if;

  insert into public.profiles (
    id, university_id, role, display_name, student_number
  ) values (
    new.id, v_university_id, 'student', v_display_name, v_student_number
  );

  insert into public.profile_contacts (profile_id, phone_e164)
  values (new.id, v_phone);

  update auth.users
  set raw_user_meta_data = raw_user_meta_data
    - 'university_code'
    - 'student_number'
    - 'role'
    - 'university_id'
  where id = new.id;

  return new;
exception
  when unique_violation then
    raise exception 'That student number is already registered at this university'
      using errcode = '23505';
end;
$$;

create or replace function public.set_handoff_due_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'found' then
    new.handoff_due_at := new.found_at + interval '24 hours';
  else
    new.handoff_due_at := null;
    new.handoff_point := null;
  end if;
  return new;
end;
$$;

create or replace function public.masked_item_contact(p_item_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_item public.found_items%rowtype;
  v_phone text;
begin
  select * into v_item from public.found_items where id = p_item_id;
  if v_item.id is null
    or v_item.university_id is distinct from public.current_university_id()
  then
    return null;
  end if;

  if v_item.status = 'in_admin_custody' then
    select u.lost_found_phone_e164 into v_phone
    from public.universities u
    where u.id = v_item.university_id;
  else
    select c.phone_e164 into v_phone
    from public.profile_contacts c
    where c.profile_id = v_item.reporter_id;
  end if;

  return public.mask_phone(v_phone);
end;
$$;

create or replace function public.create_item_report(
  p_kind public.report_kind,
  p_title text,
  p_description text,
  p_category text,
  p_color text,
  p_location text,
  p_observed_at timestamptz,
  p_ownership_question text,
  p_handoff_point text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_item_id uuid;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_kind is null then
    raise exception 'Report kind is required' using errcode = '22023';
  end if;
  if p_observed_at is null or p_observed_at > now() + interval '5 minutes' then
    raise exception 'Occurrence time is invalid' using errcode = '22023';
  end if;
  if char_length(trim(p_ownership_question)) not between 5 and 200 then
    raise exception 'Ownership question must be between 5 and 200 characters' using errcode = '22023';
  end if;
  if p_kind = 'lost' and nullif(trim(p_handoff_point), '') is not null then
    raise exception 'Lost reports cannot have a handoff point' using errcode = '22023';
  end if;

  insert into public.found_items (
    kind,
    title,
    description,
    category,
    color,
    location_found,
    found_at,
    handoff_point
  ) values (
    p_kind,
    trim(p_title),
    trim(coalesce(p_description, '')),
    trim(p_category),
    nullif(trim(p_color), ''),
    trim(p_location),
    p_observed_at,
    case when p_kind = 'found' then nullif(trim(p_handoff_point), '') else null end
  ) returning id into v_item_id;

  insert into public.item_verification_questions (item_id, question)
  values (v_item_id, trim(p_ownership_question));

  return v_item_id;
end;
$$;

create or replace function public.get_item_verification_question(p_item_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_question text;
begin
  select q.question into v_question
  from public.item_verification_questions q
  join public.found_items i on i.id = q.item_id
  where q.item_id = p_item_id
    and i.university_id = public.current_university_id()
    and i.status <> 'archived';

  if v_question is null then
    raise exception 'Report not available' using errcode = '42501';
  end if;
  return v_question;
end;
$$;

create or replace function public.update_item_verification_question(
  p_item_id uuid,
  p_question text
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
    or (
      v_item.reporter_id <> auth.uid()
      and not public.is_university_admin(auth.uid(), v_item.university_id)
    )
  then
    raise exception 'Report not available' using errcode = '42501';
  end if;
  if v_item.status in ('returned', 'archived') then
    raise exception 'Closed reports cannot be edited' using errcode = '22023';
  end if;
  if char_length(trim(p_question)) not between 5 and 200 then
    raise exception 'Ownership question must be between 5 and 200 characters' using errcode = '22023';
  end if;

  insert into public.item_verification_questions (item_id, question)
  values (p_item_id, trim(p_question))
  on conflict (item_id) do update
  set question = excluded.question,
      updated_at = now();
end;
$$;

create or replace function public.get_my_profile()
returns table (
  id uuid,
  university_id uuid,
  role public.app_role,
  display_name text,
  student_number text,
  avatar_path text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.university_id, p.role, p.display_name,
         p.student_number, p.avatar_path, p.created_at, p.updated_at
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function public.list_university_members()
returns table (
  id uuid,
  role public.app_role,
  display_name text,
  student_number text,
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
  select p.* into v_actor from public.profiles p where p.id = auth.uid();
  if v_actor.id is null or v_actor.role <> 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return query
  select p.id, p.role, p.display_name, p.student_number, p.created_at
  from public.profiles p
  where p.university_id = v_actor.university_id
  order by p.display_name, p.created_at;
end;
$$;

create or replace function public.submit_item_flag(
  p_item_id uuid,
  p_reason public.item_flag_reason,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_item public.found_items%rowtype;
  v_flag_id uuid;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  select * into v_item from public.found_items where id = p_item_id;

  if v_actor.id is null
    or v_item.id is null
    or v_actor.university_id <> v_item.university_id
    or v_item.status = 'archived'
  then
    raise exception 'Report not available' using errcode = '42501';
  end if;
  if p_reason is null then
    raise exception 'A flag reason is required' using errcode = '22023';
  end if;
  if char_length(trim(p_details)) not between 10 and 1000 then
    raise exception 'Flag details must be between 10 and 1000 characters'
      using errcode = '22023';
  end if;

  select f.id into v_flag_id
  from public.item_flags f
  where f.item_id = v_item.id
    and f.submitted_by = v_actor.id
    and f.status = 'open';

  if v_flag_id is not null then
    return v_flag_id;
  end if;

  insert into public.item_flags (
    item_id, university_id, submitted_by, reason, details
  ) values (
    v_item.id, v_actor.university_id, v_actor.id, p_reason, trim(p_details)
  ) returning id into v_flag_id;

  return v_flag_id;
exception
  when unique_violation then
    select f.id into v_flag_id
    from public.item_flags f
    where f.item_id = p_item_id
      and f.submitted_by = auth.uid()
      and f.status = 'open';
    return v_flag_id;
end;
$$;

create or replace function public.list_visible_item_flags(p_item_id uuid default null)
returns table (
  id uuid,
  item_id uuid,
  reason public.item_flag_reason,
  details text,
  status public.item_flag_status,
  submitted_by uuid,
  reviewed_at timestamptz,
  resolution_note text,
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
  select p.* into v_actor from public.profiles p where p.id = auth.uid();
  if v_actor.id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    f.id,
    f.item_id,
    f.reason,
    f.details,
    f.status,
    case
      when v_actor.role = 'admin' or f.submitted_by = v_actor.id then f.submitted_by
      else null
    end,
    f.reviewed_at,
    f.resolution_note,
    f.created_at,
    f.updated_at
  from public.item_flags f
  join public.found_items i on i.id = f.item_id
  where f.university_id = v_actor.university_id
    and (p_item_id is null or f.item_id = p_item_id)
    and (
      v_actor.role = 'admin'
      or f.submitted_by = v_actor.id
      or i.reporter_id = v_actor.id
    )
  order by
    case when f.status = 'open' then 0 else 1 end,
    f.created_at desc,
    f.id;
end;
$$;

create or replace function public.review_item_flag(
  p_flag_id uuid,
  p_status public.item_flag_status,
  p_resolution_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_flag public.item_flags%rowtype;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  select * into v_flag from public.item_flags where id = p_flag_id for update;

  if v_actor.id is null
    or v_actor.role <> 'admin'
    or v_flag.id is null
    or v_flag.university_id <> v_actor.university_id
  then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_status not in ('dismissed', 'actioned') then
    raise exception 'Review status must be dismissed or actioned' using errcode = '22023';
  end if;
  if v_flag.status <> 'open' then
    raise exception 'Flag has already been reviewed' using errcode = '22023';
  end if;
  if char_length(trim(p_resolution_note)) not between 3 and 500 then
    raise exception 'Resolution note must be between 3 and 500 characters'
      using errcode = '22023';
  end if;

  update public.item_flags
  set status = p_status,
      reviewed_by = v_actor.id,
      reviewed_at = now(),
      resolution_note = trim(p_resolution_note)
  where id = v_flag.id;
end;
$$;

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

  if v_viewer.id <> v_item.reporter_id
    and v_viewer.role <> 'admin'
    and not exists (
      select 1
      from public.claims c
      where c.item_id = v_item.id
        and c.claimant_id = v_viewer.id
        and c.status = 'approved'
    )
  then
    raise exception 'An approved claim is required before revealing contact details'
      using errcode = '42501';
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
    v_kind := case when v_item.kind = 'found' then 'finder' else 'owner' end;
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

create or replace function public.issue_item_handoff_code(p_item_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.found_items%rowtype;
  v_random bytea;
  v_code_number bigint;
  v_code text;
begin
  select * into v_item from public.found_items where id = p_item_id for update;
  if v_item.id is null
    or v_item.reporter_id <> auth.uid()
    or v_item.kind <> 'found'
    or v_item.status in ('in_admin_custody', 'returned', 'archived')
  then
    raise exception 'Found report not available for handoff' using errcode = '42501';
  end if;

  v_random := extensions.gen_random_bytes(4);
  v_code_number := (
      get_byte(v_random, 0)::bigint * 16777216
    + get_byte(v_random, 1)::bigint * 65536
    + get_byte(v_random, 2)::bigint * 256
    + get_byte(v_random, 3)::bigint
  ) % 1000000;
  v_code := lpad(v_code_number::text, 6, '0');

  insert into public.item_handoff_tokens (
    item_id,
    token_hash,
    created_by,
    expires_at,
    failed_attempts,
    consumed_at
  ) values (
    v_item.id,
    extensions.digest(v_item.id::text || ':' || v_code, 'sha256'),
    auth.uid(),
    now() + interval '48 hours',
    0,
    null
  )
  on conflict (item_id) do update
  set token_hash = excluded.token_hash,
      created_by = excluded.created_by,
      expires_at = excluded.expires_at,
      failed_attempts = 0,
      consumed_at = null,
      updated_at = now();

  -- The plaintext code is returned once and is never stored.
  return v_code;
end;
$$;

-- The old three-argument RPC accepted only an item ID and storage reference.
-- Remove it so no client can bypass server-side handoff-code verification.
drop function if exists public.accept_item_into_custody(uuid, text, text);

create or replace function public.accept_item_into_custody(
  p_item_id uuid,
  p_storage_reference text,
  p_handoff_code text,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.found_items%rowtype;
  v_token public.item_handoff_tokens%rowtype;
begin
  select * into v_item from public.found_items where id = p_item_id for update;
  if v_item.id is null
    or not public.is_university_admin(auth.uid(), v_item.university_id)
  then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if v_item.kind <> 'found' then
    raise exception 'Only found reports can enter Lost & Found custody' using errcode = '22023';
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

  select * into v_token
  from public.item_handoff_tokens
  where item_id = v_item.id
  for update;

  if v_token.item_id is null
    or v_token.consumed_at is not null
    or v_token.expires_at <= now()
    or v_token.failed_attempts >= 5
  then
    return false;
  end if;

  if p_handoff_code is null
    or p_handoff_code !~ '^[0-9]{6}$'
    or v_token.token_hash <> extensions.digest(
      v_item.id::text || ':' || p_handoff_code,
      'sha256'
    )
  then
    -- Return false instead of raising so the failed-attempt counter commits.
    update public.item_handoff_tokens
    set failed_attempts = least(failed_attempts + 1, 5),
        updated_at = now()
    where item_id = v_item.id;
    return false;
  end if;

  update public.item_handoff_tokens
  set consumed_at = now(),
      updated_at = now()
  where item_id = v_item.id;

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

  return true;
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
  where i.kind = 'found'
    and i.status not in ('return_arranged', 'in_admin_custody', 'returned', 'archived')
    and i.reminder_sent_at is null
    and i.handoff_due_at > p_now
    and i.handoff_due_at <= p_now + interval '1 hour'
  on conflict (dedupe_key) do nothing;

  update public.found_items i
  set reminder_sent_at = p_now
  where i.kind = 'found'
    and i.status not in ('return_arranged', 'in_admin_custody', 'returned', 'archived')
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
  where i.kind = 'found'
    and i.status not in ('return_arranged', 'in_admin_custody', 'returned', 'archived')
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
  where i.kind = 'found'
    and i.status not in ('return_arranged', 'in_admin_custody', 'returned', 'archived')
    and i.overdue_notified_at is null
    and i.handoff_due_at <= p_now
  on conflict (dedupe_key) do nothing;

  update public.found_items i
  set status = 'handoff_due',
      overdue_notified_at = p_now
  where i.kind = 'found'
    and i.status not in ('return_arranged', 'in_admin_custody', 'returned', 'archived')
    and i.overdue_notified_at is null
    and i.handoff_due_at <= p_now;
  get diagnostics v_overdue = row_count;

  return query select v_reminders, v_overdue;
end;
$$;

drop trigger if exists item_verification_questions_touch_updated_at
  on public.item_verification_questions;
create trigger item_verification_questions_touch_updated_at
before update on public.item_verification_questions
for each row execute function public.touch_updated_at();

drop trigger if exists item_flags_touch_updated_at on public.item_flags;
create trigger item_flags_touch_updated_at
before update on public.item_flags
for each row execute function public.touch_updated_at();

drop trigger if exists item_handoff_tokens_touch_updated_at
  on public.item_handoff_tokens;
create trigger item_handoff_tokens_touch_updated_at
before update on public.item_handoff_tokens
for each row execute function public.touch_updated_at();

alter table public.item_verification_questions enable row level security;
alter table public.item_flags enable row level security;
alter table public.item_handoff_tokens enable row level security;

drop policy if exists verification_questions_read_same_university
  on public.item_verification_questions;
create policy verification_questions_read_same_university
on public.item_verification_questions for select
to authenticated
using (
  exists (
    select 1
    from public.found_items i
    where i.id = item_id
      and i.university_id = public.current_university_id()
  )
);

drop policy if exists verification_questions_manage_reporter_or_admin
  on public.item_verification_questions;
create policy verification_questions_manage_reporter_or_admin
on public.item_verification_questions for update
to authenticated
using (
  exists (
    select 1
    from public.found_items i
    where i.id = item_id
      and (
        i.reporter_id = auth.uid()
        or public.is_university_admin(auth.uid(), i.university_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.found_items i
    where i.id = item_id
      and (
        i.reporter_id = auth.uid()
        or public.is_university_admin(auth.uid(), i.university_id)
      )
  )
);

drop policy if exists item_flags_read_visible on public.item_flags;
create policy item_flags_read_visible
on public.item_flags for select
to authenticated
using (
  university_id = public.current_university_id()
  and (
    submitted_by = auth.uid()
    or public.is_university_admin(auth.uid(), university_id)
    or exists (
      select 1
      from public.found_items i
      where i.id = item_id and i.reporter_id = auth.uid()
    )
  )
);

drop policy if exists item_flags_insert_same_university on public.item_flags;
create policy item_flags_insert_same_university
on public.item_flags for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and university_id = public.current_university_id()
  and status = 'open'
  and reviewed_by is null
  and reviewed_at is null
  and exists (
    select 1
    from public.found_items i
    where i.id = item_id
      and i.university_id = public.current_university_id()
      and i.status <> 'archived'
  )
);

drop policy if exists item_flags_update_admin on public.item_flags;
create policy item_flags_update_admin
on public.item_flags for update
to authenticated
using (public.is_university_admin(auth.uid(), university_id))
with check (public.is_university_admin(auth.uid(), university_id));

drop policy if exists handoff_tokens_read_owner_or_admin
  on public.item_handoff_tokens;
create policy handoff_tokens_read_owner_or_admin
on public.item_handoff_tokens for select
to authenticated
using (
  exists (
    select 1
    from public.found_items i
    where i.id = item_id
      and i.university_id = public.current_university_id()
      and (
        i.reporter_id = auth.uid()
        or public.is_university_admin(auth.uid(), i.university_id)
      )
  )
);

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
    select photo.storage_path
    from public.found_item_photos photo
    where photo.item_id = i.id
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
where i.status <> 'archived';

revoke select on table public.profiles from authenticated;
grant select (
  id,
  university_id,
  role,
  display_name,
  avatar_path,
  created_at,
  updated_at
) on table public.profiles to authenticated;

revoke insert (title, description, category, color, location_found, found_at)
  on table public.found_items from authenticated;
grant update (handoff_point) on table public.found_items to authenticated;

revoke all on table public.item_verification_questions from anon, authenticated;
revoke all on table public.item_flags from anon, authenticated;
revoke all on table public.item_handoff_tokens from anon, authenticated;

revoke all on function public.normalize_match_text(text) from public;
revoke all on function public.mask_phone(text) from public;
revoke all on function public.mask_display_name(text) from public;
revoke all on function public.masked_item_contact(uuid) from public;
revoke all on function public.create_item_report(
  public.report_kind, text, text, text, text, text, timestamptz, text, text
) from public;
revoke all on function public.get_item_verification_question(uuid) from public;
revoke all on function public.update_item_verification_question(uuid, text) from public;
revoke all on function public.get_my_profile() from public;
revoke all on function public.list_university_members() from public;
revoke all on function public.submit_item_flag(
  uuid, public.item_flag_reason, text
) from public;
revoke all on function public.list_visible_item_flags(uuid) from public;
revoke all on function public.review_item_flag(
  uuid, public.item_flag_status, text
) from public;
revoke all on function public.possible_item_matches(uuid, integer) from public;
revoke all on function public.issue_item_handoff_code(uuid) from public;
revoke all on function public.accept_item_into_custody(
  uuid, text, text, text
) from public;

grant usage on type public.report_kind, public.item_flag_reason,
  public.item_flag_status to authenticated;
grant execute on function public.mask_phone(text) to authenticated;
grant execute on function public.mask_display_name(text) to authenticated;
grant execute on function public.masked_item_contact(uuid) to authenticated;
grant execute on function public.create_item_report(
  public.report_kind, text, text, text, text, text, timestamptz, text, text
) to authenticated;
grant execute on function public.get_item_verification_question(uuid) to authenticated;
grant execute on function public.update_item_verification_question(uuid, text) to authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.list_university_members() to authenticated;
grant execute on function public.submit_item_flag(
  uuid, public.item_flag_reason, text
) to authenticated;
grant execute on function public.list_visible_item_flags(uuid) to authenticated;
grant execute on function public.review_item_flag(
  uuid, public.item_flag_status, text
) to authenticated;
grant execute on function public.possible_item_matches(uuid, integer) to authenticated;
grant execute on function public.issue_item_handoff_code(uuid) to authenticated;
grant execute on function public.accept_item_into_custody(
  uuid, text, text, text
) to authenticated;

commit;
