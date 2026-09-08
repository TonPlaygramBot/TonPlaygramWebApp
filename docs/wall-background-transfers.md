# Social wall transfers while browsing

Publishing now belongs to `WallTransfersProvider` above the application routes.
Leaving `/wall` removes the composer view, but keeps its upload controller,
batch state, resumable session IDs and original native file inputs connected.
This matters on Android: retaining a JavaScript File alone does not reliably
retain permission to read a file selected through a phone provider.

The existing layout, article/poll options, 20-file / 5 GB batch limit and bounded
chunk uploader remain in place. A compact Transfers panel stays above the app
navigation. It shows progress and supports pause, resume, unreadable-file
replacement and returning to the wall. Draft attachments also survive route
changes. Successfully published files are released individually, and a failed
batch resumes its remaining files under the original upload identity.

Automatic version reloads wait for retained files and unfinished transfer jobs.
The update scheduler rechecks immediately before reloading and still respects
the existing active-game guard.

## Downloads

The resolution popup queues the signed download request and closes immediately.
The global panel owns preparation and retry state. Ready URLs go to Telegram's
native downloader when supported. Other clients get a **Save to device** button
that supplies the fresh user gesture browsers need. Video bodies are never
fetched into a giant application-memory Blob.

**Sent to device** means the device accepted the handoff; it does not claim that
all bytes finished downloading. Native cancellation is respected. A failed or
cancelled request remains available in Transfers until dismissed. Retrying the
same unfinished request or renewing its expiring URL keeps the original request
ID. The server atomically deduplicates the TPG debit by authenticated viewer,
post, source version, resolution and request ID. Legacy clients keep the
existing per-download behavior.

## Platform boundary

Uploads continue while navigating **inside the running app**. Closing Telegram,
closing/reloading the page or operating-system suspension can stop a web upload;
this change does not promise a native background upload service. No Render
service, worker, paid plan, disk allocation or external storage was added.

Telegram documents its callback as download-request acceptance, not completion:
https://core.telegram.org/bots/webapps#downloadfile.
Background Fetch is not a universal mobile-web fallback:
https://developer.mozilla.org/en-US/docs/Web/API/Background_Fetch_API.

## Regression checks

```sh
cd webapp
npm run test:wall
npm run test:navigation
npm run build
cd ..
node node_modules/jest/bin/jest.js --runTestsByPath \
  test/wallUpload.test.js test/flamingoUploadRoutes.test.js \
  test/flamingoVideoRoutes.test.js --runInBand --watchman=false
```

Coverage includes route unmount during upload, original input/File lifetime,
pause/resume from another page, retained owner and session IDs, partially
published batches, draft restoration, download preparation during navigation,
native cancellation, browser handoff, interrupted/expired grant retries,
concurrent payment deduplication, insufficient balance and reload deferral.
React navigation tests use JSDOM; they are not a physical-phone performance test.
