# Social wall notifications

The bell on the social wall opens separate opt-in switches for Telegram and the
current browser. Both are off by default. Telegram needs a linked account and a
started/unblocked TonPlayGram bot. Browser push works for Google users and other
signed-in accounts with permission on a supported HTTPS browser. On iPhone/iPad,
open the installed Home Screen app to enable Web Push.

## Render runtime

No extra Render service or new environment variables are required. The existing
API process starts a bounded notification worker when MongoDB connects. It uses
the existing `BOT_TOKEN`/Telegraf client and `WEBAPP_BASE_URL` (with the existing
production URL fallback). `web-push` is installed from `bot/package-lock.json`.
VAPID keys are generated once and persisted in `WallPushKey`; only the public key
is sent to the client. Preserve that collection across deployments and backups.

`WallSubscription` stores per-channel consent, browser subscription credentials,
a delivery cursor, retry time and a lease. The worker reads new posts, including
Telegram imports. It skips posts from before opt-in, the subscriber's own posts,
and publications older than 24 hours. Publication edits and upload retries do
not replay a post. Opt-out takes effect before the next send; a message already
in transit may still arrive. Multiple API instances use subscription leases.
Transient failures back off; expired browser endpoints and blocked Telegram bots
are disabled. Delivery retries after a crash between send and cursor update can
produce a duplicate Telegram message; browser tags group the same post.

Notification clicks open the actual post, including posts outside the first feed
page. Delivery tests use repository/transport doubles; they do not message real
users. Real-device acceptance should cover Telegram, a Google account in Chrome,
and the Home Screen app on iOS, with both opt-in and opt-out.

## Video playback and author profiles

Visible wall videos look up their available qualities and choose 360p when ready.
New uploads prepare 360p first. While conversion is unavailable or in progress,
the original remains playable; videos already at/below 360p are not upscaled.
The quality menu still allows manual selection without a later automatic change
overriding the viewer's choice. Downloads remain free unless the author selected
Premium, as before this change.

Post authors with an account ID are refreshed from their current profile. Signed
Telegram/active Google identity takes precedence over a stale cached guest ID.
Telegram profile photos are served through a restricted image endpoint so bot
credentials never appear in wall responses. Missing photos fall back to initials.
Anonymous historical posts cannot be attributed to a real account without a
trusted ownership link.
