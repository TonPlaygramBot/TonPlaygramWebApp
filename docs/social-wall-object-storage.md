# Social wall media storage

The running wall returned HTTP 503 with `mediaStorage: unavailable` on September
7, after the durability patch was merged. Changing JavaScript upload limits does
not provision storage or mount a disk. The new S3 mode puts original photo/video
bytes in a private object bucket and keeps only post details and small resumable
upload manifests in MongoDB. It works with Cloudflare R2 and compatible S3 storage.

## Production configuration

Create or choose a **private** bucket dedicated to wall media. Keep public bucket
access disabled. Configure its S3 credentials in the Render service environment;
never place them in GitHub, browser variables, screenshots or chat. Credentials
need object read/write/delete and multipart upload/list/abort access to this
bucket, plus the bucket metadata permission used by `HeadBucket`.

| Render environment variable     | Value                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `FLAMINGO_MEDIA_STORAGE`        | `s3`                                                                                 |
| `FLAMINGO_S3_ENDPOINT`          | S3 API origin; for R2 use the account's `https://…r2.cloudflarestorage.com` endpoint |
| `FLAMINGO_S3_REGION`            | `auto` for R2; the bucket region for AWS S3                                          |
| `FLAMINGO_S3_BUCKET`            | The private media bucket name                                                        |
| `FLAMINGO_S3_ACCESS_KEY_ID`     | Bucket-scoped access key, server only                                                |
| `FLAMINGO_S3_SECRET_ACCESS_KEY` | Matching secret key, server only                                                     |
| `FLAMINGO_GRIDFS_BACKUP`        | `false` for new direct uploads                                                       |

These settings are opt-in. The Blueprint keeps its current disk configuration so
merging the code alone cannot silently move production to an unconfigured bucket.
Verify the bucket before switching the running service to `s3`. Changing bucket
or endpoint later requires migrating the original objects; stored post pointers
must continue resolving. Existing disk and GridFS posts remain readable through
their current paths. A missing old original still requires a backup or the
author's original file using **Restore video**.

On the bucket, apply CORS for the web app's exact HTTPS origins, including
`https://tonplaygram-bot.onrender.com` when it serves the web app. Add other actual
web/native origins used by deployed clients. Do not copy an unrelated origin.

```json
[
  {
    "AllowedOrigins": ["https://tonplaygram-bot.onrender.com"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Type", "Range"],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Range",
      "Accept-Ranges"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

Configure an **abort incomplete multipart uploads after 7 days** lifecycle rule
as a fallback for API downtime. Do not expire completed `wall/` objects. API
maintenance aborts inactive uploads after 48 hours and retains completed objects
if publication failed, so recovery cannot delete someone's only original. Unused
completed objects retained after a failed post save need operator review.

Run from `bot/` after setting server environment values:

```sh
node scripts/checkWallObjectStorage.js
node scripts/checkWallObjectStorage.js --probe
```

The first command checks reachability. The second writes a new private 32-byte
diagnostic object, checks byte-range playback, then removes that exact diagnostic
object. It creates no public post. Health's `provider: s3` and
`capacity: provider-managed` describe the configured storage backend; they do not
mean unlimited free capacity or prove the account has remaining billing quota.

Deploy the backend and frontend together, refresh the Telegram web app, publish a
photo and video, pause/resume, seek, then restart the API and repeat playback.
Test the actual Telegram Android/iOS web views too. The 5 GB selection limit is
unchanged. Old cached clients that do not support direct uploads must refresh.

## Upload and playback behavior

The API creates a private multipart upload and saves a MongoDB manifest. Each
short-lived upload ticket signs one part and its exact byte length. The phone
sends one 5 MiB part at a time directly to the bucket with no wall authorization
headers or cookies. The API checks each provider ETag and byte count before
acknowledging progress, and verifies the final object size before publishing.
Retries reuse acknowledged parts; a completed object survives a failed database
save without duplicate upload or duplicate publication. Completed upload receipts
expire after seven days; the post's client ID remains the publication receipt.

Feed URLs stay stable. The API returns fresh temporary signed playback locations
with `Cache-Control: no-store`, and the bucket handles the video's range/seek
requests. Download payment checks still run before issuing a download grant.
Deletion removes the selected post's exact object only if no other post references
it. Telegram channel imports stream into the same bucket in S3 mode.

The existing app still needs database space for posts and upload manifests.
Object storage removes media bytes from the MongoDB quota; it cannot fix an
already exhausted database account. Check that account's allocation separately.

## Capacity and cost

Storage grows with uploaded objects instead of stopping at the API disk size.
Choose billing alerts and a budget appropriate to actual use. At R2 Standard's
published September 7, 2026 rate, storage is $0.015 per GB-month, with 10 GB-month
included; request charges apply above the included request allowance. Direct R2
egress is free. These are estimates for storage held throughout a month:

| Stored originals | Approximate storage charge/month |
| ---------------- | -------------------------------: |
| 100 GB           |                            $1.35 |
| 500 GB           |                            $7.35 |
| 1,000 GB         |                           $14.85 |

No bucket, billing plan or disk upgrade is purchased by this code change.
Other S3 providers have their own rates. Check current pricing before enabling.

Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[R2 signed URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/),
[R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/),
[S3 multipart uploads](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html).
