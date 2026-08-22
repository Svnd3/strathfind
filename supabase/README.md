# StrathFind Supabase foundation

This directory is the shared backend contract for the web, iOS, and Android clients. It supports campus-scoped lost and found reports, ownership claims, deterministic matching, private contacts, moderation, verified physical handoff, and notifications. Every client-facing table has row-level security; authority is read from `profiles`, never user-editable Auth metadata.

## Apply locally

With Docker running and available to your user:

```sh
supabase start
supabase db reset
```

`db reset` applies all migrations in order and then `seed.sql`. The seed is deliberately demo-only. It creates the join code `SF-DEMO-2026`; never apply that seed to production.

For a linked project, review all migrations and use the normal `supabase db push` release process. Never place a service-role key in a browser or mobile bundle.

## Signup contract

Self-service signup requires these exact Auth metadata keys:

```ts
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      display_name: "Amina Kamau",
      phone_e164: "+254712345678",
      university_code: "SF-DEMO-2026",
      student_number: "123456",
    },
  },
});
```

- `display_name`: trimmed, 2–80 characters.
- `phone_e164`: `+` followed by 8–15 digits, with a nonzero country-code prefix.
- `university_code`: case-insensitive active join code.
- `student_number`: normalized to uppercase; 3–32 characters matching `^[A-Z0-9][A-Z0-9._/-]{2,31}$`.

The student number is unique within a university, but may exist at another university. The Auth trigger atomically redeems the join code, always assigns the `student` role, and removes `university_code`, `student_number`, `role`, and `university_id` from Auth metadata. A client cannot self-assign admin access.

Read the signed-in user's private identifier through `get_my_profile()`:

```text
id, university_id, role, display_name, student_number,
avatar_path, created_at, updated_at
```

Ordinary profile queries deliberately do not have column permission for `student_number`. Same-campus admins may call `list_university_members()`.

For a new production project, create the first university and a random, one-use
bootstrap code from a trusted SQL session. Replace every example value before
running this; do not reuse the local demo code:

```sql
begin;

with campus as (
  insert into public.universities (
    name, slug, lost_found_name, lost_found_location, lost_found_phone_e164
  ) values (
    'Example University',
    'example-university',
    'Student Centre Lost & Found',
    'Student Centre, Ground Floor',
    '+254700000000'
  )
  on conflict (slug) do update set name = excluded.name
  returning id
)
insert into public.university_join_codes (
  university_id, code_hash, label, active, expires_at, max_uses
)
select
  id,
  extensions.digest(lower('REPLACE-WITH-A-RANDOM-SECRET'), 'sha256'),
  'Initial admin bootstrap',
  true,
  now() + interval '1 day',
  1
from campus;

commit;
```

Sign up the intended staff account with that one-use code, then promote it only
from the same trusted SQL environment:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@example.edu');

