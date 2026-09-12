# Snooker Royal: shooting repair and career upgrade

Based on main commit `d06327de2bb32a6e0f5b3e72ee2f87507cba1028`.

## Confirmed shooting defects

The production `fire` callback locked the shot and then called `resolveCueObstruction`, which was declared inside the render callback and was outside its scope. After fixing that, follow-through also referenced an undeclared `TMP_VEC3_FOLLOW_DIR`. Either exception interrupted the stroke before the ball impulse was applied. Both undefined-reference failures were reproduced before editing.

The obstruction calculation now belongs to the shared scene scope, and each stroke owns its follow-through vector. The callback returns acceptance, snapshots released power, rejects a local release during the opponent's turn, and stops late animation callbacks after disposal. The power control appears after the scene installs its handler and after cue-ball placement. Inactive balls no longer block shot readiness.

`snookerLiveStrike.test.js` executes the actual production callback with real Three.js vectors, the production pointer-release control, and the production stroke sampler. Scene presentation functions are stubbed. It checks 10/50/100% releases, UI power reset before contact, exactly one ball impulse, dropped-animation fallback, cancellation, another finger, busy state, opponent ownership and disposal. This is executable callback coverage, not a full rendered-game or physical-device test. The older source-text assertion requiring a direct optional `fireRef` call was replaced by this behavioral coverage; it already conflicted with the queued handoff on main.

## Gameplay and mobile changes

- Launch parameters now reach the game component: snooker variant, table size, identities, tournament/online mode. Offline practice no longer depends on account creation. Online matchmaking still uses its existing account and stake checks.
- Physics uses fixed 120 Hz steps scaled to the solver's existing 60 Hz velocity units. Render FPS no longer changes simulation speed. Tests compare 30/60/90/120/144 Hz and bound background catch-up.
- Pointer ownership, lost-capture cancellation, destruction cleanup and a single slider return animation prevent unintended releases and competing animation writes.
- Career play has no player shot clock. Frame HUD restores from the saved state. The main game uses dynamic viewport height for mobile browser chrome.
- Disabled replays no longer allocate local replay recordings. The existing character rig, assets, poses and camera system remain in use.
- Tied final-black scores now respot black and put the cue ball in hand; the live resolver supplies the toss result. Highest breaks persist across visits, and completed frames reject duplicate rule processing.

## Career

New route: `/games/snookerroyale/career`; reachable directly from the Snooker Royal lobby.

The offline career uses a fictional circuit and ranking credits with no cash value. Each season has four eight-player knockout events. Matches use best-of 3 through 19 frames according to circuit and round. Break-off alternates between frames. The game records completed frames once, advances the actual bracket, simulates the other fixtures, awards placement credits and retains a two-season ranking ledger. A club title promotes at season end; two qualifying titles earn a professional tour card.

Every settled shot saves the authoritative frame plus ball layout. Frame-boundary results are persisted before continuation. Storage errors are visible. Career opponent accuracy changes with circuit and rival without changing ball physics or pocket acceptance. New modules use TypeScript and the existing React/Three.js game.

## Character search

Reviewed the [Kenney animated character catalogue](https://kenney.nl/assets/animated-characters-protagonists), its [CC0 licence guidance](https://kenney.nl/support), and [Poly Pizza](https://poly.pizza/). These provide general character assets; this pass did not verify a snooker-specific replacement with suitable cue/bridge poses. The existing `PoolRoyalHumanPlayers` and `/assets/pool-royale/readyplayer.me.glb` are retained. No new third-party character asset was imported.

Rules reference: [WPBSA rules](https://www.wpbsa.com/rules/). The circuit is an original career design, not an official WST calendar. Existing referee-judgment areas such as foul-and-a-miss adjudication are not claimed to be fully simulated.

## Verification

- 14 focused Jest suites: 74 tests passing.
- Strict TypeScript check passed for the career, launch options, physics clock and Snooker rules.
- Full Vite production build passed. Existing shared-app large-chunk warnings remain.
- Production shooting scope regression finds no undefined identifiers.
- The unrelated inventory-route suite could not complete because its bot subprocess lacks `telegraf` in this environment; it is not included in the passing count.
- Browser attempts to open the local game at both configured local addresses were rejected with `ERR_BLOCKED_BY_CLIENT`. No full-game visual, physical iOS/Android, two-device online, thermal or network-soak pass is claimed. These remain the release gates before merging/deploying.

## Review preview

`webapp/snooker-review.html` is a development entry into the actual game. Run the usual Vite dev server to use it locally.

`node scripts/build-snooker-preview.mjs <output.html>` produces a self-contained portrait cue-test/career-path preview under 1 MB. This smaller preview uses the shared power slider, stroke sampler, fixed-step clock and career calendar; its two-ball practice table is not the full production arena or its physics solver. It makes the controls reviewable in chat without external assets or service access.
