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

The Render configuration specifies a 100 GB persistent disk at
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

## September 7: an existing video's original is missing

The `Dita e 99` post (`6a9e513b061a6233031bd847`) still existed, but a range
request for its 134,153,499-byte `23117.mp4` returned HTTP 404. The API reported
about 415 GB of filesystem capacity, although the Blueprint declares a 10 GB
disk. This suggests the running upload directory was on a different filesystem;
it does not prove which mount or environment settings the service actually had.
The August 30 removal above does not match this post.

The durability fix defaults Render media writes to
`/var/data/tonplaygram/flamingo-uploads`, checks the real upload directory against
`/proc/self/mountinfo`, and rejects publication on an unverified disk unless
GridFS backup is explicitly enabled. Configure `FLAMINGO_PERSISTENT_MOUNT_PATH`
to the actual mount point if it differs from `/var/data/tonplaygram`.
The check rejects the root filesystem, symlinks outside the mount, unrelated
parent mounts, and volatile nested mounts. Health reports `not-durable` with
HTTP 503 instead of calling such storage available. Articles without attachments
remain publishable. Existing GridFS backups are no longer automatically pruned
when disk-only uploads are published.

Before accepting more videos, verify the **running Render service** has its disk
attached at the configured mount, then check health for
`storage.durability.persistent: true` (or confirmed GridFS backup with capacity).
Source configuration alone does not provision or inspect an existing disk.
[Render documents that only data written under the actual persistent disk mount
survives service restarts and redeploys](https://render.com/docs/disks).

For an older original, first check the configured disk, legacy upload directories
and database backup. `FLAMINGO_LEGACY_UPLOAD_DIRS` can make an existing recovery
copy readable without changing new upload destinations. Do not restore a whole
disk snapshot over newer uploads merely to recover one video.

If no server copy remains, the author can choose **Restore video** on the missing
media card and select the original file. The new media-status endpoint distinguishes
a missing server file from a playback or network failure. Restoration requires the
existing owner token and the original byte count, uses resumable uploads, and updates
only the attachment on the original post. The ID, caption, creation date, author and
engagement keys stay unchanged. A different browser/device without the original
owner token cannot restore the post. Filename/size matching cannot prove identical
content; select the original, not a different same-size video. Missing bytes cannot
be reconstructed from the database record or a screenshot.

Verify playback and seeking, restart the API, then repeat playback. Local tests
cover real HTTP/range requests and persisted files with a mocked post database;
they do not establish that the production Render mount survives a redeploy.
To inspect the recovery UI with an isolated sample video, run
`node webapp/scripts/build-social-wall-preview.mjs /path/to/preview.html` and open
that preview with `?missing=1&bytes=<sample-video-byte-count>`. Its transport never
contacts the production API.

Public wall responses also redact Telegram file-avatar URLs containing bot
credentials, using initials when no safe avatar exists. Previously exposed
credentials still require rotation through the bot owner's credential controls;
redaction does not revoke them or replace credentials in other profile services.
