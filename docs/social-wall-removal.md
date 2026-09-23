# Retire Social Wall to stop media egress

Social Wall is removed from the main app and the installed Social app. Home no
longer fetches or autoplays the latest video. Legacy wall/profile links redirect
to Social Hub; chats, friends, Creator Studio and all games remain available.

The server returns a small HTTP 410 response for all `/api/flamingo-wall`,
`/api/protest-videos`, `/api/social/wall` and `/ProtestVideo` requests, before
upload parsing and static serving. This includes byte-range playback, downloads,
thumbnail/avatar media, events and old installed clients. Wall routes, Telegram
ingestion, video maintenance/backfill and wall notifications no longer start.
New service workers do not load wall workers; the legacy upload-worker build
entry is inert. Public protest videos are excluded from new full-app downloads.

Existing posts, paid-download records, local pending uploads and original media
are retained. Wall source files remain for data recovery, but neither app mounts
the wall UI or upload provider, and the server no longer mounts its media routes.

## Render service cleanup

The obsolete service is **tonplaygram-chess-matchmaking**
(`srv-dafd0t740ujc73apdqb0`). Chess is already embedded in **tonplaygram-bot**
(`srv-d12m9ibe5dus73ck1p6g`) at `/colyseus`. `render.yaml` declares only the main
service. Preserve the chess package and its bot postinstall build: the embedded
gateway still needs them.

Suspend the obsolete service to stop its compute charge; after confirming chess
clients use the main gateway, the obsolete service can be deleted. A GitHub PR
does not suspend or delete an existing Render resource; the live service
requires a separate operation in Render.

## Billing boundary

The traffic change takes effect only after deploying this code. It does not
refund accrued bandwidth or build fees. The existing 100 GB persistent disk
remains attached, so its storage charge continues. It also holds existing media
and Creator Studio state; deleting it is not part of this change.
