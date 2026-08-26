-- Run after migrations and supabase/seed.sql have been applied.
-- This is a transactional regression script: any failed assertion aborts and
-- all fixtures are rolled back at the end.

begin;

create or replace function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'StrathFind assertion failed: %', p_message;
  end if;
end;
$$;

create temporary table strathfind_test_state (
  key text primary key,
  value text not null
) on commit drop;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'finder@strathfind.test',
    'authenticated',
    'authenticated',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Finder One","phone_e164":"+254700000001","university_code":"SF-DEMO-2026","student_number":"std/001","role":"admin","terms_accepted":true,"terms_version":"2026-08-26","privacy_notice_acknowledged":true,"privacy_notice_version":"2026-08-26"}',
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'claimant@strathfind.test',
    'authenticated',
    'authenticated',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Claimant Two","phone_e164":"+254700000002","university_code":"SF-DEMO-2026","student_number":"STD/002","terms_accepted":true,"terms_version":"2026-08-26","privacy_notice_acknowledged":true,"privacy_notice_version":"2026-08-26"}',
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'admin@strathfind.test',
    'authenticated',
    'authenticated',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Admin Three","phone_e164":"+254700000003","university_code":"SF-DEMO-2026","student_number":"STD/003","terms_accepted":true,"terms_version":"2026-08-26","privacy_notice_acknowledged":true,"privacy_notice_version":"2026-08-26"}',
    now(),
    now()
  );

select pg_temp.assert_true(
  (
    select role = 'student' and student_number = 'STD/001'
    from public.profiles
    where id = '10000000-0000-4000-8000-000000000001'
  ),
  'signup forces student role and normalizes student_number'
);

select pg_temp.assert_true(
  (
    select not (
      raw_user_meta_data ? 'university_code'
      or raw_user_meta_data ? 'student_number'
      or raw_user_meta_data ? 'role'
      or raw_user_meta_data ? 'university_id'
      or raw_user_meta_data ? 'terms_accepted'
      or raw_user_meta_data ? 'terms_version'
      or raw_user_meta_data ? 'privacy_notice_acknowledged'
      or raw_user_meta_data ? 'privacy_notice_version'
      or raw_user_meta_data ? 'display_name'
      or raw_user_meta_data ? 'phone_e164'
    )
    from auth.users
    where id = '10000000-0000-4000-8000-000000000001'
  ),
  'signup removes sensitive, reusable, or authority-like Auth metadata'
);

select pg_temp.assert_true(
  (
    select count(*) = 2
      and bool_and(recorded_at <= clock_timestamp())
    from public.account_legal_acknowledgements
    where profile_id = '10000000-0000-4000-8000-000000000001'
      and document_version = '2026-08-26'
  ),
  'signup records server-timestamped Terms acceptance and Privacy Notice acknowledgement'
);

do $$
begin
  begin
    insert into auth.users (
      id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '10000000-0000-4000-8000-000000000098',
      'no-terms@strathfind.test',
      'authenticated',
      'authenticated',
      '{"provider":"email","providers":["email"]}',
      '{"display_name":"No Terms","phone_e164":"+254700000098","university_code":"SF-DEMO-2026","student_number":"STD/098"}',
      now(),
      now()
    );
    raise exception 'signup without legal acceptance unexpectedly succeeded';
  exception
    when sqlstate '22023' then null;
  end;
end;
$$;

select pg_temp.assert_true(
  not exists (
    select 1 from public.profiles
    where id = '10000000-0000-4000-8000-000000000098'
  ),
  'signup rejects missing current legal acceptance'
);

do $$
begin
  begin
    insert into auth.users (
      id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '10000000-0000-4000-8000-000000000099',
      'duplicate@strathfind.test',
      'authenticated',
      'authenticated',
      '{"provider":"email","providers":["email"]}',
      '{"display_name":"Duplicate Student","phone_e164":"+254700000099","university_code":"SF-DEMO-2026","student_number":"std/001","terms_accepted":true,"terms_version":"2026-08-26","privacy_notice_acknowledged":true,"privacy_notice_version":"2026-08-26"}',
      now(),
      now()
    );
    raise exception 'duplicate student number unexpectedly succeeded';
  exception
    when unique_violation then null;
  end;
end;
$$;

update public.profiles
set role = 'admin'
where id = '10000000-0000-4000-8000-000000000003';

insert into public.universities (id, name, slug)
values (
  '20000000-0000-4000-8000-000000000001',
  'Other Test University',
  'other-test-university'
);

