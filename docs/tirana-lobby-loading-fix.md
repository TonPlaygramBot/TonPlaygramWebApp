# Tirana Streets lobby loading follow-up

Base: `main` at `f5e9ec6`, after the user reverted realism PR #25921. This patch does not reintroduce its construction or scene changes.

## Confirmed problem

`TiranaStreetsLobby.jsx` imported `BATTLEFIELD_MAPS` from the runtime `layout.mjs` merely to show map names. That import decoded the city snapshots, built collision geometry records and computed safe deployment locations for every sector before React could display the lobby. The direct `Blackwater.jsx` host also imported this runtime data before its lazy game's loading UI could appear.

An isolated, unminified esbuild bundle of the real lobby entry contained 125 modules and 14,264,263 bytes of JavaScript/CSS. The same command after this patch contains 65 modules and 1,289,047 bytes (about 91% smaller). This comparison includes shared React/router code; it is not the production app download size, a phone timing measurement, or game FPS.

The user's exact phone failure was not reproduced, so this is a confirmed unnecessary loading dependency and recovery fix, not proof that it was the only cause of the reverted version's failure. Expensive synchronous game initialization may still pause the main thread after a game is selected. No claim is made that the old scenery patch is safe to restore.

## Changes

- Keep all 113 map names, IDs and seed coordinates in a small dependency-free catalog. Lobby and direct host use it; the game computes the same collision-safe positions from those seeds only when its runtime is imported.
- Keep a Return to lobby button available while a game chunk is pending. Show a helpful slow-load message after 12 seconds and clear its timer on unmount.
- Add the existing game error boundary to online loading, and return failed career loads to the outer lobby rather than trying to load a second heavy mode.
- Resolve Tailwind configuration/content paths relative to the webapp so the monorepo-root preview can compile styles. This fixes a separate preview CSS configuration failure, not an asserted cause of the user's phone issue.
- Match the navigation test JSX transform to the app's automatic JSX runtime; include the lazy game host in scoped TypeScript checks.

## Verification

- `node --test test/tiranaLobbyLoading.test.mjs`: **3 passed**. Actual bundled dependency graphs exclude city/Three.js from the lobby and the static game host. Catalog district seeds match the two checked-in source snapshots.
- `npm --prefix webapp run test:navigation`: **14 passed**. Includes the real lobby component selecting every map and each of its eight weapons, verifying the deployment URL, and stalled/resolved loading recovery with timer cleanup.
- `webapp/node_modules/.bin/tsc -p webapp/tsconfig.tirana-controls.json`: passed.
- `npm --prefix webapp run build --ignore-scripts`: passed. Production lobby chunk is approximately 10 KB, with a separate 10.4 KB catalog. Static imports include the existing shared application shell; the city runtime remains deferred. Existing large game-chunk warnings remain.
- The actual app stylesheet also compiled successfully with PostCSS from the monorepo root.

## Browser limitation

Attempted the actual `/games/tiranastreets/lobby` route in the supported browser. The first preview exposed missing shared files when rooted at `webapp`; the monorepo root then exposed the Tailwind path issue addressed above. After recovery, the preview reported running but browser requests returned `502 Bad Gateway / connection refused`, including one reload. No final lobby screenshot or browser selector interaction passed. The component tests are not a substitute for touch testing on the user's phone.

Keep this PR in draft until the lobby and game-entry paths have been checked in a working browser/phone preview. The build and automated tests alone do not establish that the reported mobile loading regression is fully resolved.
