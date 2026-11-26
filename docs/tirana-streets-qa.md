# Tirana Streets — QA and release playbook

## Project execution prompt
Act as TonPlayGram's Technical Director for Tirana Streets. Verify the exact build
or commit, then play through it from the player entry point before judging graphics
or gameplay. Start with portrait touch at 360×740 and 390×844; add keyboard and
desktop coverage. Treat any report that is not reproduced as open, not fixed. For
each defect, record the build, mode, place, settings, steps, expected/actual result,
severity and evidence. Reproduce once before editing, implement the smallest safe
fix, and run the same scenario again plus nearby regression checks. Inspect the
rendered frames, not just successful requests. Preserve existing progress, Racing
behavior and unrelated systems. Report physical-device FPS only after measuring it
on physical devices. Use GTA 6 as a feel reference for street scale, responsiveness,
coherent scenery and immersion, not a parity promise. Do not open a release gate
on the basis of a static screenshot or a passing unit test. Bundle fixes, retain
rollback, and verify the actual deployed commit after approval.

## Release gate and coverage matrix

| Area | Scenarios and evidence | Initial state |
|---|---|---|
| Entry and recovery | Turi → Play; cold/warm loads; asset errors; context loss, restore, suspend/resume; no blank frame | Local WebGL entry captured; live cloud browser lacks WebGL; recovery unverified |
| City graphics | Downward and eye-level frames in center, Ali Demi, Petro Nini and Blloku; parks, slopes, facades, GLB loading, lighting, day/night | Spawn frames inspected; grass/facade issue not reproduced at spawn; other locations open |
| Player/camera | Walk, sprint, jump, crouch; look, mode switch, walls, touch cancel and keyboard | Live-source local walk/turn captured; HUD keyboard failure reproduced by automated test; no full set claim |
| Civilian driving | Enter/exit; pedals, steering, camera, brake, reverse; normal collisions on mapped streets | Prior isolated motor tests only; complete portrait route open |
| City activity | Pedestrian crossings, traffic lights, routing and density; mission and free-roam navigation | Collect source and code test results; visual patrols open |
| UI and access | 360×740 and 390×844, portrait safe areas and left-handed controls; maps and settings; distinct keyboard and touch | Main play route and keyboard-focused camera retest underway |
| Audio | Mute/level, engine, radio and ambience across foreground/pause; blocked autoplay | Unverified for this exact build |
| Save and modes | Checkpoint and resume, fresh & existing profile, supported modes; no effects on other titles | Local settings retest underway; full resume and state matrix open |
| Stability/performance | Actual-device long run, frame-time percentiles, thermal/memory, loss and recovery, slow network | Software WebGL used for screenshots only; no physical results |

Record statuses as reported, reproduced, fixed locally, retested locally, or
verified live. Do not mark FPS, whole-city coverage or visual parity as verified
without evidence.

## Defect register
- **QA-01 Grass imagery (reported, not reproduced at the start).** On live source
  3b7aca8, inspected Turi spawn, walk and downward-turn frames in software WebGL.
  Texture on the observed terrain is a gravel/dirt grass-path scan, not a facade
  photo. Exact scene/zone of the report is unknown; wait for player evidence or
  match it during wider visual coverage. No speculative fix.
- **QA-02 Focused HUD eats Space (reproduced).** Focus the camera button with the
  keyboard and press Space. Baseline game hotkeys cancel native button activation
  and route Space into jump/brake. Fix reserves Space for buttons, summaries and
  equivalent interactive elements in Solo; unfocused Space/vehicle brake and base
  CityInput behavior remain. Test paired with exact baseline; play retest pending.
- **QA-03 Hardware/WebGL evidence gap.** Cloud browser returned WebGL unavailable.
  Software WebGL can validate composition and flow, not Android performance.

## Cycle 1 closeout — provisional, not a release approval
- QA-02 passed in JS DOM (one red baseline test, three green after fix) and in a local browser fixture using native Space on a focused button with the actual StreetInput. The integrated game route re-test stopped at startup within its 125-second software-GPU limit; do not claim full device/route verification of this fix.
- **QA-04 Repeated checkpoint writes** reproduced on exact transpiled runtime. The local fix retains explicit saves, but prevents periodic writes while paused, hidden, unready or in graphics recovery. Real Chromium software-WebGL candidate reached gameplay; explicit pause save occurred, no writes after 11.3 seconds in menu, forced context loss showed its alert and Retry restored progress with one canvas and no uncaught errors. This is not a physical-device test.
- **QA-05 Clipped camera near posts**: old and new camera produced 1.8 vs 6 m in the same isolated obstruction fixture. Real obstacles still shorten the distance; recovery behavior and cockpit transitions stay intact.
- **QA-06 Repeated idle animation**: natural phased glances for ordinary stationary civilians, verified on the bundled rig; no movement, AI or save changes.
- **QA-07 Broader regression pass**: 303 tests, 287 pass, 16 fail in the pinned QA workspace after staging 290 hash-matched fixtures. Thirteen failures cite absent fixtures/assets in this workspace. The remaining three cover the canopy mock, historical bicycle population minimum, and legacy FPS-city visibility mock; investigate rather than decide these are live regressions. The smaller focused suite is reported separately.
- **New features under test**: Lana rises 0.70 m in the solo visual datum, stays below the bank shoulder, with three docked unrideable jet skis. Actual WebGL layer test confirms one deferred original 5.3 MB GLB request, nine shared material batches with three instances, bobbing, no draw beyond range. This fixture is not a full-game traversal to Lana.
- Open: exact grass location, complete route and all mode navigation, photo/texture previews by district, audio/radio, live device FPS, prolonged thermal and memory testing, investigation of 16 broad-suite failures, and wider city data verification.

### Cycle 2 regression triage
- The real 320×700 portrait candidate completed Turi play, the new keyboard camera activation, both city map searches, pause/resume and persisted left-handed controls in software WebGL.
- Two earlier failures were stale test scaffolding, not demonstrated gameplay defects. Canopy fixture now provides the real tree LOD policy and an unavailable mid-distance loader; FPS skyline provides the new facade layer stub. Their two suites pass 4/4, with production source unchanged.
- The old 100-per-bike-type threshold is incompatible with the current 2,397 non-bus traffic allocation and one bike slot per 8 entries. Direct runs of both engines returned exactly 60 of each of the five classes. Density can be evaluated visually/on hardware; the audit did not change population or hide the mismatch.

- **QA-08 Starter cockpit obstruction (reproduced live-source geometry in candidate).** At the previous centered starter area, enter GTI, switch to Cockpit before moving. Captured opaque trunk dominating the portrait view; 13/15 sampled rays encountered the imported mapped canopy object within 0.5 m. User's earlier grass report is separate and remains open. Fresh Solo spawn prototype now uses a clear mapped public-street verge and faces the same GTI; simulation test completes the physical door action. Actual 3D replay required before calling it fixed; first mouse-click replay reached the HYR HUD but did not confirm seat within timeout. Team/mission starts remain unchanged.
