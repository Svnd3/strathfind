begin;

-- These records are written by the signup trigger using a server timestamp.
-- Auth user metadata is only the transport for the user's explicit action; it
-- is removed after signup and is not treated as the durable audit record.
create table if not exists public.account_legal_acknowledgements (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_kind text not null check (
    document_kind in ('terms_of_use', 'privacy_notice')
  ),
  document_version text not null check (
    document_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ),
  action text not null check (
    (document_kind = 'terms_of_use' and action = 'accepted')
    or (document_kind = 'privacy_notice' and action = 'acknowledged')
  ),
  recorded_at timestamptz not null default clock_timestamp(),
  source text not null default 'signup' check (source in ('signup', 'reauth')),
  primary key (profile_id, document_kind, document_version)
);

comment on table public.account_legal_acknowledgements is
  'Append-only, server-timestamped account records for Terms acceptance and Privacy Notice acknowledgement. A Privacy Notice acknowledgement is not consent to optional processing.';

alter table public.account_legal_acknowledgements enable row level security;

drop policy if exists account_legal_acknowledgements_read_self
  on public.account_legal_acknowledgements;
create policy account_legal_acknowledgements_read_self
on public.account_legal_acknowledgements for select
to authenticated
using (profile_id = auth.uid());

revoke all on table public.account_legal_acknowledgements from public, anon, authenticated;
grant select (
  profile_id,
  document_kind,
  document_version,
  action,
  recorded_at,
  source
) on table public.account_legal_acknowledgements to authenticated;

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
  v_terms_accepted boolean;
  v_terms_version text;
  v_privacy_acknowledged boolean;
  v_privacy_version text;
begin
  v_code := lower(trim(coalesce(new.raw_user_meta_data ->> 'university_code', '')));
  v_display_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  v_phone := trim(coalesce(new.raw_user_meta_data ->> 'phone_e164', ''));
  v_student_number := upper(trim(coalesce(new.raw_user_meta_data ->> 'student_number', '')));
  v_terms_accepted := lower(trim(coalesce(new.raw_user_meta_data ->> 'terms_accepted', ''))) = 'true';
  v_terms_version := trim(coalesce(new.raw_user_meta_data ->> 'terms_version', ''));
  v_privacy_acknowledged := lower(trim(coalesce(new.raw_user_meta_data ->> 'privacy_notice_acknowledged', ''))) = 'true';
  v_privacy_version := trim(coalesce(new.raw_user_meta_data ->> 'privacy_notice_version', ''));

  if not v_terms_accepted or v_terms_version <> '2026-08-26' then
    raise exception 'Current Terms of Use acceptance is required'
      using errcode = '22023';
  end if;
  if not v_privacy_acknowledged or v_privacy_version <> '2026-08-26' then
    raise exception 'Current Privacy Notice acknowledgement is required'
      using errcode = '22023';
  end if;
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

  insert into public.account_legal_acknowledgements (
    profile_id, document_kind, document_version, action, source
  ) values
    (new.id, 'terms_of_use', v_terms_version, 'accepted', 'signup'),
    (new.id, 'privacy_notice', v_privacy_version, 'acknowledged', 'signup');

  update auth.users
  set raw_user_meta_data = raw_user_meta_data
    - 'university_code'
    - 'student_number'
    - 'role'
    - 'university_id'
    - 'terms_accepted'
    - 'terms_version'
    - 'privacy_notice_acknowledged'
    - 'privacy_notice_version'
    - 'display_name'
    - 'phone_e164'
  where id = new.id;

  return new;
exception
  when unique_violation then
    raise exception 'That student number is already registered at this university'
      using errcode = '23505';
end;
$$;

revoke all on function public.handle_new_auth_user() from public;

commit;
