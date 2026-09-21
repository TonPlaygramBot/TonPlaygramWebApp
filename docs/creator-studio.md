# TPG Creator Studio

A user-facing page at `/creator-studio`, linked from Home. It is independent of the existing `/admin/social` mock publisher and the social wall. No games, TPG prices or wall logic change. No packages, lockfiles, paid resources, existing Render service settings or secrets are changed.

## What is implemented

- Same-window OAuth redirects: tap Connect, approve on the platform, return to Studio. No user-entered developer codes, passwords or stream keys.
- Signed Studio sessions through fresh Telegram init data or Google authorization-code login. The existing unsigned account/Google headers are deliberately insufficient to authorize private social grants. Google and Telegram identities have separate Studio workspaces; keep using the same sign-in method. Account linking across those identities would need a separate verified linking flow.
- Per-owner, authenticated AES-256-GCM token encryption; OAuth state tied to an HttpOnly browser cookie, single-use MongoDB state with 10-minute expiry, PKCE on Google/YouTube/X, and supported token refresh. No provider secrets or RTMP keys in the browser.
- Multiple connected accounts; Facebook Page discovery; clear unsupported account types and setup states.
- Shared composer, editable platform captions, preview, validated JPG/PNG/H.264 MP4 upload, a reusable media library, server-saved/editable drafts, local-time scheduling (stored as UTC), per-destination progress and explicit retry after checking the platform.
- Resumable 1 MB upload parts, 250 MB per-file limit and 1 GB per-owner allowance. Media stays on the existing persistent disk. Provider retrieval uses signed links that expire after 24 hours and are created when a queued job runs, not when it is scheduled. No arbitrary user-provided fetch URLs.
- Durable MongoDB publication records, atomic delivery claims, per-platform dispatch (up to three simultaneously per post), asynchronous media processing checks. Crashed or ambiguous writes require review instead of automatic duplicate publishing. Draft submission is idempotent. Schedules survive a server restart.
- Portrait-first live studio, 720p/1080p, front/back camera, microphone/video toggles, screen sharing where the browser supports it, wake lock where supported, and per-destination live confirmation. Browser capture is sent once; FFmpeg relays to up to three platforms. Keys are obtained via APIs. Bounded queues terminate a stalled uplink instead of growing memory without limit. Ending, navigation, disconnect and inactivity clean up processes and remote broadcasts. Interrupted sessions retain cleanup records.

## Platform coverage and research

Research checked 21 September 2026. API permission approval is separate from implementing an adapter. The links below are official platform documentation or Meta's own Postman workspace.

| Platform | Posting adapter | Live adapter | Requirements / limits |
|---|---|---|---|
| YouTube | MP4 video; title, visibility, made-for-children setting | Create broadcast and stream, bind them, retrieve ingest details automatically, auto-start/stop, query status | Google OAuth consent verification / YouTube API audit may be needed; uploads from unaudited projects can be restricted to private; the channel must be live-enabled |
| Facebook | Page text, photo and video | Page Live Video | Managed Pages, required Page permissions and Meta review; no personal-profile publisher |
| Instagram | JPEG photo and MP4 Reel with container processing | Not offered | Business/Creator account through Instagram Login; app review; users do not need to link a Facebook Page for this login flow |
| Threads | Text, image and video containers | Not offered | Threads app with basic/content-publish scopes and review |
| TikTok | Direct Post original MP4, creator-info options, consent/disclosure, status checks | Not offered | Direct Post audit, approved permissions, and verified ownership of the media URL prefix. Explicit privacy selection; interaction choices off by default. Publish-now only, so current creator settings can be reviewed |
| X | Text and links | Not offered | OAuth 2.0 PKCE, posting scopes and platform API access/billing; attached-media publishing is not implemented |
| Twitch | No feed-post adapter | API stream-key retrieval and official ingest discovery | Twitch OAuth scopes, eligible channel; broadcaster must follow Twitch simulcasting rules |

Sources:

