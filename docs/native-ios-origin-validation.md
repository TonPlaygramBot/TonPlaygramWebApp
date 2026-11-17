# Configured iOS origin CORS correction (draft)

`webapp/capacitor.config.ts` sets `server.hostname` to
`tonplaygram-bot.onrender.com` and leaves iOS's default `capacitor` scheme.
The corresponding expected origin is `capacitor://tonplaygram-bot.onrender.com`.
This origin is inferred from configuration, not yet captured on a physical iPhone.

This patch adds only that exact string to the existing native origin allowlist.
It does not wildcard native schemes, change Android configuration, alter
credentials, relax route authentication, or change production environment values.
CORS is browser access policy, not application identity or authorization.

## Evidence before the patch

Read-only production probes on 2026-11-17 around 12:14 UTC:
- `/pwa/game-packs/index.json` with the expected origin returned HTTP 500 HTML,
  without Access-Control-Allow-Origin.
- The same path with `capacitor://localhost` or
  `https://tonplaygram-bot.onrender.com` returned 200 JSON and matching
  Access-Control-Allow-Origin.
- No-Origin bounded requests for the catalog, a sampled HDR, JPG and GLB
  returned 206 with correct file signatures. This is an origin mismatch, not
  evidence these sampled files are absent.

## Verification and remaining release checks

`node --test test/corsOrigin.node.mjs` provides dependency-free policy coverage.
`test/corsOrigin.test.js` also extends the existing Jest suite.
Tests cover the exact configured origin, existing origins, and rejection of
lookalike hosts, ports, alternate schemes and suffixes. They do not start the
production server or assert successful real-device gameplay.

Before release, capture the actual iOS WebView Origin, verify catalog/model fetches
and OPTIONS responses using that origin, and verify unauthenticated protected API
requests still fail. Check representative socket/video authentication separately.
The observed `Cross-Origin-Resource-Policy: same-origin` response header is
unchanged; test asset fetch/render behavior on-device before removing local files.
No deployment, merge or production configuration change accompanies this draft.
