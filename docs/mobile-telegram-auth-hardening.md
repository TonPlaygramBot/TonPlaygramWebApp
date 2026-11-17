# Telegram credential validation hardening

This focused change validates the legacy Telegram payload used by HTTP auth,
Socket.IO identity extraction and the service-protected matchmaking session route.
It preserves the verifier's object-or-null return contract.

- Rejects missing BOT_TOKEN, invalid/duplicate fields and malformed or unsafe user IDs.
- Compares HMACs with a timing-safe comparison.
- Accepts at most 24-hour-old credentials, with 60 seconds of future clock tolerance.
- HTTP auth cannot downgrade an invalid Telegram payload to account/Google ID hints.
- A separate configured API_AUTH_TOKEN still works, including alongside invalid Telegram data.

## Before deployment

Confirm BOT_TOKEN is configured correctly and server time is synchronized. Test a
fresh Telegram launch, HTTP profile operations, socket reconnect and matchmaking.
After 24 hours the user must reopen the mini app for fresh init data; this is a new
intentional security boundary, not a claim of invisible session renewal. Existing
social auth already has its separate shorter validity policy. Do not deploy this
without checking the app's reauthentication UX on a real device.

## Explicitly not solved by this PR

Raw compatibility account/Google identifiers are still accepted on other legacy
paths, including socket and service-protected matchmaking fallbacks. This PR does
not secure those paths globally, authorize arbitrary reward amounts, make rewards
atomic/idempotent, implement complete account deletion, or make the app store-ready.
Those require a coordinated frontend/backend credential and reward migration.
No production configuration, balances or user accounts were changed during tests.
