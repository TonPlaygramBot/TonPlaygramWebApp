# Social Hub report intake (draft, not store-readiness approval)

Adds a category-only report action in conversation options. The explicit submit
screen tells the user that private messages/files are not uploaded and reporting
does not block contact or guarantee a response. No decrypted content or free text
is accepted or persisted. Existing private conversations are unchanged.

## API and access

All routes are mounted behind signed `socialAuthenticate` and additionally require
`socialVerified` plus a non-banned canonical account. Compatibility identity headers
and API token alone cannot submit or read reports. Targets use exact account IDs,
never a mixed Telegram/account lookup. A reporter can report any existing account
(except itself), including an account that is no longer a friend. Reports do not
prove the reported behavior happened and must never automatically penalize users.

- `POST /api/social/reports`: `{ targetAccountId, reason, requestId }`. Reasons:
  harassment, spam, unsafe_content, impersonation, other. A UUID v4 request ID is
  unique per reporter. Replays return the original receipt; changed parameters
  conflict. Database failure does not show a success message.
- `GET /api/social/reports`: oldest 100 pending reports, **only** for signed users
  whose canonical account ID is in server-only `SOCIAL_MODERATOR_ACCOUNT_IDS`.
  Default is deny-all. No `VITE_` or compatibility developer-ID bypass.
- `PATCH /api/social/reports/:reportId/reviewed`: same moderator restriction,
  changes pending to reviewed and records reviewer account/time. This is queue
  bookkeeping only: it does not ban, delete content or block a user.

## Operator setup required before release

No allowlist, production configuration or moderator assignment was changed by this
PR. Owner must designate trained moderators, establish response/escalation and
appeal procedures, configure the server-only allowlist, and verify authenticated
queue retrieval and resolution. There is no moderator dashboard or notification
worker in this change. A trusted moderator client must use the API; do not copy
credentials into logs, URLs, documentation or support chats. Mark reviewed only
after investigation so remaining pending reports become visible in the queue.

Reporter/target IDs and category are personal report metadata. No automatic TTL is
set: retention, access, and deletion exceptions need an approved policy, then code
and privacy disclosures. The account-deletion work must explicitly include this
collection or document a justified retention exception before release.

## Tests and remaining gates

Unit/in-memory repository tests cover identity, payload minimization, retries,
11000 race recovery, failures, review authorization and bounded queue. A real local
HTTP test proves request 11 is rate-limited and different verified reporters are
isolated. Limiter uses per-process memory: replicas/restarts reset it. A shared
limiter and abuse controls are needed for production scale.

UI tests cover consent, cancel, retry reuse, repeated taps, and late responses after
conversation navigation. These are jsdom tests, not physical-phone/browser QA.
Real Mongo unique-index/concurrency verification and deployed operator flow remain
unverified. Ensure the compound unique index exists before serving this endpoint.

**Still missing:** enforced user blocking across messages/calls/invites, production
moderation operations, evidence submission with explicit consent if necessary,
complete retention/deletion integration, and end-to-end mobile verification. This
PR alone does not satisfy App Store or Google Play UGC requirements.
