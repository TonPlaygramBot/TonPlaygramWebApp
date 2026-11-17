# Account deletion follow-up (draft; not store-ready)

This change accepts freshly verified Google or Telegram credentials using the
existing identity verifier. Account IDs, Google subject headers and the global
server API token alone no longer authorize destructive deletion. Server tools
that previously deleted with API_AUTH_TOKEN must use an independently reviewed
admin workflow instead. No such workflow is added here.

The requested account is read and matched to verified claims inside a MongoDB
transaction. Both supplied identities must belong to that account. Pending
embedded transactions or a current table block deletion. The same transaction
removes the User document (including provider links, push tokens and embedded
history), participant messages, friend requests, identity keys, active connection
rows, and references in other users' friends arrays. Telegram identities are
matched in both legacy numeric and string forms; Google subjects are not treated
as social account IDs.

## Release gates and remaining scope

- Requires MongoDB replica-set/sharded transactions. Standalone MongoDB fails
  closed with HTTP 503; there is intentionally no partial-deletion fallback.
- Unit/route tests use isolated dependency mocks. A local replica-set test was
  attempted but MongoDB exited with `open: Operation not permitted`; actual
  transaction commit/rollback and concurrent writers are NOT yet verified.
- Existing active sockets/calls are not disconnected by deleting database rows.
  A platform-wide deletion tombstone/write barrier and session revocation remain
  necessary to prevent stale requests recreating data during/after cleanup.
- External uploaded media, legacy wall posts/comments/reactions, game history,
  other users' transaction/gift references, referral records, analytics/logs and
  backups require separate ownership/retention handling. This is NOT complete
  account/data erasure or proof of store compliance.
- Check financial retention obligations before deploying any hard-delete flow.
  This retains the existing embedded-history deletion behavior, not a new policy.
- Verify Google audiences and fresh-token delivery and Telegram reauthentication
  in the installed app. No physical-phone or production deletion was performed.
- Keep draft until independent review, replica-set integration tests and the
  broader deletion/retention plan are complete. Do not merge or deploy as a
  finished account-deletion feature.