insert into public.university_join_codes (university_id, code_hash, label)
values (
  '20000000-0000-4000-8000-000000000001',
  extensions.digest('other-2026', 'sha256'),
  'Cross-campus regression code'
);

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-000000000004',
  'outsider@strathfind.test',
  'authenticated',
  'authenticated',
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Outside Student","phone_e164":"+254700000004","university_code":"OTHER-2026","student_number":"STD/001","terms_accepted":true,"terms_version":"2026-08-26","privacy_notice_acknowledged":true,"privacy_notice_version":"2026-08-26"}',
  now(),
  now()
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);

insert into strathfind_test_state (key, value)
select 'lost_item', public.create_item_report(
  'lost',
  'Black wallet',
  'Leather wallet',
  'Wallet',
  'Black',
  'Library west',
  now() - interval '2 hours',
  'What is inside the wallet?',
  null
)::text;

insert into strathfind_test_state (key, value)
select 'found_item', public.create_item_report(
  'found',
  'Found black wallet',
  'Small leather wallet',
  'wallet',
  'black',
  'Library west wing',
  now() - interval '1 hour',
  'Which cards are inside?',
  'Student Centre'
)::text;

-- Model a pre-003 object key so both safe report surfaces prove they ignore
-- legacy paths containing an uploader UUID during an upgrade.
alter table public.found_item_photos disable trigger found_item_photos_validate;

insert into public.found_item_photos (
  item_id,
  uploader_id,
  storage_path,
  mime_type,
  sort_order
)
select
  value::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000101/10000000-0000-4000-8000-000000000001/'
    || value || '/legacy-cover.jpg',
  'image/jpeg',
  0
from strathfind_test_state
where key = 'found_item';

alter table public.found_item_photos enable trigger found_item_photos_validate;

do $$
begin
  begin
    insert into public.found_item_photos (item_id, storage_path, mime_type)
    select
      value::uuid,
      '00000000-0000-4000-8000-000000000101/10000000-0000-4000-8000-000000000001/'
        || value || '/legacy-rejected.jpg',
      'image/jpeg'
    from strathfind_test_state
    where key = 'found_item';
    raise exception 'legacy user-id-bearing photo path unexpectedly succeeded';
  exception
    when invalid_parameter_value then null;
  end;
end;
$$;

insert into public.found_item_photos (
  item_id,
  storage_path,
  mime_type,
  sort_order
)
select
  value::uuid,
  '00000000-0000-4000-8000-000000000101/items/'
    || value || '/wallet-cover.jpg',
  'image/jpeg',
  1
from strathfind_test_state
where key = 'found_item';

select pg_temp.assert_true(
  public.can_view_item_photo_path(
    '00000000-0000-4000-8000-000000000101/items/'
      || (select value from strathfind_test_state where key = 'found_item')
      || '/wallet-cover.jpg'
  )
  and public.can_manage_item_photo_path(
    '00000000-0000-4000-8000-000000000101/items/'
      || (select value from strathfind_test_state where key = 'found_item')
      || '/wallet-cover.jpg'
  )
  and not public.can_view_item_photo_path(
    '00000000-0000-4000-8000-000000000101/items/'
      || (select value from strathfind_test_state where key = 'found_item')
      || '/wallet-cover.jpg/extra'
  )
  and not public.can_view_item_photo_path(
    '00000000-0000-4000-8000-000000000101/10000000-0000-4000-8000-000000000001/'
      || (select value from strathfind_test_state where key = 'found_item')
      || '/legacy-cover.jpg'
  ),
  'photo helpers require exactly university/items/item/opaque-file and reject legacy keys'
);

select pg_temp.assert_true(
  (
    select handoff_due_at is null
    from public.found_items
    where id = (select value::uuid from strathfind_test_state where key = 'lost_item')
  ),
  'lost reports have no handoff deadline'
);

select pg_temp.assert_true(
  (
    select extract(epoch from (handoff_due_at - found_at)) = 86400
    from public.found_items
    where id = (select value::uuid from strathfind_test_state where key = 'found_item')
  ),
  'found reports receive the exact 24-hour deadline'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'item_verification_questions'
      and column_name in ('answer', 'expected_answer')
  ),
  'ownership answers are not stored with verification questions'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  false
);

select pg_temp.assert_true(
  public.get_item_verification_question(
    (select value::uuid from strathfind_test_state where key = 'found_item')
  ) = 'Which cards are inside?',
  'same-campus students can read the private question through its RPC'
);

