# Financial Clicker: security and support review — 16 October 2026

This is a targeted source review with isolated regression tests, not a certification that the application is unhackable. Production account access, infrastructure configuration and a real browser session were unavailable. The migration and matching client/functions must be deployed together.

## Changes prepared

- Server role matrix: owner controls roles; owner/admin control balances and resets; moderator handles support, reports, bans and casino history. Administrative APIs and sensitive reads require signed Supabase AAL2 claims. Hiding UI controls is not authorization.
- TOTP enrollment and verification screen for staff; explicit game navigation and sign-in return to `#/admin`. The Site owner and game owner are distinct identities.
- Role and announcement changes use transactional RPCs with audit entries. Browser writes to roles/audit tables are revoked. An owner cannot remove their own owner role, and the final owner cannot be removed.
- Moderator calls to money APIs are denied. Balance changes validate limits, negative totals and non-finite inputs. Private save access is granted only to authorized MFA staff.
- Support uses authenticated, row-locked RPCs; author identity and staff status are server-derived. Direct writes and forged staff badges are denied. Limits: 5 active/new tickets per hour and 20 messages/minute. Banned users retain an appeal path.
- Shared support UI: active cases, staff replies, closure, archive with readable history, reopening by staff, error reporting and draft retention. Polling discards stale responses after switching conversations.
- Per-account server request budgets: 60 sync requests/minute and 180 casino requests/minute. These complement hosted platform controls; they do not provide IP-level DDoS protection.
- Request bodies are bounded while streaming, including chunked UTF-8 input. Batches accept at most 200 structured actions and UUID receipts. Casino dependencies are pinned; raw database error messages are not returned to clients.
- Existing server-authoritative spending, catalog pricing, action receipts, click budget, server time, marketplace escrow and casino settlement remain in place. SQL helper grants were reviewed; anonymous mutation access and old snapshot/income functions remain disabled.
- Clan treasury operations use consistent locking and bounded amounts. Profile player IDs and identity columns cannot be edited by a direct browser update.
- Build-only Tailwind integration moved to development dependencies. Patched source-map and selector parser versions are pinned through overrides. The production dependency audit reports zero known advisories at the time of this review; this does not imply that all development tooling is advisory-free.

## Verification

Run `npm test`, `npm run test:database`, `npm run build:domain`, `npm run build` and `git diff --check`. PostgreSQL tests use PGlite and test-only auth/JWT fixtures. They do not validate real JWT signatures, the deployed Supabase configuration, independent concurrent network connections, or real authenticator enrollment. Test cross-session and multi-user flows in staging before a public release.

## Administrator access

Open the game and choose **Центр управления**, or visit `https://financial-clicker-preview.crises-sketch8sd.chatgpt.site/#/admin`. Sign in to the game account, then enroll/verify TOTP when a role is assigned. Ordinary accounts cannot gain a role from the URL, nickname, browser storage or a client flag.

The first owner must be assigned through the trusted Supabase SQL editor using a verified game-account UUID. Do not put service-role keys in Vite variables or send them through support. `scripts/grant-game-owner.sql` is a guarded template for this one-time operation. No owner has been guessed or assigned by this patch.

## Deployment order

1. Back up the production database and test a restored staging instance.
2. Merge the reviewed source change through the normal repository process.
3. Run the existing Supabase workflow: validate, encrypted backup, migration dry run, migration, Edge Functions.
4. Confirm its terminal success, then publish the matching frontend. Do not publish the new administrative RPC client against the old schema.
5. Assign the verified owner account, enroll TOTP, and test: role checks, support user/staff reply, close/archive/reopen, purchase/reload, escrow transfer, casino stake/payout, banned account denial and appeal.

## Follow-up controls requiring infrastructure/account access

- Enable MFA for Supabase/GitHub project owners, protect the main branch and review production environment access.
- Verify automated backups, retention and a restore drill. The existing workflow stores an encrypted seven-day pre-migration backup; that is not a complete ongoing disaster-recovery plan.
- Configure platform WAF/rate controls, auth signup abuse protection and credential-stuffing protections; monitor failed logins and rejected actions. Per-user limits cannot stop a botnet creating accounts.
- Set production response headers including CSP and framing restrictions at the actual host. Verify them in a real browser; a static file named `_headers` alone is not proof of host enforcement.
- Review development-only dependency advisories before accepting untrusted build input; repeat the package audit before release.
- Future market prices are currently computed from a public deterministic simulation. This permits prediction/automation even though it does not permit forged balances. A competitive market would need a server-controlled price feed and separate bot/fraud policies.
- Existing balances are preserved. This patch does not retroactively prove that historical wealth was earned legitimately.

Reference documentation: https://supabase.com/docs/guides/database/functions , https://supabase.com/docs/guides/database/postgres/row-level-security , https://supabase.com/docs/guides/auth/auth-mfa .
