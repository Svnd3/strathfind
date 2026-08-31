begin;

-- Google creates the Auth user before StrathFind can collect campus, contact,
-- and legal-onboarding fields. Leave only trusted Google signups profileless;
-- every other signup continues through the existing atomic email flow below.
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
  -- raw_app_meta_data is maintained by Supabase Auth. raw_user_meta_data is
  -- user-editable and must never be trusted to select this deferred path.
  if coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google' then
    return new;
  end if;

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

create or replace function public.complete_google_student_onboarding(
  p_display_name text,
  p_phone_e164 text,
  p_student_number text,
  p_university_code text,
  p_terms_accepted boolean,
  p_terms_version text,
  p_privacy_notice_acknowledged boolean,
  p_privacy_notice_version text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_existing_profile_id uuid;
  v_code text;
  v_university_id uuid;
  v_display_name text;
  v_phone text;
  v_student_number text;
  v_terms_version text;
  v_privacy_version text;
  v_constraint_name text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Serialize retries for one Auth user. A second call waits, then observes the
  -- complete profile and returns without redeeming another join-code use.
  perform 1
  from auth.users u
  where u.id = v_user_id
  for update;

  if not found then
    raise exception 'Authenticated user does not exist' using errcode = '42501';
  end if;

  -- The identity table is maintained by Supabase Auth and cannot be forged by
  -- browser-editable user metadata or by an RPC argument.
  if not exists (
    select 1
    from auth.identities i
    where i.user_id = v_user_id
      and i.provider = 'google'
  ) then
    raise exception 'Google authentication is required' using errcode = '42501';
  end if;

  select profile.id into v_existing_profile_id
  from public.profiles profile
  where profile.id = v_user_id;

  if v_existing_profile_id is not null then
    if not exists (
      select 1
      from public.profile_contacts contact
      where contact.profile_id = v_user_id
    ) or (
      select count(*)
      from public.account_legal_acknowledgements acknowledgement
      where acknowledgement.profile_id = v_user_id
        and acknowledgement.document_version = '2026-08-26'
        and (
          (
            acknowledgement.document_kind = 'terms_of_use'
            and acknowledgement.action = 'accepted'
          )
          or (
            acknowledgement.document_kind = 'privacy_notice'
            and acknowledgement.action = 'acknowledged'
          )
        )
    ) <> 2 then
      raise exception 'Account profile is incomplete; contact support'
        using errcode = '55000';
    end if;

    return v_existing_profile_id;
  end if;

  v_code := lower(trim(coalesce(p_university_code, '')));
  v_display_name := trim(coalesce(p_display_name, ''));
  v_phone := trim(coalesce(p_phone_e164, ''));
  v_student_number := upper(trim(coalesce(p_student_number, '')));
  v_terms_version := trim(coalesce(p_terms_version, ''));
  v_privacy_version := trim(coalesce(p_privacy_notice_version, ''));

  if p_terms_accepted is distinct from true
    or v_terms_version <> '2026-08-26'
  then
    raise exception 'Current Terms of Use acceptance is required'
      using errcode = '22023';
  end if;
  if p_privacy_notice_acknowledged is distinct from true
    or v_privacy_version <> '2026-08-26'
  then
    raise exception 'Current Privacy Notice acknowledgement is required'
      using errcode = '22023';
  end if;
  if v_code = '' or char_length(v_code) > 128 then
    raise exception 'A valid university code is required' using errcode = '22023';
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

  begin
    insert into public.profiles (
      id, university_id, role, display_name, student_number
    ) values (
      v_user_id,
      v_university_id,
      'student'::public.app_role,
      v_display_name,
      v_student_number
    );
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name = 'profiles_university_student_number_unique' then
        raise exception 'That student number is already registered at this university'
          using errcode = '23505';
      end if;
      raise;
  end;

  insert into public.profile_contacts (profile_id, phone_e164)
  values (v_user_id, v_phone);

  insert into public.account_legal_acknowledgements (
    profile_id, document_kind, document_version, action, source
  ) values
    (v_user_id, 'terms_of_use', v_terms_version, 'accepted', 'signup'),
    (v_user_id, 'privacy_notice', v_privacy_version, 'acknowledged', 'signup');

  -- Remove one-time PII, legal flags, join credentials, and any misleading
  -- authority fields while preserving Google-owned name/avatar metadata.
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
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
  where id = v_user_id;

  return v_user_id;
end;
$$;

revoke all on function public.complete_google_student_onboarding(
  text, text, text, text, boolean, text, boolean, text
) from public, anon, authenticated;
grant execute on function public.complete_google_student_onboarding(
  text, text, text, text, boolean, text, boolean, text
) to authenticated;

comment on function public.complete_google_student_onboarding(
  text, text, text, text, boolean, text, boolean, text
) is
  'Atomically completes a profileless Google signup as a student after checking the server-owned Google identity, current legal versions, and an active university join code. Safe to retry.';

commit;
