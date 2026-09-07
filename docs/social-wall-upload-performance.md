# Social wall upload performance

The wall streams original media to the existing service's persistent disk. It
does not load a whole video into server RAM. The September 7 inspection found
about 256 MiB of memory in use out of 2 GiB, and roughly 9.9 billion bytes
available for new uploads on the 10 GB disk after pending upload reservations.
Adding RAM does not increase that disk capacity or a phone's upstream bandwidth.

The browser now overlaps small resumable requests instead of waiting for every
round trip before starting the next range:

- Up to three requests on normal connections, two without network information.
- One request on 2G/3G, with data saving enabled, or on devices reporting at most
  2 GiB of memory.
- A transient retry reduces the remaining upload to one worker. Existing
  requests finish and keep their receipts; extra workers then retire.
- Chunk concurrency is also capped by a 16 MiB in-flight byte budget (with at
  least one chunk for servers that advertise a larger chunk size). Render keeps
  its 1 MiB chunks; optional S3 storage uses 5 MiB parts.
- Progress advances only after a range is acknowledged. Resuming skips received
  ranges. Publication waits for all workers and retains its idempotency checks.

The composer still uploads selected files in sequence, so choosing many videos
does not multiply the concurrency or read all of them into RAM. The 5 GiB batch
limit and 20-file selection limit are separate from the service's total storage.
Actual transfer speed depends on upstream bandwidth, latency, and phone/browser
behavior; parallel requests cannot promise a fixed speed multiplier.

The upload tests cover connection and memory limits, retry fallback, failure
cancellation, acknowledged progress and direct-storage credentials. The HTTP
tests exercise concurrent and duplicate range writes, resume, publication and
byte-for-byte playback across a chunk boundary, using a temporary disk and a
mocked post database.

Capacity remains a separate operation: increase the existing `protest-media`
disk's `sizeGB` in `render.yaml` after reviewing the recurring charge. Keep the
service name, disk name and mount path. Render disk sizes can grow but cannot
shrink. After applying a resize, verify `/api/flamingo-wall/health` reports the
new capacity, persistent storage and positive `availableBytes`. Do not infer a
successful resize from the Blueprint alone.

## Restoring the phone picker file path

The September 6 composer remake replaced the original phone picker `File` with
`new File([original], ...)` to set its MIME type. The older complete wall kept
the picker object intact. A later Android report showed an upload session being
created successfully but no video ranges reaching the API, with a blank local
preview. The 100 GB persistent disk was healthy. This points to the client file
or transport path; server logs alone cannot identify the exact Android file
provider error.

The composer now retains the original picker `File`, as in the older wall, and
infers MIME metadata separately. Previews, article covers, download options and
upload metadata use that inferred type without creating a replacement file.
The transfer reads only each small range into an `ArrayBuffer` before sending
it, so fetch does not have to reopen a file-backed Blob request body. The same
bounded concurrency, capacity reservations, acknowledged progress and stable
publication IDs apply. An unreadable or incomplete phone file now produces a
specific reselect-file message instead of claiming the network disconnected.
Pausing also stops while a file read is pending.

Run `npm run test:wall --prefix webapp` for original-file identity, MIME fallback,
retry identity, article cover/options and text-only article behavior. The root
`wallUpload` and `flamingoUploadRoutes` suites cover byte-buffer transfer, read
failure/cancellation, resume, storage and publication using a temporary disk and
a mocked post database. Cloud browser URL policy blocked the local and offline
previews in this environment. The reporting phone's actual Telegram file picker
has not been verified here; reselect the video after reopening the updated app.
