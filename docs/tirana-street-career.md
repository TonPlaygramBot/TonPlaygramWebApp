# Tirana Streets — playable solo career and shared human NPCs

This document records the original Street Career integration. The subsequent [full-body career implementation and validation](tirana-full-body-career.md) adds physical movement/combat, contextual controls and versioned phase checkpoints; it supersedes the mission-start-only checkpoint and validation status below.

## Integration

The active `blackwater/ui.tsx` now has a lazy-loaded **STREET CAREER · DRIVE + COMBAT** entry. `?activity=street-career` opens it directly. The previous courier/Dajti career is retained as **CITY STORIES**, including its existing `?activity=career` URL and saved progress. Online mode always returns the original OperationGame before either local branch. No gameplay files in the operation, server, paid-room or account-balance implementations are changed.

The new React/TypeScript controller calls the existing `createState`, `advanceState`, `control`, `interact` and `navigation` APIs. It exposes all nine existing missions in order: First shift, The Lana run, After hours, Blloku express, Capital circuit, City lights, Rinia rescue, Boulevard defense and Five-star escape. These missions, AI, vehicle dynamics, police escalation, military dispatch and weapons existed in the separate city engine; this change connects them to the active game's new local career rather than claiming nine newly authored missions.

The resulting loop is journal → job → on-foot/driving objectives → first-completion cash/unlock → next job or free roam. The player can drive, race the existing rival, use the existing shared Ludo-ID arsenal, reload/holster, escape police and encounter the existing military escalation. It is an original GTA-style loop, not a GTA V replica, GTA assets, cutscenes, character switching or feature parity.

## Checkpoints and economy

Only fictional street cash and inventory are stored under `tirana-streets:street-career:v1`. They are separate from TPG, server profiles and the earlier courier career. First completion pays once. A replay can improve best time but pays no additional mission reward. Completing a job stores the resulting cash and weapons. The sports-car option unlocks after three chapters through the existing engine's `sport` parameter.

**The checkpoint is the mission start, not each route stop.** Retrying, reopening an interrupted mission or abandoning it restores its starting loadout. Free-roam purchases/loadout are saved every five seconds and on pause/exit. Free-roam position, NPC state and wanted level are not persistent. Storage failure is displayed and play remains available for the session. This client-side save is not an anti-cheat boundary and can never credit account currency.

Pause, map, arsenal, blur and page visibility suspend the local simulation and clear inputs. Hold buttons release on pointer-up/cancel/lost capture. Screen-right stick displacement remains right; moving the stick visibly upward means forward. On desktop the existing WASD/arrow keys, E, R, F, Q, H and Escape controls are retained.

## Shared humans, not replacement primitives

`SharedHumans` references six already-used appearances from four **existing, bundled** GLBs:

- Chess veteran / `rpm-current`: `/assets/table-tennis/chess-human.glb`.
- Adrian and Luca: `/assets/table-tennis/athlete-male.glb`.
- Maya and Nadia: `/assets/table-tennis/athlete-female.glb`.
- Military soldier: `/assets/tirana-streets/living/human.glb`.

Civilians, the dealer and rivals deterministically select from the five civilian appearances. Police select the athlete rigs with authored armbands and readable POLICE markers. Military entities use the existing Mixamo soldier. Gold/violet appearance markings are accessories; original skin and PBR maps are not globally recoloured. No new photorealistic police-uniform mesh is claimed. These are the bundled compatible roster, not every remote avatar URL or portrait asset elsewhere in the inventory.

SkeletonUtils gives each NPC its own skeleton and mixer. Embedded matching Idle/Walk/Run clips are reused when present. Models without clips use a small rest-pose-relative procedural walk/aim/cycle pose, not unvalidated cross-rig retargeting. Those procedural poses require actual-game visual QA. Nearby two-wheelers reuse the existing local motorbike GLB. Traffic drivers/player remain the original renderer's human actors. Online-operation enemies are not reskinned by this local-only layer.

Models load at most two at a time, with one cached source per GLB. The visible pedestrian budget is 24 (normal) or 12 (battery), including fallback actors. Until a replacement loads, the old renderer retains its existing human instead of leaving an invisible opponent. Failed models are reported; the old human remains the fallback. Actor removal releases private skeletons and accessories without prematurely freeing shared source textures. This is a configured budget, not a measured FPS claim.

The local street renderer retains the existing road/collision frame, native landmarks and attaches the already merged shared civic/Dajti/shopfront enhancements. WORLD, terrain precision, racing circuits and regional navigation are unchanged. This does not complete the separate real-elevation import or outer-ring expansion.

## Permissions and provenance

Existing attribution is retained in `webapp/public/assets/table-tennis/CREDITS.md` and `webapp/public/assets/tirana-streets/living/ATTRIBUTION.md`. The athletes are the project's existing CC0 Quaternius base humans. Ready Player Me and Mixamo are **not** relabelled as CC0. Existing commercial-use/redistribution permissions must cover the shipped avatars; this change grants no new licence. No character/weapon binaries or font files are redistributed in the source bundle. Non-commercial-only Agent 47, busts/portraits, robots and unverified remote URLs are not silently made civilian pedestrians.

Implementation references:
- https://threejs.org/docs/pages/module-SkeletonUtils.html — skeleton-safe cloning and shared resources.
- https://threejs.org/docs/pages/GLTFLoader.html — glTF loading.
- Existing pinned project API: Three.js 0.164, React 18.

## Validation

Executed locally on the source subset:

- `node --test test/tiranaStreetCareer.test.mjs`: 28 passed, 0 failed, 0 skipped.
- Six changed TypeScript/TSX modules pass transpilation syntax diagnostics. This is **not dependency-aware typechecking**.

Added but not executed locally: the real-engine mission/dispatch tests, GLB/skin header checks and existing catalog-membership test in `test/tiranaStreetCareer.integration.test.mjs`; existing city/courier regressions; full webapp build and dependency-aware typecheck. The workflow invokes them without error suppression. No successful CI is claimed until actual run results exist.

The container could not resolve raw.githubusercontent.com and does not contain the full project or its React/Three dependency tree. No actual-game browser rendering, physical-phone test, animation/weapon grip review, safe-area screenshot or mission accessibility pass was executed. Keep the PR draft pending these checks. No merge, deployment or paid/networking change is performed by this work.
