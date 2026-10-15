# Financial Clicker — licenses, live operations and notifications

## Persistence

The reported owner's cloud save contained a US entrepreneur license and two businesses during the read-only check. No refund or replacement purchase was invented. Guest purchases now write their snapshot immediately. Legacy enterprises survive category removal, retaining their historical invested value and net income. The business page shows the license identifier, issue date and permanent status.

Confirmed server licenses are backed by a private `business_licenses` registry. Ordinary game commits cannot erase or replace that document. The canonical RPC returns the state after database triggers, so the client sees the restored document. An authorized MFA administrator can still explicitly reset ordinary progress; that action clears the license registry and is audited. Limited collectible ownership and event achievements are retained; their car/NFT book value is calculated from permanent claim records.

## Limited releases

No releases are seeded by this update. In **Центр управления → Лимитированные выпуски**, create a draft, choose car, plate, username, NFT or achievement, supply images or a built-in achievement icon, price, player limit, and start/end dates. Switch to **По расписанию** when ready. One claim per player per release makes the supply limit a limit on recipients, not repeat purchases.

The server evaluates the release window on every read/claim. Opening/closing works while staff are offline and does not depend on a browser timer or a scheduled frontend tab. The store polls every 15 seconds; synchronization automatically awards qualifying achievements during the active window. Goals are cumulative account metrics (not an automatically reset event counter). Achievements can also be checked from the event card. No new claims are allowed after the end; existing claims retain their original title, artwork, edition and issue date.

The release row and save are locked. Claims, stock count, balance debit and asset delivery are one transaction. Duplicate requests return the same claim, including after the event closes. A failure rolls back both payment and delivery. Issued release identifiers/conditions cannot be changed, and supply cannot be reduced below issued copies. Administrators can pause/archive a release; already issued copies remain.

Multi-edition usernames/plates require `{serial}` (0001, 0002, …). Standard username purchases respect scheduled reservations; standard plate purchases check existing ownership and release reservations on the server. Choose a distinctive unoccupied pattern. Usernames are delivered to the ordinary username manager; plates to the ordinary plate inventory. Limited cars/NFTs appear in the collection, purchases/profile, and showcase picker. Public profiles show only collection presentation fields, never private saves. Transfers of usernames/plates continue through existing escrow; claim history records the original recipient.

Uploaded media uses the `release-media` bucket: PNG/JPEG/WebP up to 5 MiB; uploads require an authorized MFA owner/admin. Unique immutable paths keep earlier editions' artwork stable. These are public display assets; there is no anonymous upload, SVG upload, or browser service key.

## Notifications and announcements

Active announcements are shown in a game banner and delivered to each account's inbox with a unique delivery key. Polling updates the badge, support-reply badge and active banner normally within 10 seconds. Inactive/deleted announcements disappear from the banner; delivered history remains. Current active announcements are also delivered to new accounts.

Notifications are generated from committed database changes: license issue, business registration/launch, shop/accessory purchases, achievements, limited claims, support replies/status changes and administrative account actions. Clicks do not generate inbox spam. Only the server inserts notifications; players can mark only their own rows.

Opening/reading a notification marks it read and archives it. **Прочитанное** shows read history, **Архив** shows archived history; these views intentionally overlap. Marking a notification unread returns it to the inbox. Reading a support conversation also marks its support notices read. Existing clan invitations retain their response controls.

## Audio and administration

UI sounds are original Web Audio oscillator/envelope synthesis, with no external recordings. Button and clicker sounds are short, quiet and throttled. Settings include mute, volume and preview. Notification audio waits for a user-activated audio context and never blocks game actions.

The admin workspace has an overview, actual server counters, section search, consistent navigation, role labels, MFA status and a focused release editor. Announcements explain their delivery behavior and use labeled controls.

## Ban enforcement

Authenticated writes across public game tables reject a banned actor, including writes through security-definer RPCs. Support/notification read-state operations remain available for appeals. Canonical save commits, casino actions and limited claims coordinate with ban issuance and check the current ban, rather than trusting local flags. The client periodically rechecks account access and fails closed when it cannot verify it. Old JWTs or changing browser storage do not remove a database ban. This does not establish a person's identity across newly registered accounts or guarantee protection against every future exploit.

## Validation and rollout

Use `npm test`, `npm run test:database`, `npm run build:domain`, `npm run build`, and `git diff --check`. Isolated PostgreSQL tests cover hidden drafts/future/expired releases, duplicate purchase, stock exhaustion, permanent snapshots, reserved usernames, normal inventory delivery, achievement thresholds, protected licenses, notification isolation, announcement delivery, support read/archive, MFA and banned-account denial.

Merge through the normal repository process; the existing Supabase workflow validates, takes an encrypted database backup, applies migrations and deploys functions. Publish the matching frontend only after backend success. Vite production builds reject absent public Supabase configuration. Keep service credentials out of frontend variables.

Browser visual QA, real authenticator flows, physical audio playback, and independent concurrent network-session tests were unavailable in this environment. Row locks and unique constraints were checked using isolated PostgreSQL tests; real multi-user smoke testing is still advisable before a public release.