update public.university_join_codes
set active = false
where label = 'Initial admin bootstrap';
```

The change is audited. Thereafter, admins can use `set_profile_role`, `create_university_join_code`, `list_university_join_codes`, and `set_join_code_active`.

## Reports and safe feed

The existing `found_items` table name remains for compatibility, but each row now has `kind = 'lost' | 'found'`. Create every new report atomically with:

```text
create_item_report(
  p_kind report_kind,
  p_title text,
  p_description text,
  p_category text,
  p_color text,
  p_location text,
  p_observed_at timestamptz,
  p_ownership_question text,
  p_handoff_point text default null
) -> uuid
```

Direct report inserts are revoked so a report cannot be created without its verification question. A found report receives `handoff_due_at = observed_at + 24 hours`; a lost report always has a null deadline and null handoff point.

Read the campus feed from `found_item_cards`. Its columns are:

```text
id, title, category, color, location_found, found_at, handoff_due_at,
status, is_mine, cover_photo_path, created_at, kind, description,
location, observed_at, handoff_point, contact_name, masked_phone
```

The first eleven columns preserve the original view order. The feed is same-campus only and does not contain a full phone number, student number, ownership question, claim evidence, or user identifier. Personal `contact_name` values are masked server-side to first name plus last initial (for example, `Amina K.`); an official Lost & Found desk name remains intact after custody. The `location` and `observed_at` aliases let new clients use neutral lost/found wording while legacy clients may continue reading `location_found` and `found_at`.

Upload up to six approved image types to the private `found-item-photos` bucket, then insert metadata into `found_item_photos`. Paths must be:

```text
{university_id}/items/{item_id}/{opaque-file-name}
```

This is an exact four-segment contract. The filename must start with an
ASCII letter or digit, contain only letters, digits, `.`, `_`, and `-`, and be
at most 160 characters. Generate it randomly and do not include personal data.
Use short-lived signed URLs only after authorization.
Authenticated clients cannot select `found_item_photos` directly because its
uploader field and legacy object paths carry stable user identifiers. Read the
single authorized `cover_photo_path` from `found_item_cards`; metadata inserts
and private-bucket authorization are enforced by the same exact path contract.
`possible_item_matches` applies the identical filter to its
`cover_photo_path` result.

## Verification, claims, and contact

The ownership question is separate from the feed:

```text
get_item_verification_question(p_item_id uuid) -> text
update_item_verification_question(p_item_id uuid, p_question text) -> void
```

Any authenticated student at the same university can read the question. Only the item reporter or a same-campus admin can change it. There is intentionally no expected-answer column. A claimant's private response belongs in `claims.proof_description` and is reviewed by a person.

Create a claim through:

```text
create_item_claim(
  p_item_id uuid,
  p_message text,
  p_proof_description text
) -> uuid
```

The result is only the new claim id. The database assigns the claimant,
university, and pending status. Use `list_visible_claims` to retrieve its safe
row, then `review_claim(claim_id, approve, review_note)` or
`cancel_my_claim(claim_id)` for transitions. A restricted direct INSERT remains
available for return-minimal legacy writes, but raw `claims` SELECT is revoked,
so `INSERT ... RETURNING` is not a supported client contract.

List claims through the privacy-safe RPC rather than joining `claims` to
`profiles`:

```text
list_visible_claims(p_item_id uuid default null) ->
  id, item_id, claimant_id, is_mine, claimant_label, status, message,
  proof_description, review_note, created_at, updated_at
