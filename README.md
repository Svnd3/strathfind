# StrathFind

StrathFind is a Strathmore University lost-and-found app for web, iOS, and Android. Anyone can browse privacy-safe lost and found cards; signing in is required to publish a report or open its full details.

## What is included

- Minimal `LOST?` and `FOUND?` home actions with responsive mobile and desktop navigation
- Large, expandable item cards and separate lost/found feeds
- Three-step reporting with a photo frame, campus-place suggestions, and a review step
- Account, profile, activity, settings, authentication, Terms, and Privacy screens
- Campus-scoped Supabase authentication, reports, claims, moderation, custody, and row-level security
- Anonymous-safe public feed that omits identities, contact details, verification answers, claims, and private photo paths
- Optional Google Places suggestions restricted to the area around Strathmore's main campus

There are no sample reports, fake users, or demo credentials in the app. With no Supabase environment variables, the public feeds remain empty and authentication/publishing fail closed.

## Run locally

Requirements: Node.js 20 or newer and npm.

```sh
npm install
cp .env.example .env.local
npm start
```

The copied values are intentionally blank. Supabase is optional for viewing the interface, but required for real accounts and reports. Platform shortcuts are also available:

```sh
npm run web
npm run android
npm run ios
```

## Connect Supabase

1. Create a Supabase project and copy its project URL and publishable anon key into `.env.local`. Never put a service-role key in an `EXPO_PUBLIC_*` variable.
2. Install the Supabase CLI, link the project, and review then apply every file in `supabase/migrations` in timestamp order.
3. Create the real university record with the exact slug `strathmore-university`, then create active student join codes from a trusted SQL session. Production examples are in [supabase/README.md](supabase/README.md).
4. Add the deployed web callback (`https://your-domain/auth-callback`) and native callback (`strathfind:///auth-callback`) to the Supabase Auth redirect allow list.
5. Configure a trusted scheduled job to call `process_handoff_deadlines()` about every 15 minutes.

The local `supabase/seed.sql` contains only a Strathmore-scoped development record and disposable join code; it does not create users or item reports and must never be applied to production.

## Campus place suggestions

The app always includes a small, non-exhaustive list of publicly documented Strathmore locations and permits manual entry. To enrich it with nearby results, enable **Places API (New)** in Google Cloud and set:

```sh
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-client-key
```

This key is bundled into the client and is not a secret. For web, restrict it to **Places API (New)** and the deployed browser origins, then set quotas and billing alerts. The current native client calls the REST API directly, so native app restrictions are not reliably carried with that request; proxy it through a server or Edge Function before a production mobile launch.

The Google query is location-restricted to a 1.2 km circle around the main campus, but suggestions are not an authoritative campus directory. Users can still type a location when a place is missing.

## Quality checks

```sh
npm run typecheck
npm run lint
npm test
npm run build:web
npx expo-doctor
```

## Builds and hosting

```sh
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform all --profile production
```

`npm run build:web` exports a single-page app to `dist`. Netlify uses `public/_redirects`, Vercel uses `vercel.json`, and other hosts must rewrite unknown routes to `/index.html` with a `200` response.

## Security and launch notes

- Supabase row-level security remains the authority; client-side route guards are only a user-experience layer.
- Anonymous clients can execute only the deliberately narrow `get_public_item_cards` RPC, not select app tables directly.
- Full contact access is authorized, rate-limited, and audited: normally after an approved claim, with narrow report-author and campus-admin exceptions.
- Item media stays in private Storage and is served with short-lived signed URLs after authorization.
- Public signup always creates a student. Admin roles and join codes are managed only through trusted operations.
- Student and Admin are separate sign-in portals. The portal choice never grants authority: the app verifies the protected database profile after authentication and signs out any role mismatch.
- No application can honestly be called “unhackable.” Before launch, run a security review and database regression suite, configure Auth CAPTCHA/rate limits and email delivery, set retention/moderation procedures, and obtain Kenyan legal review of the in-app Terms and Privacy notice.

See [supabase/README.md](supabase/README.md) for the full database contract, bootstrap process, and security tests.

## Structure

```text
src/app/                    Expo Router screens
src/components/strathfind/ Shared UI components
src/state/                  Session and application state
src/lib/                    Supabase, catalog, and campus-location utilities
supabase/                   Schema, RLS, workflows, tests, and local-only seed
assets/brand/               Logo and platform artwork
```