select pg_temp.assert_true(
  (
    select item_id = (select value::uuid from strathfind_test_state where key = 'found_item')
      and match_score = 92
      and cover_photo_path =
        '00000000-0000-4000-8000-000000000101/items/'
        || (select value from strathfind_test_state where key = 'found_item')
        || '/wallet-cover.jpg'
    from public.possible_item_matches(
      (select value::uuid from strathfind_test_state where key = 'lost_item'),
      10
    )
    limit 1
  ),
  'matches are deterministic and omit a legacy user-id-bearing cover path'
);

insert into strathfind_test_state (key, value)
select 'flag', public.submit_item_flag(
  (select value::uuid from strathfind_test_state where key = 'found_item'),
  'incorrect',
  'The location appears to be incorrect.'
)::text;

select pg_temp.assert_true(
  public.submit_item_flag(
    (select value::uuid from strathfind_test_state where key = 'found_item'),
    'incorrect',
    'A duplicate submission should return the existing open flag.'
  ) = (select value::uuid from strathfind_test_state where key = 'flag'),
  'a student has at most one open flag per report'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);

select pg_temp.assert_true(
  (
    select submitted_by is null
    from public.list_visible_item_flags(
      (select value::uuid from strathfind_test_state where key = 'found_item')
    )
    limit 1
  ),
  'the item reporter can see a flag without learning the flagger identity'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000003',
  false
);

select pg_temp.assert_true(
  (
    select count(*) = 3
    from public.list_university_members()
  ),
  'same-campus admin can list member identifiers through the private RPC'
);

select pg_temp.assert_true(
  (
    select submitted_by = '10000000-0000-4000-8000-000000000002'::uuid
    from public.list_visible_item_flags(
      (select value::uuid from strathfind_test_state where key = 'found_item')
    )
    limit 1
  ),
  'same-campus admin can inspect the flagger identity'
);

select public.review_item_flag(
  (select value::uuid from strathfind_test_state where key = 'flag'),
  'dismissed',
  'Location was verified by the finder.'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  false
);

insert into strathfind_test_state (key, value)
select 'claim', public.create_item_claim(
  (select value::uuid from strathfind_test_state where key = 'found_item'),
  'This is my wallet and I can verify it.',
  'It contains my student card and a blue bank card.'
)::text;

do $$
begin
  begin
    perform *
    from public.reveal_item_contact(
      (select value::uuid from strathfind_test_state where key = 'found_item')
    );
    raise exception 'pending claim unexpectedly revealed contact data';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);

select public.review_claim(
  (select value::uuid from strathfind_test_state where key = 'claim'),
  true,
  'Ownership details match.'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  false
);

select pg_temp.assert_true(
  (
    select phone_e164 = '+254700000001'
    from public.reveal_item_contact(
      (select value::uuid from strathfind_test_state where key = 'found_item')
    )
  ),
  'an approved claimant can reveal the reporter contact'
);

select * from public.process_handoff_deadlines(now() + interval '30 hours');

select pg_temp.assert_true(
  (
    select status = 'return_arranged'
    from public.found_items
    where id = (select value::uuid from strathfind_test_state where key = 'found_item')
  ),
  'deadline processor preserves an approved return arrangement'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  false
);

do $$
begin
  begin
    perform public.get_item_verification_question(
      (select value::uuid from strathfind_test_state where key = 'found_item')
    );
    raise exception 'cross-campus question access unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform *
    from public.possible_item_matches(
      (select value::uuid from strathfind_test_state where key = 'found_item'),
      10
    );
    raise exception 'cross-campus matching unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.submit_item_flag(
      (select value::uuid from strathfind_test_state where key = 'found_item'),
      'other',
      'This cross-campus flag must be rejected.'
    );
    raise exception 'cross-campus flag unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);

insert into strathfind_test_state (key, value)
select 'handoff_code', public.issue_item_handoff_code(
  (select value::uuid from strathfind_test_state where key = 'found_item')
);

select pg_temp.assert_true(
  (
    select value ~ '^[0-9]{6}$'
    from strathfind_test_state
    where key = 'handoff_code'
  ),
  'handoff code is exactly six digits'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000003',
  false
);

select pg_temp.assert_true(
  not public.accept_item_into_custody(
    (select value::uuid from strathfind_test_state where key = 'found_item'),
    'Shelf A-1',
    (
      select case when value = '000000' then '000001' else '000000' end
      from strathfind_test_state
      where key = 'handoff_code'
    ),
    'Intentional bad-code test'
  ),
  'wrong handoff code is rejected'
);