```

Rows are visible only to the claimant, the report author, and same-campus
admins. `claimant_id` is non-null only for the claimant or an admin. A claimant
sees their own full `claimant_label`; an admin sees the full label needed for
review; a report author viewing somebody else's claim receives first name plus
last initial and no stable claimant id. Cross-campus callers receive no rows.
Clients must use `claimant_label` and must not build a campus-name map from
`profiles`.

`reveal_item_contact(item_id)` returns `contact_name`, `phone_e164`, and `contact_kind`. It is allowed only for:

- the report author;
- a same-campus admin; or
- the claimant whose claim is `approved`.

A pending claim is not enough. Each successful reveal is audited, the contact owner is notified, and students are limited to 30 reveals per hour. Until then, clients should show only the feed's masked number.

## Deterministic matches

Call `possible_item_matches(item_id, limit default 10)`. It considers only active reports from the same university with the opposite kind and the same normalized category, within 14 days. The deterministic score is:

- category: 50 points;
- exact color: 20 points;
- exact or partial normalized location: 20 or 12 points;
- time distance: 10, 7, or 4 points.

The RPC returns safe report fields plus `match_score` and `match_reasons`. It does not expose the verification question or contact details.

## Verified 24-hour handoff

For an active found report, its reporter calls:

```text
issue_item_handoff_code(item_id) -> text
```

The result is a six-digit one-time code. Only a salted hash is stored; the plaintext is returned once. It expires after 48 hours and locks after five failed attempts. Issuing a replacement invalidates the previous code.

At physical intake, a same-campus admin calls:

```text
accept_item_into_custody(
  p_item_id uuid,
  p_storage_reference text,
  p_handoff_code text,
  p_note text default null
) -> boolean
```

`true` confirms custody. `false` means the code was missing, wrong, expired, consumed, or locked. A failed attempt returns normally so its counter commits. The old code-less custody RPC was removed; an item ID alone cannot confirm possession.

Run the deadline processor every 15 minutes from Supabase Cron or another trusted service-role process:

```sql
select * from public.process_handoff_deadlines();
```

Only found reports receive one-hour reminders or become `handoff_due`. Lost reports never enter this job, and `return_arranged` reports are excluded so an approved pickup cannot be overwritten by the deadline worker.

## Item flags and admin review

Same-campus students can report unsafe or inaccurate content with:

```text
submit_item_flag(item_id, reason, details) -> uuid
```

Reasons are `spam`, `duplicate`, `incorrect`, `unsafe`, `inappropriate`, or `other`. A student has at most one open flag per item.

`list_visible_item_flags(item_id default null)` is visible to the flag submitter, the item reporter, and same-campus admins. The item reporter does not receive the flagger's identity; admins do. Admins resolve an open flag with:

```text
review_item_flag(flag_id, status, resolution_note) -> void
```

Review status must be `dismissed` or `actioned`. Reviewing a flag records the admin and timestamp; it does not silently archive the underlying report.

## Notifications

Clients may select only their own `notifications` rows and update only `read_at`. Claim, contact reveal, deadline, custody, and return workflows create deduplicated notifications server-side. Clients cannot insert notifications directly.

## Regression test

After a local reset, run the transactional SQL regression file against the local database:

```sh
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/database/strathfind.sql
```

It covers signup authority, student-number uniqueness, lost/found deadlines, private questions, deterministic matching, flag review, claim-gated contact reveal, cross-campus denial, one-time custody codes, masked claim identities, raw identity-column denial, exact opaque photo keys, legacy-path filtering, feed safety, and RLS. The script rolls back all fixtures.

## Upgrade and compatibility notes

- `202608220002_unified_reports_and_matching.sql` is additive and safe to rerun. Existing `found_items` rows become `kind = 'found'` and retain their deadlines.
- `202608220003_privacy_boundaries.sql` closes peer-profile, reporter/claimant, audit-actor, and photo-uploader lookup paths and adds the canonical claims-listing RPC. It preserves the `found_item_cards` column contract.
- `found_items` and the original first eleven `found_item_cards` columns are retained to reduce client breakage.
- New report creation must use `create_item_report`; the former direct insert grant is revoked.
- Existing rows may have no verification-question row. Their reporter or an admin can backfill one with `update_item_verification_question` before exposing the claim form.
- Existing profiles may have a null `student_number` so the upgrade can deploy without inventing identifiers. New signup requires it. Backfill legacy rows before making the column globally non-null.
- Students can select only their own `profiles` row; same-campus admins retain directory access. Use `get_my_profile()` for the current user and `list_university_members()` only in admin tools.
- Raw `found_items.reporter_id` and `found_items.university_id` are not selectable by authenticated clients. Non-identifying report columns remain available, while feed clients should use `found_item_cards`.
- Raw `found_item_photos` rows are not selectable; feed photo access starts from `found_item_cards.cover_photo_path` and the private storage bucket. Clients must upload to `{university_id}/items/{item_id}/{opaque-file-name}`. Old `{university_id}/{user_id}/{item_id}/{file-name}` objects are deliberately hidden and denied. A trusted service-role migration must copy each old Storage object to the new key, update its `found_item_photos.storage_path`, and then remove the old object.
- Existing clients that list `claims` and then join claimant ids to `profiles` must switch to `list_visible_claims`. Claim creation should switch to `create_item_claim`; raw claim rows are no longer selectable by authenticated clients.
- Direct `profile_contacts` reads are self-only, including for admins. Admin access to another person's phone must use the authorized and audited `reveal_item_contact` RPC.
- Authenticated clients may select only `id`, `item_id`, `old_status`, `new_status`, and `changed_at` from `item_status_history`, and only `id`, `item_id`, and `revealed_at` from `contact_reveal_audit`. Actor/contact UUIDs are server-private.
- Contact reveal now requires an approved claim, except for the report author/admin.
- The old `accept_item_into_custody(item_id, storage_reference, note)` contract is intentionally removed. Clients must issue and verify the handoff code.
- Database statuses remain `listed`, `claim_pending`, `handoff_due`, `in_admin_custody`, `return_arranged`, `returned`, and `archived`; clients should map display labels explicitly.

## Security summary

- Anonymous users have no app-table access.
- Full numbers live only in `profile_contacts`; the feed contains a masked number.
- Peer profiles, raw report author ids, and unmasked claimant names are not available to student feed clients.
- Join codes and custody codes are stored only as hashes.
- Role checks use database profiles, not JWT metadata.
- Claim evidence, moderation submitter identity, custody references, and student identifiers are omitted from the feed.
- RLS is defense in depth. Keep automated checks for cross-university access, role escalation, exhausted codes, direct status updates, storage-path spoofing, contact-reveal authorization, and handoff-code retry limits.
