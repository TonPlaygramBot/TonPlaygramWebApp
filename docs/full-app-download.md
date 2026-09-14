# One TonPlayGram download

Home owns a single **Download TonPlayGram** flow. Games links back to Home instead of offering individual downloads. The browser or Telegram still asks the person to confirm adding the app to the Home Screen. Download completion and Home Screen installation are separate states; iPhone offers the Share → Add to Home Screen instructions.

## What is included

The production build generates `webapp/dist/pwa/game-packs/tonplaygram-app.json` after Vite and the compatibility game manifests. It inventories every deployed application file: the shell, compiled game chunks, models, textures, audio/video, fonts, sidecar data, and locally bundled Draco/Basis decoders. Each file has its exact size and SHA-256 hash. Update control files and generated download manifests are excluded to prevent stale update metadata and recursive manifests. Decoder files come from the lockfile-pinned installed Three.js package.

The external asset importer inventories literal game asset URLs and dynamically constructed model and Poly Haven URLs, downloads the original resources into `webapp/public/assets/external`, and follows their dependencies. This includes glTF/GLB buffers and images, stylesheets and fonts, and referenced standalone JavaScript modules. Assets retain the resolutions and formats selected by the games; the importer does not reduce texture quality or substitute a different model when a source fails. Existing local originals are reused only when their source provenance, SHA-256 and dependency checks match.

The generated `manifest.json` records original and served hashes, dependencies, selected source groups and unresolved requests. `url-map.json` and `url-map.js` map original URLs and verified equivalent mirrors to local files. The separate committed `webapp/scripts/external-assets/source-lock.json` pins upstream bytes. Build transforms replace literal asset URLs; the page resolver and service worker also map dynamically constructed requests. URI-bearing model, stylesheet and module files reference their downloaded dependencies, while GLB binary chunks and image/audio payloads remain intact.

The complete original collection can exceed **10 GB**. Home shows the actual size from the generated app manifest; no fixed small download size is promised. Build output reuses public asset files with hard links where supported, avoiding another full copy of the collection on the same filesystem. Browser storage still needs enough space for the selected download and any existing installed version.

The download uses a staging cache, verifies each file, resumes verified files after interruptions, checks available space and publishes a completion receipt only once all files succeed. Existing game downloads are reused by hash and removed only after the full app succeeds. Browser eviction is detected when checking saved downloads. Storage persistence is requested but remains the browser's decision.

The service worker serves completed same-build app files before older runtime caches and supports SPA navigation and media byte ranges. API, authentication, matchmaking and update metadata bypass downloaded files. Normal startup no longer starts bulk model downloads. Automatic app reloads wait for an active app download to settle.

## Installation and network limits

The Home flow installs a web application. Browsers and Telegram require the person's confirmation to add it to the Home Screen; accepting an installation prompt does not by itself prove installation completed. Telegram uses its supported Home Screen APIs, and unsupported clients receive browser instructions. Saved data may be isolated between Telegram, a browser and a Home Screen app, so download status is checked in the context that is actually running. Browsers can deny persistence, run out of space or later evict saved data.

Successful external verification is required before claiming the complete static game collection is bundled. A directory containing some downloaded files, or a checkpoint with `complete: false`, is an incomplete import. Missing required source assets remain failures; the pipeline does not silently replace them with visually different assets. Source-documented obsolete or unused fallback requests can remain recorded as nonessential, without standing in for a required model or texture.

Accounts, balances, wallets, authentication, matchmaking, multiplayer, live APIs, user uploads and other server services still require internet. Telegram and other live service SDKs retain their online behavior. Downloading the static collection does not make every game or account feature work offline.

Downloading avoids repeat network loading; it does not increase the phone's graphics or simulation capacity. Existing large game chunks and rendering costs are unchanged.

## Import, resume and build

Run these commands from the repository root:

```sh
npm ci --prefix webapp --ignore-scripts

# Inspect the declared inventory without fetching upstream assets.
node webapp/scripts/vendor-external-assets.mjs --dry-run

# Download original assets; rerun this command after an interruption.
node webapp/scripts/vendor-external-assets.mjs --concurrency 4 --timeout 45000 --retries 1

# Check completeness and integrity without contacting providers.
node webapp/scripts/vendor-external-assets.mjs --verify

# Prepare assets, verify external content, build Vite and generate the download.
npm run build --prefix webapp

# Focused download, worker, installation and importer coverage.
npm run test:app-download
node --test webapp/scripts/external-assets/downloader.test.mjs
node --test test/chessCharacterAssetAvailability.test.mjs
```

