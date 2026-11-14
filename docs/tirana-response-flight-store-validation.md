# Tirana Streets response, flight, shop and rendering update

Based on `main` at `2f77db2c45bf86dc7443c7ed6f48399e4a3a0894`.

## Behavior

- GLB requests share a three-transfer queue and a compressed-byte cache capped at 40 MB / six entries. Vehicle selection runs at 5 Hz while movement still updates every frame. New car and occupant clones are limited to two of each per frame.
- Attacking the civic convoy alerts its escorts. Guards stay near the principal rather than all joining general pursuit. Direct character hits and vehicle hits enter the same response. At four wanted stars, a visible helicopter delivers a bounded RENEA squad to a checked clear location and departs.
- Helicopters and the jet start in pilot view. CAMERA switches pilot/chase. The left stick steers and moves the aircraft; UP/DOWN, FIRE, LOCK, HOVER and LAND remain separate touch controls. Lock requires a visible target and acquisition time. Instruments show heading, altitude above terrain and speed.
- The shop uses the same account identity and balance reconciliation as the wallet, with conditional atomic debit, ownership and receipt checks. The catalog expands from 12 to 23 entries. TPG buys persistent unlocks; ammunition, healing and armor refills continue to use clearly labeled street cash.
- Firearm reserves hold 40 magazines and explosives 16. WALK UNARMED and holster preserve weapon ownership. C4 has place/detonate gameplay, the game drone uses a shipped delta-wing GLTF, scopes supply aim zoom, and the armor carrier raises capacity to 150.
- Existing uniform meshes/textures are retained. Incorrect Shqiponja shin bands are corrected and unit name strips use matte fabric response. See `tirana-uniform-markings.md` for references and limitations.
- Lamps, signs and fixture bases follow terrain elevation. Nearby streetlights fade at the edge of their useful range. Local street-name/sign faces share one 2048×512 atlas and one instanced draw, with correctly oriented front/back lettering and bounded visibility. Street names come from existing map data; the existing game speed zones are not represented as newly surveyed limits.

## Validation and limits

The server TypeScript build, Tirana gameplay TypeScript check, and full frontend Vite production compilation pass. 189 unique Node regression tests across 23 relevant files and 13 React UI tests pass. These cover simulation, account-purchase race/idempotency, GLB/material, streaming, lighting, persistence and touch controls. Existing test mocks were brought up to date with the current radio, loader and camera adapters; ammunition expectations reflect the requested larger limits. The development and final production builds use the repository's existing asset preparation; generated originals are build outputs, not extra assets in this commit.

A focused 2,000-car selection benchmark measured median 129.2 ms before and 11.6 ms after across 120 selection calls (seven samples). This measures that CPU operation only; it is not a phone FPS benchmark.

The environment cannot launch Chromium because its process socket is blocked, and the shared browser cannot reach the local dev server. Consequently, rendered mobile screenshots, real-device FPS, real-account payment, and end-to-end visual gameplay are not claimed. Purchase tests use in-memory accounts and do not spend user funds.

Convoy, advanced flight and special equipment behavior belongs to the unified solo career/free-roam runtime. Legacy online controls exclude special equipment that their simulation does not implement. Pilot view hides the local exterior hull; the existing aircraft assets do not supply a newly modeled cockpit interior. The delta-wing drone is a fictional game prop, not an exact Shahed replica. C4 uses an existing explosive prop. Uniform corrections are source-informed and do not claim every current insignia is reproduced.

## Phone review after deployment

1. Enter solo Tirana Streets, move through a populated road and compare startup/frame pacing with the previous build.
2. Approach the convoy, trigger an encounter, and check that escorts protect the principal. Raise wanted level to four stars and watch the helicopter approach, deployment and departure.
3. Board the square helicopter or jet, switch camera, use the stick while holding UP/DOWN, then acquire and release a target lock before firing.
4. At a weapon shop with no wanted stars, compare the displayed TPG balance with Wallet. Buy an intended unlock, reload, and verify ownership. Test unarmed walking, ammo refill, C4 detonation, drone launch, scope zoom and armor capacity.
5. Inspect night roads, elevated lamp/sign placement, readable sign backs, and the three police-unit uniforms.
