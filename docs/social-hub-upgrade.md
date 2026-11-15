# Social Hub upgrade review

The Social Hub now has a portrait-first chat interface and encrypted direct-message text and files, with verified account access, privacy controls and real local call activity. It replaces fabricated online counts/unread labels, placeholder actions and the old plaintext inbox composer.

## Delivered behavior

- Search friends and loaded message text, pin friends locally, reply using references, select emojis, send encrypted files up to 2 MiB, and invite friends to games.
- UI disappearing timers: off, 1 hour, 24 hours and 7 days, starting at send time. Protocol validation also supports 5 minutes. Server reads and clients reject expired content; MongoDB TTL performs later physical removal.
- Sender-only delete for everyone, delete for me, and clear conversation for me, with confirmations and server authorization. Reply quotes disappear with the original loaded message. Clear operations preserve newer messages and cannot be undone by delayed requests.
- Safety-code comparison, locally pinned fingerprints, blocked sending after key changes, explicit verification and device-key reset. Opening the hub enrolls a key when none exists; each participant must open the upgraded hub before exchanging encrypted messages.
- Call history contains local metadata only, retains up to 100 entries for seven days, and supports individual/all-entry removal. Ending/expiring calls clears live signaling state; no call media is recorded by this flow.
- Private calls verify participants and acceptance, relay signaling directly to verified connections, and work in the standalone Social shell as well as the main app.
- Message pagination streams database results and caps each response at 6 MiB. Legacy file previews are authenticated and bounded; active file MIME types are download-only.

## Deployment requirements

Deploy the bot and webapp together. Old clients cannot send plaintext messages after this change. Cached display profiles and public account IDs are insufficient to authenticate private conversations, so users with only those values must sign in again.

Configure the bot's existing `BOT_TOKEN` and server-side `GOOGLE_CLIENT_ID` (or comma-separated `GOOGLE_CLIENT_IDS`) to match the web client audience. `VITE_GOOGLE_CLIENT_ID` is accepted as a compatibility server fallback when present. Google token verification uses the official Google authentication library and needs access to Google's signing certificates. Serve the app over HTTPS with IndexedDB available. Do not expose server secrets to the frontend.

Account creation/restoration and Google linking now require verified credentials; anonymous repeated allocation and client-chosen account reassignment are rejected. Existing stored account IDs and wallets are preserved. This does not repair all unrelated legacy platform authorization paths.

Ensure MongoDB indexes exist for `Message.expiresAt` (TTL), the partial unique `(from, clientMessageId)` index, and `SocialIdentityKey.accountId`. If index auto-creation is disabled, provision these explicitly. Do not run a blanket destructive index synchronization as a migration.

There is one active published identity per account, not synchronized multi-device keys. Clearing site storage or moving to another device can make history unreadable. A reset cannot recover a missing key. Legacy plaintext messages are labeled; existing copies are not retroactively encrypted. Read [social-hub-security.md](social-hub-security.md) for the protocol and limits, including no forward secrecy and no independent cryptographic audit.

## Validation

- 84 Node tests passed: authenticated identity creation, Telegram/Google validation, socket isolation, private calls, real WebCrypto encryption/decryption, key pinning, message routes, expiry, deletion races, attachments, influencer conversation isolation and bounded pagination.
- 32 frontend tests passed: real crypto behind mocked HTTP/IndexedDB, hub interactions, delayed-load/send/deletion races, key reset and privacy controls, auth expiry, credential freshness and standalone calls.
- 9 standalone Social app tests passed.
- 53 shared live-video regression tests passed after rebasing onto the latest Pool Royal changes.
- Root TypeScript build and full Vite production compilation passed; existing large-chunk warnings remain. Final post-rebase build status is recorded in the PR.
- Server syntax checks and whitespace checks passed.

Commands:

```sh
node --experimental-test-module-mocks --test bot/tests/accountIdentitySecurity.test.js bot/tests/socialAuth.test.js bot/tests/privateCallStore.test.js bot/tests/secureMessageProtocol.test.js bot/tests/secureMessageRoutes.test.js bot/tests/messageAttachment.test.js bot/tests/influencerConversationIsolation.test.js test/secureMessagingCrypto.node.mjs
npm run test:navigation --prefix webapp -- src/pages/Messages.navigation.test.jsx src/utils/secureMessages.navigation.test.js src/utils/google.navigation.test.js src/components/SocialCallController.navigation.test.jsx
npm run test:social --prefix webapp
npm run build
cd webapp && node --max-old-space-size=3072 node_modules/vite/bin/vite.js build
```

These checks use injected in-memory repositories and mocked HTTP, not production MongoDB or live Google login. Local Chromium cannot launch (`socket() failed: Operation not permitted`), so live phone layout, native WebView key persistence, two-account messaging and live voice/video remain unverified. Full asset-vendoring/download packaging and deployment were not run. Before release, verify those flows on two devices, including reauthentication, deleted/expired messages while reconnecting and permission cancellation during calls. An independent security review is necessary before making high-assurance messaging claims.
