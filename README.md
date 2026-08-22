# StrathFind

StrathFind is a private, campus-verified lost-and-found for web, iOS, and Android. Students can report an item, find possible matches, prove ownership, and coordinate a safe return. Unclaimed found items follow a traceable 24-hour handoff to campus staff.

The app uses Expo Router for one universal TypeScript codebase and Supabase for authentication, tenant isolation, claims, private contact reveals, notifications, and custody records.

## Included

- Responsive public website and student app
- Student signup gated by a university code
- Separate student and staff sign-in with server-controlled roles
- Lost and found reports with photos, filters, private ownership clues, and match-ready metadata
- Phone numbers masked until a claim is approved and the claimant explicitly reveals them
- 24-hour custody deadline, finder handoff code, and staff-confirmed intake
- Student activity, locally saved searches, deterministic match suggestions, native haptics, and accessible controls
- Admin overview, intake, claim and moderation review, real join-code creation, inventory, and audit trail
- Private Supabase Storage and campus-scoped row-level security
- Original StrathFind vector and app-icon assets in `assets/brand`

## Run locally

Requirements: Node.js 20 or newer and npm.

```sh
npm install
npm start
```

From the Expo terminal, open the web app, an Android emulator/device, or an iOS simulator/device. Platform-specific shortcuts are also available:

```sh
npm run web
npm run android
npm run ios
```

Without environment variables, StrathFind opens in a fully interactive preview backed by in-memory demo data. On the sign-in screen, use **Student demo** or **Admin demo**. Student signup in preview mode uses university code `SF-DEMO-2026`.

## Connect Supabase

1. Copy `.env.example` to `.env.local`.
2. Add the project URL and publishable anon key. Never add a service-role key to an Expo environment variable.
3. Install the Supabase CLI and link the project.
4. Review and apply every SQL file in `supabase/migrations` in timestamp order.
5. For local development only, apply `supabase/seed.sql` to create `SF-DEMO-2026`.
6. Configure a trusted scheduled job to run `process_handoff_deadlines()` about every 15 minutes.

Detailed database operations and first-admin bootstrapping are in [supabase/README.md](supabase/README.md).

## Quality checks

```sh
npm run typecheck
npm run lint
npm test
npm run build:web
npx expo-doctor
```

## Builds

Install and authenticate the EAS CLI, then configure the Expo project identifier when prompted:

```sh
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform all --profile production
```

The website exports as a single-page app to `dist` with `npm run build:web`. This keeps direct links such as `/item/:id` and `/auth-callback` working when the host rewrites unknown paths to `index.html`.

- Netlify: the included `public/_redirects` file is copied into the export.
- Vercel: the included `vercel.json` applies the fallback rewrite.
- Other hosts: serve existing files normally, then rewrite unmatched paths to `/index.html` with a `200` response.

Add both the deployed web callback URL (`https://your-domain/auth-callback`) and the native callback scheme (`strathfind:///auth-callback`) to the Supabase Auth redirect allow list before enabling email confirmation.

## Security model

- Public pages never expose the campus inventory.
- Every app row is scoped to a university and protected by RLS.
- Public signup always creates a student; admins are provisioned through trusted server-side operations.
- Full phone numbers are stored separately from item records.
- Contact reveal requires an approved claim, is rate-limited, and is audited.
- Claim proof and identifying clues are excluded from the safe feed.
- Staff must verify the finder handoff code before accepting custody.
- Found-item deadlines are calculated from the declared found time, not the upload time.

Before production, configure email delivery, Auth CAPTCHA/rate limits, push credentials, campus policy text, Lost & Found hours/phone, retention rules, and store privacy disclosures for the deploying university.

## Structure

```text
src/app/                    Expo Router routes
src/components/strathfind/ Shared UI system
src/state/                  Session and application state
src/lib/                    Supabase client, utilities, and demo fixtures
supabase/                   Schema, RLS, workflows, and local seed
assets/brand/               Logo and platform artwork
```
