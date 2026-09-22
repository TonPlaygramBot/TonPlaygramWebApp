# Social wall: following, profiles, and saved uploads

- Follow a creator from the plus beside their name or their profile. Choose **Every post** or **No notifications**. The notification bell enables Telegram and/or this browser, and selects all posts or followed creators. A muted followed creator is excluded from both modes. Following alone never requests browser permission.
- **My profile → Edit profile** updates the wall username and photo. Photos are resized on the phone and validated/re-encoded to 256×256 WebP on the API. Custom photos survive Google sign-in and Telegram profile refreshes.
- Playback prefers **480p** when available. The original remains playable while renditions prepare, and viewers can choose another resolution. Sources below 480p are never upscaled.
- Select up to **30 files, each up to 5 GiB**. Each file creates a separate post, preserving the caption and explicit premium choice; free is still the default. Five files upload concurrently with one chunk each. One failed video does not stop the rest.

## Persistence and background behavior

IndexedDB stores file bodies separately from queue metadata. The foreground and service worker share the existing chunk uploader, upload IDs, and server acknowledgement protocol. Transactional leases prevent more than five jobs from being claimed across tabs/workers. Pause, resume, cancel, and re-selection are available in Transfers. A confirmed publication releases the saved file and credentials.

Web Background Sync provides best-effort continuation while a page is closed. Browsers can suspend or terminate it, and Telegram WebViews/iOS may not provide it at all. Continuous multi-gigabyte uploading after fully closing Telegram/browser is **not guaranteed by web APIs**. Saved jobs resume on reopening; an interrupted staging batch is recovered under Web Locks where supported, or can be resumed in Transfers. Guaranteed uploads after app termination require a native OS upload service or server-side ingestion of an already-hosted source.

If a device cannot persist a large file, upload continues using the original picker File while the app is open. Transfers marks it as not saved. Reopening requires selecting the same original file; name, byte size, and modification date must match to avoid mixing different video bytes. Browsers without IndexedDB retain the existing foreground uploader.

## Deployment

No new Render service, environment variable, or paid plan is required. Existing MongoDB stores `WallFollow` records, custom profile photos and notification scopes. Existing media storage and upload routes remain in use.

The normal webapp build generates `/pwa/wall-upload-worker.js` from the shared uploader before Vite packages public assets. `npm run dev` also generates it. Do not hand-edit or commit the generated worker. Install dependencies from the committed lockfile. `fake-indexeddb` is used only in tests.

Validation covers queue concurrency/restart/pause/cancel/quota behavior, the 30-file composer, creator preferences, avatar validation, profile ownership, 480p playback/FFmpeg ordering, notifications, and existing feed/payment/upload APIs. Physical-device closure behavior still needs checking on the target Telegram/browser versions.