select pg_temp.assert_true(
  (
    select failed_attempts = 1
    from public.item_handoff_tokens
    where item_id = (select value::uuid from strathfind_test_state where key = 'found_item')
  ),
  'wrong-code attempt counter persists'
);

select pg_temp.assert_true(
  public.accept_item_into_custody(
    (select value::uuid from strathfind_test_state where key = 'found_item'),
    'Shelf A-1',
    (select value from strathfind_test_state where key = 'handoff_code'),
    'Physical intake verified'
  ),
  'valid one-time handoff code confirms custody'
);

select pg_temp.assert_true(
  not public.accept_item_into_custody(
    (select value::uuid from strathfind_test_state where key = 'found_item'),
    'Shelf A-1',
    (select value from strathfind_test_state where key = 'handoff_code'),
    null
  ),
  'consumed handoff code cannot be replayed'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);

do $$
begin
  begin
    perform public.issue_item_handoff_code(
      (select value::uuid from strathfind_test_state where key = 'lost_item')
    );
    raise exception 'lost report unexpectedly received a custody code';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select * from public.process_handoff_deadlines(now() + interval '30 hours');

select pg_temp.assert_true(
  (
    select status = 'listed'
    from public.found_items
    where id = (select value::uuid from strathfind_test_state where key = 'lost_item')
  ),
  'deadline processor ignores lost reports'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'found_item_cards'
      and column_name in ('phone_e164', 'question', 'student_number')
  ),
  'safe feed schema omits full contact, question, and campus identifiers'
);

select pg_temp.assert_true(
  has_function_privilege(
    'anon',
    'public.get_public_item_cards(text,text,text,integer)',
    'execute'
  )
  and not has_table_privilege('anon', 'public.found_items', 'select'),
  'anonymous clients use only the bounded feed RPC, not the reports table'
);

set local role anon;

select pg_temp.assert_true(
  (
    select count(*) = 2
    from public.get_public_item_cards(null, null, null, 100)
    where title not like 'DEMO · %'
  ),
  'anonymous feed returns active Strathmore reports'
);

select pg_temp.assert_true(
  (
    select count(*) = 2
    from public.get_public_item_cards('lost', null, 'DEMO', 100)
  )
  and (
    select count(*) = 3
    from public.get_public_item_cards('found', null, 'DEMO', 100)
  ),
  'anonymous feed returns two lost and three found preview cards'
);

select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.get_public_item_cards('lost', 'wallet', 'library', 100)
  ),
  'anonymous feed applies kind, category, and literal search filters'
);

