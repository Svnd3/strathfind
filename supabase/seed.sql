-- LOCAL DEVELOPMENT ONLY.
-- Never use this join code or local contact record in a production project.

insert into public.universities (
  id,
  name,
  slug,
  lost_found_name,
  lost_found_location,
  lost_found_phone_e164,
  active
)
values (
  '00000000-0000-4000-8000-000000000101',
  'Strathmore University',
  'strathmore-university',
  'Student Centre Lost & Found',
  'Student Centre, Ground Floor',
  '+254700000000',
  true
)
on conflict (slug) do update
set name = excluded.name,
    lost_found_name = excluded.lost_found_name,
    lost_found_location = excluded.lost_found_location,
    lost_found_phone_e164 = excluded.lost_found_phone_e164,
    active = excluded.active;

-- Demo student signup code: SF-DEMO-2026
-- Auth signup metadata must include the profile keys above plus the current
-- Terms and Privacy Notice acknowledgement fields documented in README.md.
insert into public.university_join_codes (
  id,
  university_id,
  code_hash,
  label,
  active,
  expires_at,
  max_uses
)
select
  '00000000-0000-4000-8000-000000000102',
  u.id,
  extensions.digest('sf-demo-2026', 'sha256'),
  'Local demo code',
  true,
  '2030-01-01 00:00:00+00'::timestamptz,
  null
from public.universities u
where u.slug = 'strathmore-university'
on conflict (code_hash) do update
set university_id = excluded.university_id,
    label = excluded.label,
    active = excluded.active,
    expires_at = excluded.expires_at,
    max_uses = excluded.max_uses;

-- Report/profile fixtures are intentionally omitted. Profiles must originate
-- from Auth so their university membership and student-number uniqueness pass
-- through the production signup trigger. Use the transactional database test
-- for disposable lost/found, claim, flag, and handoff examples.
