# Social wall storage recovery

The September 6 report showed a 555.2 MB video failing with a storage-full
message. The previous API used that message for both disk exhaustion and MongoDB
quota errors. Its health check tested directory access without measuring space.
Live inspection returned two old posts; both video URLs returned 404. Their
recorded 1,694,115,409 bytes are not a measurement of recoverable disk space.

This release:

- Reserves unwritten bytes for resumable uploads, with 64 MiB filesystem headroom,
  before accepting another file. Admission is serialized within the API process.
- Expires uploads after 48 hours without activity. Active sessions, completed
  manifests and final files referenced by a public post are retained. Only
  validated UUID session files are eligible; malformed metadata is left alone.
- Stops failed GridFS streams and removes their partial chunks. Maintenance also
  removes orphan chunks older than 48 hours, rechecking for a completed file,
  recent chunks, an active transfer and post references. Each pass handles up to
  100 historical candidates, every 10 minutes and during upload initialization.
- Returns separate `WALL_DISK_FULL` and `WALL_DATABASE_QUOTA` errors with HTTP 507.
  The client preserves the selection and stops automatic retries for these errors.
- Sends live-feed heartbeats without compression buffering.

## Requested post removal

The deployment runs `removeRequestedWallPosts` when MongoDB connects. It removes
only these reviewed records, guarded by their author, timestamp, content and
attachment metadata. It is safe to rerun. A changed record stops removal for
review. The shared label is never used to select additional posts.

| Post ID                    | Original video   | Published UTC           |
| -------------------------- | ---------------- | ----------------------- |
| `6a94689790f890313ad875e0` | `1000235334.mp4` | 2026-08-30 17:29:59.517 |
| `6a9422dbdd036aa24c413368` | `21635.mp4`      | 2026-08-30 12:32:27.310 |

It removes their exact disk/GridFS originals only when no other post references
them or the same legacy filename/size. Missing files are accepted; reported
recovered bytes are measured from files actually removed. No API authorization
rules are changed.

## Inspecting or applying recovery in the Render service shell

Run from `bot/` with the existing service environment and this release checked out:

```sh
node scripts/repairWallStorage.js
node scripts/repairWallStorage.js --apply
```

The first command reports disk capacity, database allocation, old orphan chunks
and the two matching posts. The second applies the reviewed deletion and expired
upload cleanup. Run manual `--apply` while uploads are paused: the CLI is a
separate process and cannot see the API's in-memory upload locks. The server does
this on deployment as well.

Check `/api/flamingo-wall/health` for `storage.freeBytes`, `reservedBytes`,
`availableBytes` and `backup`. Database connectivity does not establish that the
MongoDB plan has spare quota; the hosting/database dashboards remain authoritative
for plan limits. Review service logs for the specific upload failure code.

The existing Render configuration specifies a 10 GB persistent disk at
`/var/data/tonplaygram` and disables GridFS backup. Verify that the running service
actually has that disk mounted and `FLAMINGO_GRIDFS_BACKUP=false`. A source change
to `render.yaml` alone does not verify an existing service's environment. Keep
GridFS enabled wherever it is the only durable storage until a persistent disk
is attached. Do not increase the advertised 5 GB upload limit to solve a quota
error. The capacity reservation lock assumes the current single API process per
mounted disk; additional writers need a shared reservation mechanism.

After deployment, confirm the two IDs are absent from `/api/flamingo-wall/posts`,
publish a photo and an article, and resume a video after pausing. Confirm playback
and seeking after publication. Local route tests use real HTTP streams and
filesystem writes with a mocked database; production database quota and disk
mount verification require service access.
