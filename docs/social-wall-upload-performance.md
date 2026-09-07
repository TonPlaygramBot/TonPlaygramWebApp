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
