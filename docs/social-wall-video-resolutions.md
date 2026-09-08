# Wall video resolutions

The three-dot menu on wall videos offers Resolution and Playback speed in both
the feed and the fullscreen viewer. Changing to a ready resolution preserves
the playback time, play/pause state, speed, mute and volume. While a new copy is
being prepared, the current video keeps playing. A playback error on a smaller
copy returns to the original.

Download video opens a portrait dialog with the same resolutions, dimensions,
ready file sizes and the existing TPG price. Selection/preparation never charges
the viewer. The explicit Download button requests the normal signed grant for
the selected copy. The API verifies that the exact rendition exists before any
debit. Original downloads and their pricing remain supported.

## Real media copies

`bot/services/flamingoVideoRenditions.js` runs the existing native FFmpeg and
FFprobe binaries; it needs no new Render service or npm binary download.
[Render includes FFmpeg at build time and runtime](https://render.com/docs/native-runtimes#tools-and-utilities).

The available targets are 144p, 240p, 360p, 480p, 720p, 1080p, 1440p and 2160p,
limited to the source's smaller displayed dimension. Portrait 720p is typically
720 × 1280. The original is always a separate option; there is no upscaling or
claim of adaptive bitrate streaming. FFprobe inspects aspect/rotation metadata,
and FFmpeg preserves visible orientation while producing H.264/AAC MP4 files
with a fast-start header. [FFmpeg scale reference](https://ffmpeg.org/ffmpeg-filters.html#scale-1).

Common resolutions are prepared in the background; other resolutions are
prepared when requested. At most one encoder runs at a time, with one
encoder/filter thread, bounded subprocess output and timeouts. Both the output dimensions and complete duration are
checked before advertising a rendition as ready. The original is never changed.

Copies and request markers live under the existing upload disk's `.qualities`
directory. Keys include the post and its original storage identity so restored
media cannot reuse stale renditions. Interrupted requested conversions restart
when the menu is reopened. Completed copies survive deploys. Deletion and the
existing maintenance cycle clear copies for removed/replaced posts and abandoned
temporary files.

The derivative cache is capped at 10 GiB; older unused copies can be regenerated.
Recent use protects a copy for ten minutes, longer than the five-minute download
grant. A single output is capped at 2 GiB. Admission estimates the required space
and leaves 512 MiB for uploads; a running conversion stops if upload-aware free
space falls below 256 MiB. A full/busy cache leaves the original available.
Disk originals are read in place. Legacy GridFS/object originals are temporarily
streamed to the same disk with a size bound, then removed after the job.

## API and verification

### Faster preparation

Common copies (1080p, 720p, 480p, 360p, 240p and 144p, below the original's
resolution) now start preparing after publication. Maintenance primes the latest
20 video posts, including after a restart. This work is asynchronous and does not
delay an upload's completion response. Only one background copy per post is
queued at a time, leaving queue space for viewer selections.

A viewer's explicit choice takes priority over background work. An active
background encode can be interrupted, cleaned up and requeued, so a long
background conversion cannot block a requested copy. Metadata inspection has a
separate lightweight worker; opening another video's menu no longer waits for
the active encode to finish. Non-disk sources use unique temporary paths for
these independent jobs.

Encoding reuses the smallest adequate prepared copy instead of repeatedly
decoding the large original. Lower-resolution copies use at most 30 fps, faster
scaling and the superfast encoder preset; AAC audio is copied when reusing a
prepared source. The original retains its frame rate and quality. The original's
native resolution is offered as Original, avoiding an unnecessary same-size
conversion. 1440p and 2160p remain available on demand for larger sources.

FFmpeg's streamed [progress output](https://ffmpeg.org/ffmpeg.html#Main-options)
supplies actual percentage and approximate remaining time. The UI distinguishes
queued, reading, encoding and finishing states. Download preparation continues
after the popup closes, and choosing the original stays available during other
background work. A ready resolution requires no new conversion.

The existing disk reserve, cache cap, source identity checks, availability-before-
payment checks and signed download grants remain in effect. First-time preparation of large originals can
still take time on the existing single-CPU service; the change moves common
preparation earlier and eliminates repeated expensive decoding when a usable
copy is already present.

- `GET /api/flamingo-wall/posts/:id/video-qualities`: original metadata and actual
  ready/available/queued/processing/failed choices; first use queues a probe.
- `POST` to that endpoint with `{ "quality": "720p" }` queues that resolution.
- `GET /api/flamingo-wall/posts/:id/video/720p`: seekable, versioned playback.
- `POST /api/flamingo-wall/posts/:id/download` with the same quality checks
  availability and price before signing a grant for that copy.

Run `node --test test/flamingoVideoRenditions.node.mjs` for real media encoding,
portrait dimensions, audio, preserved original bytes, queue deduplication,
restart recovery and low-space behavior. The Jest `flamingoVideoRoutes` suite
checks actual ranged playback and download grants against a temporary disk and
mocked post/user records. The Vitest wall suite checks menu choices, playback
state, preparation, fallback and explicit download confirmation. These DOM tests
do not validate the reporting phone's native browser controls. The cloud browser
preview remained unavailable under the existing URL policy.
