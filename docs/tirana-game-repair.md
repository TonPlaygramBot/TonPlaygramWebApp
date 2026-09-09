# Tirana Streets / Racing Royal repair — 9 September 2026

Base inspected: `ed2043ef984e9824c0ed5cedd58e184676e17ee7`, the merge of #25785. This is a repair to the real game routes and runtimes, not a replacement demo. No merge or production deployment is part of this change.

## Reproduce → fix → retest

Three tests against the previous actual Explore classes failed before modification. Pausing injected `Date.now()*1000` into the input stream, while normal `CityInput.read()` only incremented a counter. After time had elapsed, the server could reject subsequent movement as stale. The other failures covered missing immediate pause publication and transport acceptance of mixed counters.

The repaired transport owns a single monotonic input counter. Pause, overlay and network state are separate; Escape, blur, visibility changes and the React pause button stay synchronized. Public-session reconnection re-registers and rejoins once, without a second heartbeat or render loop. An explicit room invitation is never silently replaced by a different public room. Late joins after disposal leave only their own client session. Existing server membership checks, media consent, chat and friend-request rules are unchanged. A transient request error recovers when a valid same-room state arrives.

Explore has an explicit Reconnect action and visible connection states. Optional decoration failure does not permanently disable the already built base city. Camera and microphone do not automatically resume after reconnection.

## Racing Royal restored, with kart objectives

The default route again opens the original `BaseKartRoyale` garage, retaining its existing **VS AI / MULTIPLAYER / CAREER** tabs, kart choice, camera modes and controls. The extra mode-selection screen is removed. The original online-lobby slot also exposes Kart Missions and Explore Tirana; direct `activity=racing-career` and `activity=explore` routes still work. Paid online/table/code routes retain priority. The existing AI tab is preserved; an `ai` URL does not bypass the original garage's own initial-tab behavior.

The dedicated kart career reuses `KartRenderer` and the original cup save key. Four separate, sequential device-local race objectives are added: Skënderbej time qualification, Blloku damage preservation, a Lana podium, and Grand endurance. These are full kart races with additional goals, not open-world delivery missions. Task XP is derived from unique completions and saved separately under `tonplaygram.kartroyale.tasks.v1`. Replays cannot pay duplicate task XP or cup completion rewards. No TPG balance or settlement code is changed.

Independent pointer/keyboard owners keep steering held when a brake or boost finger is released. Pointer cancellation, focus loss, pause and race end release controls. Left/right input signs and the original kart physics remain unchanged.

The earlier simulation rename omitted `legacySimulation.d.mts`; this change restores the public type declarations. Optional game chunks have a recovery boundary in both game entries.

## Startup and track compatibility

The catalog now contains the five original routes and the source-backed Lana–Pyramid Grand. Whole-WORLD detour generation no longer runs synchronously before the racing garage opens. The unvalidated automatic per-district `*-grand` variants are no longer advertised or accepted; their authoring helpers remain in the repository. Do not restore them until they pass real driving and city-clearance checks. Original route IDs, source geometry, physics and original cup indices are unchanged; old best-time entries are not erased.

**Rollout:** deploy matching frontend/backend circuit definitions, and drain or finish any existing race using an optional removed Grand variant first. Do not switch geometry underneath a running match. The six listed circuits are identical on browser and server. Explore still requires the already implemented backend service, correct socket authentication and a working deployment; these client fixes do not provision a missing server.

## Existing human assets and city

Street Career and shared Explore prioritize the already bundled Chess/RPM, Adrian, Maya and soldier GLBs before optional remote Chess variations. If a requested avatar fails, an already loaded compatible human can be used, without changing a soldier into a civilian. Original skin/mesh/PBR materials, source permissions and role markers are retained. No new character binary or font is distributed. This does not reskin Battlefield operation opponents or scan users' faces.

Existing city PBR buildings, street markings, cycle-lane layer, posts, grass and trees remain connected. This repair changes their loading resilience, not their geography or texture resolution. There is no new satellite survey, terrain/altitude replacement, city expansion or photorealism claim.

## Executed verification

- **191 tests passed, 0 failed, 0 skipped** on Node 22.16.0: the preceding 142 focused cases unchanged, 29 new repair/lifecycle/task cases and 20 real-driving/compatibility checks.
- The actual checked-in kart physics drove **six AI karts on each of six circuits at all three difficulties**: 18 complete races, 108 successful kart finishes before the unchanged 480-second limit. No teleporting or mocked collision/steering was used. This is headless simulation, not visual clearance validation against the full city.
- Baseline `legacySimulation.mjs`, `collisions.mjs` and `tirana-routes.mjs` were reconstructed from GitHub and matched their exact Git blob SHA values before testing. They are not edited by this PR.
- Strict TypeScript public-contract check (`test/tiranaRepairTypes.mts`) passed; eight changed JSX/TS/TSX source files passed transpilation syntax diagnostics. These are not a full application typecheck/build.
- Runtime lifecycle tests execute the actual transpiled TypeScript class methods with graphics/socket stubs. They are not two-device networking or WebGL tests.
- `git diff --check` passed.

Reproduction from a full checkout with the existing webapp development dependencies installed:

```sh
node --test test/tiranaRepairCore.test.mjs test/tiranaRepairRuntime.test.cjs test/tiranaRepairDriving.test.mjs
cd webapp
npx tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022 --lib ES2022,DOM ../test/tiranaRepairTypes.mts
```

The local workspace is a verified source subset, not a complete checkout with React/Three/Vite installed. Download attempts to GitHub/npm were unavailable in the execution environment. **Full application build/typecheck, actual browser/phone rendering, online matchmaking, authenticated two-client Explore reconnection and live WebRTC/TURN calls have not been verified.** No measured phone FPS or complete live fix is claimed.

Keep the PR draft until those checks are completed. The workflow adds reproducible gates; it is not evidence that remote CI ran successfully. No payment, reward-settlement, authentication or branch-protection bypass is included.