The normal build runs the external import with `--frozen-lockfile` and the verification gate automatically. New inventory must first be imported successfully and its reviewed source lock committed; a release build cannot silently accept unpinned assets. The first build requires provider access and substantial disk space. Persist `webapp/public/assets/external` and `webapp/.cache/external-assets-metadata` in a build cache to resume subsequent runs. The importer checkpoints progress and reuses files only after checking their bytes, so restarting an interrupted run does not discard completed work. A changed upstream payload fails against the source lock; use `--update-lock` only when deliberately accepting and reviewing changed originals, then commit the updated lock.

An import or verification failure stops the full build. Inspect the failing source groups in `webapp/public/assets/external/manifest.json`, fix access or the authentic source mapping, and rerun the same import command. `--limit` is for investigating a partial inventory and deliberately leaves completeness false. Do not publish a partial output as the complete download or remove required assets from the inventory simply to pass the gate. See [external asset importer details](../webapp/scripts/external-assets/README.md) for fixture inventories and the source-lock format.

## Unavailable catalog sources

The source audit found that Chess's declared Three.js files for **AJ, Jane, Eva, Joe, Kaya, Y-Bot, Remy, Priya, Noah, Martha, Lewis, Kiara and Josh** return 404. Those stale entries were retired from selection and random AI opponents; no replacement mesh is displayed under their names. Existing saved numeric selections are migrated by their previous character IDs, and a retired selection returns to Current Avatar. The valid X-Bot and Soldier sources remain.

Five Sketchfab portrait packages are absent from the repository: **Agent 47, Leather Jacket Portrait, Seated Gentleman in Suede Jacket, Red Hibiscus Hair and Casual Confidence**. Murlan's active seven-character roster already excludes them; their stale Pool store entries now remain unavailable. To restore an entry, import its authentic converted glTF package with `npm run fetch:murlan-characters --prefix webapp` using an authorized `SKETCHFAB_TOKEN`, or use that script's `--from` option for a supplied original package. Run its `--validate-only` check, re-enable the entry in `murlanCharacterThemes.js`, and rebuild the complete collection. The resized Tirana Agent 47 model is not used as a substitute for the missing original package.

Nine invented Khronos screenshot paths in the shared Murlan/Pool character catalog also returned 404: ReadyPlayerMe, ReadyPlayerMe67d411, ReadyPlayerMe67f433, ReadyPlayerMe67e1b5, VietnamHuman, AiTeacher, AiTeacher1, ThanhHuman and XbotHuman. Their invalid thumbnail references were removed. Character cards use their existing gradient or illustrative preview fallback; the actual avatar model URLs remain independent of those missing screenshots.

The missing cx20 Chess and Kenney boardgame-kit URLs were removed from legacy preload lists. Their unreachable Classic Staunton, Heritage Walnut, Marble & Onyx and Kenney Woodcut source styles were retired; Chess continues using its existing A Beautiful Game defaults. Pool and Snooker lounges retain their existing alternate model and procedural fallback behavior. Pooltool's incorrect `table/snooker.glb` reference was corrected to its authentic `table/snooker_generic/snooker_generic.glb` source, confirmed in the provider repository and by a successful HTTP response. The original bddicken human body, Vietnam Human and Jagenjo tree sources also returned HTTP 200 and remain in the inventory.

Nonexistent AntiqueChair candidates were removed while keeping the games' existing SheenChair source. The old Khronos Sample Models binary A Beautiful Game path returned 404; its working glTF alternative remains, along with the separate valid Sample Assets binary where already configured. Chess's pinned Gunify Uzi and Mosin paths now use `models2`, and SigSauer uses `models3`, matching the same commit's authoritative tree and the existing Ludo/Snake configuration. No assets are aliased across Gunify revisions. Tirana's generated provenance contains historical folder guesses in `urls`; when a record supplies its installed `localUrl` and selected `sourceUrl`, inventories retain the selected original and omit those inactive guesses.

