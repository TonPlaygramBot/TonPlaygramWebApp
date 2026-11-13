# Launch security and native release checks

This hardening pass addresses source-level launch blockers. It does not certify
production security, on-chain settlement, Google Play approval, or App Store
approval.

## Automated security gate

`.github/workflows/launch-security.yml` runs focused authentication,
account-authorization, and wallet-transaction regressions without downloading the
3D game assets. It runs for relevant pull requests and main-branch pushes, can be
started manually, and is required by the signed Android AAB workflow.

The security job installs root and bot dependencies from their lockfiles with
install scripts disabled. This is limited to tests that do not need native media
modules or the matchmaking build. The normal application and native build jobs
continue to execute their installation and build steps.

The MongoDB transfer suite must use a replica set so it exercises real database
transactions. A successful unit test with store doubles alone is not evidence of
transaction rollback or concurrent transfer safety in MongoDB.

## Configuration and compatibility changes

Before deploying this candidate, configure `AUTH_SESSION_SECRET` on every API
and matchmaking process that verifies sessions. It must be an independent,
cryptographically random secret of at least 32 characters. There is deliberately
no fallback to `BOT_TOKEN` or `API_AUTH_TOKEN`. Missing configuration fails account
sign-in closed. Rotating this secret invalidates existing account sessions.

Configure the backend's `GOOGLE_CLIENT_ID` or comma-separated `GOOGLE_CLIENT_IDS`
with the allowed Google OAuth audiences. `VITE_GOOGLE_CLIENT_ID` is the browser
configuration and does not configure server verification. Google sign-in now
requires a valid, signed Google ID token; cached Google IDs are not credentials.

Legacy Telegram photo URLs included `BOT_TOKEN` in a publicly returned URL.
Treat that token as potentially exposed: rotate it through BotFather before
release, update the server secret, and remove old token-bearing URLs from persisted
profiles, caches, logs, and other published copies. Do not paste the old or new
token into source control or chat. The independent session signing secret avoids
extending that legacy exposure to the new account-session mechanism. Rotation and
production data cleanup are operational follow-up tasks, not completed by this PR.

Existing guest account IDs alone cannot recover an old account. Guests need a
newly issued signed session; Telegram and Google users must prove their provider
identity. A fresh guest profile must not be presented as restoration of a lost
legacy guest account. Existing users may need to sign in again after deployment.

The following routes intentionally remain unavailable until they use an
authoritative, idempotent settlement implementation: client-supplied deposits,
withdrawals/claims, balance and transaction updates, gift transactions, store
purchases, and the unverified reward claims identified by this pass. A client
cannot re-enable these flows by supplying an API token or a public account ID.
Daily check-in uses a conditional atomic update; it does not restore the other
reward claim routes.

Internal transfers require a MongoDB replica set, a stable operation ID, and the
new durable receipt collection. Transfer fees are temporarily omitted until fee
distribution can participate in the same transaction as sender, receiver, and
receipt writes. The patch does not claim that all game stake/settlement systems
have been migrated to the new accounting service.

The real MongoDB regression suite was attempted locally: the downloaded `mongod`
process failed at startup with `open: Operation not permitted`. Consequently,
local unit/HTTP success does not establish real database transaction success.
`RUN_WALLET_MONGO_TESTS=1` is required by the security workflow so CI must execute
that replica-set test rather than silently skip it.

## Native workflow repairs

- Capacitor commands execute from `webapp`, where its configuration lives, using
  the already-installed CLI.
- Native dependency installation uses `npm ci` and caches against the webapp
  lockfile.
- `bundleDebug` no longer asks for release signing keys. Explicit and aggregate
  tasks that build the release variant still require signing configuration.
- The automatic APK workflow builds debug only. A signed production AAB is built
  by `android-store-release.yml`, which uses the existing protected
  `mobile-store-release` environment.
- The signing workflow uses an absolute keystore path and removes generated
  signing files even if a build fails.
- The iOS workflow explicitly performs the `archive` action and fails if its
  unsigned archive is missing.
- Published debug launcher builds are always marked as testing prereleases.
  They are not production Google Play releases.

## Evidence still required before distribution

1. Run the security workflow on the exact candidate commit and inspect all jobs.
2. Run the full web build with its original asset checks. The native jobs still
   use the full asset pipeline; this change does not reduce the asset download or
   package size. The separate `build:native-lite` flow remains opt-in and requires
   a working HTTPS game-pack CDN before distribution.
3. Run the Android native workflow and verify APK/AAB installation on real
   portrait-mode devices. A YAML or shell syntax check is not an Android build.
4. Run the unsigned iOS archive workflow on a suitable macOS/Xcode runner, then
   complete Apple signing and TestFlight separately. An unsigned archive is not
   a distributable IPA.
5. Verify production authentication configuration, Google audience IDs, MongoDB
   replica-set support, monitoring, restore procedures, and the expected disabled
   state of unverified credit/crypto flows.
6. Complete real-device login, reconnect, wallet deep-link, camera/notification
   permission, game loading, memory, and frame-rate testing before store review.

Store credentials, Apple provisioning, production database settings, and external
asset delivery are not provisioned by these source changes. Passing the focused
security gate does not replace full application tests or an independent economy
and smart-contract audit.

## Remaining test migration

`test/allGamesOnlineMatchmaking.test.js` still seeds users through the retired
client deposit endpoint and authenticates player sockets with a service token.
That legacy full-game fixture must be migrated to seeded database records and
per-player signed sessions; its old setup is intentionally rejected. The focused
security gate does not report the full historical game suite as passing.