- [YouTube broadcasts and streams](https://developers.google.com/youtube/v3/live/guides/implementation/broadcasts-and-streams)
- [YouTube OAuth](https://developers.google.com/youtube/v3/live/authentication)
- [YouTube uploads and audit restrictions](https://developers.google.com/youtube/v3/docs/videos/insert)
- [Meta Instagram Login](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login)
- [Meta Instagram publishing and media specifications](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [Facebook Live Video API](https://developers.facebook.com/docs/live-video-api/)
- [Meta Threads publishing status](https://www.postman.com/meta/threads/request/m47wqlq/check-container-s-publishing-status)
- [TikTok posting requirements](https://developers.tiktok.com/docs/en/content-sharing-guidelines)
- [TikTok Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post)
- [X OAuth 2.0 PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token)
- [X create posts](https://docs.x.com/x-api/posts/create-post)
- [Twitch OAuth](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth)
- [Twitch stream keys](https://dev.twitch.tv/docs/api/reference#get-stream-key)
- [Twitch broadcasting](https://dev.twitch.tv/docs/video-broadcast/)
- [Twitch ingest discovery](https://dev.twitch.tv/docs/video-broadcast/reference/)

Several direct Meta documentation URLs rate-limited the research client. Their official Postman workspace was used where available. No unofficial/unrestricted TikTok or Instagram live APIs are used. This is not a claim of partner access or platform approval.

## One-time operator setup on Render

Regular users do **not** perform this setup. Register TonPlayGram's developer apps with the providers; never ask users to obtain a client secret or paste a stream key.

1. Set `CREATOR_PUBLIC_URL` to the exact HTTPS origin serving the app/API. This deployment expects same-origin cookies and sockets. In-app browsers that reject social OAuth should open this origin in the device's browser and use Google sign-in.
2. Generate a 32-byte base64 `CREATOR_ENCRYPTION_KEY`, store it in Render, keep it stable and back it up securely. Do not commit it. Existing grants require the old key to decrypt after a rotation; support a migration or ask users to reconnect.
3. Set each enabled provider's `CREATOR_*_CLIENT_ID` and `CREATOR_*_CLIENT_SECRET` from `bot/.env.example`. Google is used for Studio login and YouTube, Meta for Facebook, and separate Instagram/Threads apps for their direct login flows. TikTok calls its identifier a client key; put it in `CREATOR_TIKTOK_CLIENT_ID`.
4. Register exact redirect URIs: `${CREATOR_PUBLIC_URL}/api/creator/oauth/{provider}/callback`, where provider is `google`, `youtube`, `facebook`, `instagram`, `threads`, `tiktok`, `x`, or `twitch`. Google needs BOTH the google and youtube callbacks. Configure the permissions listed in `bot/creator/oauth.js`, submit app reviews, and publish accurate privacy/data-deletion information for Studio before allowing public users.
5. Keep the current Render persistent disk. `CREATOR_MEDIA_DIR=/var/data/tonplaygram/creator-media` is recommended. With no override, the code derives a sibling of the configured wall-upload folder; in production, it refuses an ephemeral fallback. Existing `ffmpeg` and `ffprobe` are reused.
6. Verify the TikTok media URL prefix `${CREATOR_PUBLIC_URL}/api/creator/media-file/` and pass the Direct Post audit before setting `CREATOR_TIKTOK_APPROVED=true`. This flag is an operator attestation, not an automatic approval check.
7. Before `CREATOR_LIVE_ENABLED=true`, connect real test channels, perform an unlisted YouTube broadcast alongside Facebook/Twitch as permitted by their account settings, check audio/video and stop behavior, and monitor Render CPU/memory. The default cap is ONE concurrent broadcaster and THREE destinations. Each destination gets one bounded FFmpeg process; 1080p transcoding needs substantial CPU. Increasing the cap without load testing can affect the existing bot/games. No extra paid service is provisioned by this change.
8. This relay targets the existing single-instance service with a disk. Before horizontal scaling, move the relay and uploads to dedicated infrastructure and use distributed admission/refresh/upload locks and routed session ownership. The durable publication claim is already atomic in MongoDB.

Missing credentials or disabled live mode are normal, visible unavailable states. Importing/mounting the router does not require provider credentials, a new package installation or a schema migration. The added collections/indexes are created by Mongoose.

## Verification and launch boundary

Commands:

```sh
node --test bot/tests/creatorSecurity.test.js bot/tests/creatorMedia.test.js
node --test bot/tests/creatorStudio.test.js
cd webapp
node node_modules/vitest/vitest.mjs run --config vitest.creator.config.mjs
node --max-old-space-size=3072 node_modules/vite/bin/vite.js build
```

The integration suite uses a disposable MongoMemoryServer by default. CI supplies the dedicated `creator_studio_ci` database and checks owner isolation, OAuth state, idempotent submit, atomic claims, ambiguous failures and durable schedules with mocked remote API responses. It never sends real social posts. The encoder test converts real synthetic WebM/audio into portrait H.264/AAC FLV.

The supplied preview is an interface demonstration with explicit demo data and no external publishing. It must never be used as evidence of a real connection or successful broadcast.

External OAuth consent, public posting, quota behavior and end-to-end broadcasts require approved provider applications and test accounts. They cannot be verified without those credentials. No public post, real broadcast, Render deployment, or merge to main is performed by this PR. Guests, unified live chat, engagement analytics, recording/replay storage, carousel/Story editing, LinkedIn and X media uploads are not included in this version.