The unavailable Quaternius ChessSet source was also removed from legacy lists and its unused Polygonal Graphite source style; lounge scenes keep their existing procedural fallback. Snake's four stale missile filenames were unused: its Javelin rig already bypasses external model loading and uses its authored procedural missile, which remains unchanged.

The three configured Ready Player Me avatar IDs are preserved through the attributed originals in [UPose's pinned source archive](https://github.com/digitalworlds/UPose/tree/f0aeefe6a34a8ce71e47519a11a2bc67203c082f/UPose/Assets/StreamingAssets). Its README credits each original provider URL; the GLBs retain Ready Player Me generator metadata, embedded PNG images and the original skeleton. Each ID has its own immutable mirror group and aliases for the existing provider endpoints. The importer preserves the archived geometry and binary payload; it does not replace these characters with a different avatar when the original hosts fail.

Six extra Freesound preview layers returned 404. Chess and Snake retain the exact local shot and shell sounds they already played beneath those failed requests, along with their existing weapon sound configuration; firearm/launch routing is unchanged. Ludo's unused copy of the remote map was removed. The declared shotgun ID 456035 actually identifies an unrelated spoken-word recording on [the provider's page](https://freesound.org/people/Timbre/sounds/456035/), so guessed alternate preview URLs would not restore an authentic weapon sound.

Lichess's nonexistent `standard/End.mp3` placeholder was corrected to the provider's actual event cues, with symlinks resolved before import. The standard check and checkmate chain points to `sound/Silence.mp3`, intentionally silent in that sound set; Tavull's win cue follows `standard/Victory.mp3` to `standard/GenericNotify.mp3`. Raw GitHub serves these symlinks as small text files, so the app now requests the actual MP3 targets. This is a documented source correction, not recovery of an `End.mp3` original.

The orphaned `WeaponKartGame.jsx` component is not imported by the app or a game route. Its unused remote asset references are excluded by both inventories while a reference guard confirms no other source references that component or uses dynamic component discovery. Adding an import or glob restores inventory coverage automatically; the component and its sound configuration are retained. This excludes its inaccessible Pixabay URLs from the current playable collection without removing active game audio.

Games Hallway's nonexistent Three r150 wood and brass textures were removed; the existing brown door and gold handle materials remain. Table Tennis's Royal Esplanade environment uses the authentic Three r150 HDR original; the current Poly Haven file has different bytes and was not substituted. Tirana's geometry-only reference-image metadata and Wikimedia attribution pages are excluded from downloads; its rendered local reference photographs remain included.

This delivery work targets the web/PWA download. The expanded external collection remains inside the native package: the existing native-lite pruner covers legacy asset groups and does not remove the new `assets/external` collection. Its native cache bridge serves Fetch requests, while service workers are disabled in Capacitor; DOM-loaded images, audio and standalone code must remain bundled until native resource routing is implemented and verified. Native-lite therefore remains multiple gigabytes with this collection and is not a lightweight or verified store-ready package. Native APK/AAB packaging has not been validated for this collection and requires separate delivery work, including resource routing, package-size constraints and device testing.

Production must serve `service-worker.js`, `pwa/app-build.js`, `pwa/game-pack-service-worker.js`, `version.json`, `pwa/game-packs/*` and external mapping/manifest files with revalidation/no-store. Other files under `assets/external/` revalidate their stable provider-derived paths, so a reviewed source update cannot retain year-old HTTP bytes. Completed downloads still serve verified local files through the worker. The bot server headers are updated accordingly.
## Verified production snapshot

The production download contains **2,461 files, 10,233,933,543 bytes** (about 10.23 GB / 9.53 GiB). The external inventory contains 1,379 verified assets, 2,851 URL mappings and zero unresolved requirements. All 91 dependency-bearing documents point to their current local targets.

The frozen import and offline verification passed. After correcting public-file precedence, Vite and final download generation were rerun successfully using the verified inputs (`npm run build --prefix webapp --ignore-scripts`); no asset preparation was skipped on the initial pipeline run. The focused download suite passes 107 tests, and the three existing delivery compatibility tests also pass. CI runs the focused suite using HTTP fixtures without downloading the full collection.

See [phone browser validation](validation/full-app-download/README.md) for screenshots, measured behavior and the limits of the offline fixture.
