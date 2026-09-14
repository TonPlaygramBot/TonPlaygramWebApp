# Full-app download browser validation

Validated on 2026-09-14 with production Vite output, Chromium 153, and a 390 × 844 portrait viewport.

The tested inventory contains **2,461 files / 10,233,933,543 bytes**. Its build is `69bc6dd`, pack version is `b0b0febdcb058c2f`, and the browser loaded 2,851 provider-to-local URL mappings. The UI displays 9.5 GB using its existing binary size formatter.

## Results

- Home and Games render without horizontal overflow or JavaScript page errors. Both Home actions are visible in the portrait screenshot.
- Games has one Home download link and no individual game download buttons. Following the link places the download card 16 px below the top.
- Starting the complete download and requesting Pause exposes the device storage check and a retry action. This browser had approximately 4 GB of quota, so the actual inventory could not fit. The displayed error accurately asks the user to free space.
- Representative original texture, model, and audio URLs resolve to local deployment files with HTTP 200.
- A temporary **15,322-byte fixture** contains five actual emitted files: a texture, glTF model document, audio clip, app shell, and an unvisited game JavaScript chunk. Each file's SHA-256 and size was checked against the production manifest before cache insertion. The fixture uses the current build and the production completion receipt shape. No complete installation state was written to local storage.
- With other caches removed and browser networking disabled, original provider URLs return exact fixture bytes through the real service worker. The page URL resolver is bypassed for these requests. Audio range `bytes=0-127` returns HTTP 206 with matching bytes and `Content-Range`.
- An unvisited `/games/airhockey/lobby` navigation returns the exact emitted app shell from the service worker while offline. An uncached live API request fails offline.

## Scope

This run does **not** demonstrate a complete 10 GB browser transfer, complete offline gameplay, model rendering, FPS improvements, or operating-system Home Screen installation. The model fixture checks its glTF document bytes, not its dependent geometry/textures. Script execution was disabled only on the offline navigation probe because the small fixture does not contain the whole game's dependencies. Separate manager and UI tests cover download state transitions, completion receipts, and install prompt behavior.

## Evidence and reproduction

- [Home](ton-home-final-390.png)
- [Games](ton-games-final-390.png)
- [Storage error and retry](ton-download-final-390.png)
- [Machine-readable report](ton-portrait-final-report.json)
- [Browser verification script](verify-browser.mjs)

After producing `webapp/dist` with the normal production build, run from the repository root:

```sh
cd webapp
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node ../docs/validation/full-app-download/verify-browser.mjs
```

The script starts and closes Vite preview and Chromium together, creates an isolated browser context, and writes evidence beside itself. It can use an existing browser through `CHROMIUM_EXECUTABLE_PATH`, an existing Playwright module through `PLAYWRIGHT_MODULE_PATH`, and a JSON array of browser arguments through `PLAYWRIGHT_CHROMIUM_ARGS`. `TONPLAYGRAM_VALIDATION_OUTPUT` selects an existing output directory. The hosted verification runtime required `--no-zygote` and `--single-process`; ordinary local Playwright installations normally do not.