select pg_temp.assert_true(
  (
    select count(*) = 0
    from public.get_public_item_cards(null, null, ''' or 1=1 --', 100)
  ),
  'anonymous feed treats SQL-looking search text as plain input'
);

select pg_temp.assert_true(
  (
    select bool_and(
      not (
        to_jsonb(card) ?| array[
          'reporter_id',
          'university_id',
          'phone_e164',
          'ownership_question',
          'cover_photo_path'
        ]
      )
    )
    from public.get_public_item_cards(null, null, null, 100) card
  ),
  'anonymous feed rows omit identity, contact, proof, campus, and media-path fields'
);

reset role;

grant select on strathfind_test_state to authenticated;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  false
);

select pg_temp.assert_true(
  (select count(*) = 0 from public.found_item_cards),
  'RLS hides another university feed'
);

select pg_temp.assert_true(
  (
    select count(*) = 0
    from public.list_visible_claims(
      (select value::uuid from strathfind_test_state where key = 'found_item')
    )
  ),
  'cross-campus users cannot list claims for an item'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);

insert into public.found_item_photos (
  item_id,
  storage_path,
  mime_type,
  sort_order
)
select
  value::uuid,
  '00000000-0000-4000-8000-000000000101/items/'
    || value || '/wallet-detail.jpg',
  'image/jpeg',
  2
from strathfind_test_state
where key = 'found_item';

select pg_temp.assert_true(
  (select count(*) = 2 from public.found_item_cards),
  'RLS shows the same-university feed'
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.profiles),
  'a student can query only their own profile row'
);

select pg_temp.assert_true(
  (
    select count(*) = 0
    from public.profiles
    where id = '10000000-0000-4000-8000-000000000002'::uuid
  ),
  'an item reporter cannot query a claimant profile directly'
);

select pg_temp.assert_true(
  (
    select claimant_id is null
      and not is_mine
      and claimant_label = 'Claimant T.'
    from public.list_visible_claims(
      (select value::uuid from strathfind_test_state where key = 'found_item')
    )
    where id = (select value::uuid from strathfind_test_state where key = 'claim')
  ),
  'an item reporter receives a masked claimant label without a stable claimant id'
);

select pg_temp.assert_true(
  (
    select contact_name = 'Finder O.'
    from public.found_item_cards
    where kind = 'lost'
  ),
  'safe cards mask a personal display name to first name and last initial'
);

select pg_temp.assert_true(
  (
    select cover_photo_path =
      '00000000-0000-4000-8000-000000000101/items/'
      || (select value from strathfind_test_state where key = 'found_item')
      || '/wallet-cover.jpg'
      and cover_photo_path not like '%10000000-0000-4000-8000-000000000001%'
    from public.found_item_cards
    where kind = 'found'
  ),
  'safe cards expose only the opaque item-scoped photo key'
);

select pg_temp.assert_true(
  (
    select contact_name = 'Student Centre Lost & Found'
    from public.found_item_cards
    where kind = 'found'
  ),
  'safe cards preserve the official Lost & Found desk name'
);

do $$
begin
  begin
    perform student_number from public.profiles;
    raise exception 'student_number unexpectedly had direct SELECT access';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform reporter_id from public.found_items;
    raise exception 'found_items.reporter_id unexpectedly had direct SELECT access';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform claimant_id from public.claims;
    raise exception 'claims.claimant_id unexpectedly had direct SELECT access';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform uploader_id from public.found_item_photos;
    raise exception 'found_item_photos.uploader_id unexpectedly had direct SELECT access';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform storage_path from public.found_item_photos;
    raise exception 'found_item_photos.storage_path unexpectedly had direct SELECT access';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform changed_by from public.item_status_history;
    raise exception 'item_status_history.changed_by unexpectedly had direct SELECT access';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform viewer_id from public.contact_reveal_audit;
    raise exception 'contact_reveal_audit.viewer_id unexpectedly had direct SELECT access';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform contact_owner_id from public.contact_reveal_audit;
    raise exception 'contact_reveal_audit.contact_owner_id unexpectedly had direct SELECT access';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select pg_temp.assert_true(
  (
    select count(*) = 2
    from (
      select id, title, kind, status
      from public.found_items
    ) safe_reports
  ),
  'same-campus students retain access to non-identifying base report columns'
);

select pg_temp.assert_true(
  (
    select count(*) > 0
    from (
      select id, item_id, old_status, new_status, changed_at
      from public.item_status_history
    ) safe_history
  ),
  'status history remains readable without the actor identifier'
);

select pg_temp.assert_true(
  (
    select count(*) > 0
    from (
      select id, item_id, revealed_at
      from public.contact_reveal_audit
    ) safe_reveals
  ),
  'contact reveal facts remain readable without participant identifiers'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  false
);

select pg_temp.assert_true(
  (
    select claimant_id = '10000000-0000-4000-8000-000000000002'::uuid
      and is_mine
      and claimant_label = 'Claimant Two'
    from public.list_visible_claims(
      (select value::uuid from strathfind_test_state where key = 'found_item')
    )
    where id = (select value::uuid from strathfind_test_state where key = 'claim')
  ),
  'a claimant receives their own stable id and full display name'
);

select pg_temp.assert_true(
  public.create_item_claim(
    (select value::uuid from strathfind_test_state where key = 'lost_item'),
    'I may have found the matching wallet.',
    'I can describe the cards and marks inside the wallet.'
  ) is not null,
  'an authenticated student can create a claim through the id-only RPC'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000003',
  false
);

select pg_temp.assert_true(
  (
    select claimant_id = '10000000-0000-4000-8000-000000000002'::uuid
      and not is_mine
      and claimant_label = 'Claimant Two'
    from public.list_visible_claims(
      (select value::uuid from strathfind_test_state where key = 'found_item')
    )
    where id = (select value::uuid from strathfind_test_state where key = 'claim')
  ),
  'a same-campus admin receives the claimant identity needed for review'
);

select pg_temp.assert_true(
  (select count(*) = 3 from public.profiles),
  'a same-campus admin retains authorized profile-directory access'
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.profile_contacts),
  'an admin cannot bypass audited contact reveal by selecting campus phone rows'
);

reset role;

rollback;
