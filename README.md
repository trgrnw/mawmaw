# Financial Clicker: Business Empire

React / TypeScript game with a local guest mode and Supabase accounts, marketplace, clans and casino. The repository name is not the game's title.

## Development

Use Node 22.12+ (CI uses Node 24).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with the project's public Supabase URL and publishable key. Never place service role credentials in `VITE_*` variables or browser code.

```sh
npm run lint
npm test
npm run test:database
npm run build:domain
npm run build
```

`test:database` applies every migration to an isolated PostgreSQL-compatible PGlite instance and exercises permissions, idempotency and settlements. Its auth/storage fixtures and random-byte adapter are for testing only; it does not access production or test real Supabase networking, JWT verification or concurrent database connections.

## Backend update required

The October 2026 client requires **all four `20261002*` migrations**, the rebuilt shared domain bundle, and the `game-sync` and `casino` Edge Functions. Until those are deployed, authenticated economic actions deliberately stop at synchronization rather than falling back to unverified snapshot writes. Guest play remains local.

Before applying to an existing project, back up the database and test a restored staging copy. The migrations preserve existing game snapshots and migrate plate escrow. Old pending casino bets cannot be verified because their stakes were previously charged only in browsers; those legacy pending rounds are closed without a new server payout. Finish old games before the maintenance window. Existing paid history is retained.

Deploy the database and functions together during a maintenance window, then publish the matching frontend:

```sh
npm run build:domain
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy game-sync
supabase functions deploy casino
```

The functions validate bearer tokens with `auth.getUser`; their gateway JWT setting is in `supabase/config.toml`. Supabase supplies function service credentials; they stay on the server. An existing GitHub backend workflow performs validation and deployment when its repository secrets are configured.

If `pg_cron` is enabled, the migration installs minute jobs for casino and auction settlement. Otherwise settlement happens on authenticated reconnection and casino requests; verify scheduling before release. After deployment test login, a purchase and reload, disconnect/reconnect, two-player asset transfer, auction refunds, casino stake/cashout and ban enforcement against staging.

The server accepts narrow actions with persistent receipts and revision checks. Balance edits, item ownership, stakes and payouts are transactional. Saved guest progress stays on the device and is not imported as trusted online wealth. Account progress and unacknowledged actions are cached separately. Keep a source export or Git checkout for long-term development.

## Hosting

Vite builds at `/` by default; set `VITE_BASE_PATH` for a subdirectory. The GitHub Pages workflow supplies the repository path. Sites publication uses `.openai/hosting.json` and the `dist` directory.

This is still a web game. Steam packaging, release QA, full localization and asset/license review remain release work; this update does not claim Steam readiness.
