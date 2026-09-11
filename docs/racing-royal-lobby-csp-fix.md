# Racing Royal lobby blocked by production CSP

The live app served build `1446fc0` from PR #25846 with all requested model URLs available (HTTP 200). However, its Helmet policy did not declare `worker-src`. The installed Three.js Draco decoder creates a `blob:` worker to decode the newly imported Ferrari. The production policy blocked that worker. Racing Royal waits for all its assets before enabling selection/start, so the decoded-model failure left both controls unavailable.

The old portrait test served the component without the production Content Security Policy and missed this integration failure.

## Fix

- Put the unchanged existing CSP directives into `bot/config/contentSecurityPolicy.js` and add `workerSrc: ["'self'", 'blob:']`. `bot/server.js` passes this shared object to Helmet. Permit `data:` in `connectSrc` for embedded glTF textures fetched by ImageBitmapLoader; allowing it only in `imgSrc` was insufficient. The script-source policy is unchanged.
- Limit this race's Draco pool to one worker to reduce concurrent decode memory on phones.
- Update the browser test to mount the actual routed Racing Royal page, including its default TPG lobby, and send the same policy directives as production.

## Verification

The blocked-policy regression removes `workerSrc`. It reproduces `worker-src` / `blob` violations, an empty showroom and disabled selection. The corrected-policy run cycles all eleven vehicle models, swipes both ways using native touch input, checks the TPG matchmaking button is enabled, changes to VS AI, and starts a six-racer game with the selected kart. It checks for page errors and CSP violations at 390×844. This verifies local production-policy behavior, not a live TPG stake or real-device performance.

```sh
RACING_TEST_BLOCK_WORKERS=1 node test/racingKartLobby.browser.mjs /tmp/kart-before
node test/racingKartLobby.browser.mjs docs/validation/kart-lobby-csp
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when using a separately installed browser. Node syntax checks pass for the server and shared policy, and focused TypeScript checks pass for the renderer.

The fix changes HTTP response headers, so it requires merging and deploying the backend. Merely refreshing an older deployment cannot apply it.
