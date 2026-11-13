# Tirana Streets city gameplay update

Based on `main` at `e7c36e190787de0a36c7b4e94cfbeefd9dc9de83`.

## Playable changes

- The city retains 300 weapon pickups and now has 96 ammunition caches and 24 weapon stores. The original 15 stores retain their identities. Ammo caches transfer only available capacity, leave remaining rounds on the ground and preserve the equipped weapon. Ordinary firearms carry 20 spare magazines; explosive weapons remain capped at eight.
- Arsenal controls offer one magazine, three magazines or a priced fill. Street cash cannot unlock paid TPG weapons. Existing authenticated account purchases remain authoritative.
- The map's Nearby view finds shops, homes and banks. Guidance shows the next turn, distance, approximate arrival time, road-end parking/walking guidance and off-route recovery. Steering preserves momentum without adding artificial lateral energy; parked cars no longer rotate from residual yaw.
- Six fictional sale listings offer apartments, houses and villas. Owned homes store ammunition by weapon. Three bank branches offer street-cash deposit/withdrawal, the existing TPG wallet entry and a fictional bank job with alarm, hold, escape, pursuit, cancellation and cooldown.
- The bank/home economy is local career gameplay, available during free roam. Street cash is not TPG. Real TPG transfers remain in the existing account wallet; robbery never creates account currency. No withdrawal backend or blockchain operation is added.
- Turi keeps his original GLB, face, body, clothing and emblem. Head-atlas seam bands and texture gutters are repaired at preparation time, compatible duplicate normals are smoothed, and pistol support-palm orientation is corrected. Existing Three.js limb IK and actual weapon sockets remain in use. This does not retopologize the head/neck attachment.
- A fictional civic convoy contains one S-class, three black SUVs, four Shqiponja motorcycles and two police cars. It follows directed roads, stops, responds to traffic and halts on obstruction or damage. It cycles through Parliament, the PM building and the Surrel direction, with occasional Rinas-direction legs. Regional destinations end at the current playable road boundary.
- The Edi Rama NPC is a **stylized approximation**, adapted from a licensed suited character with grey hair/stubble and a taller build. It uses the shared humanoid rig/animation framework, not Turi's identity or an exact photorealistic likeness. The schedule is invented for the game.

## Assets and persistence

Residences use original CC0 Poly Haven geometry, UVs and PBR textures. Their scene definitions and source checksums are committed; 13 original resources (about 16.2 MB) use the existing frozen vendor pipeline. The three residential styles are assemblies of one modular asset kit, not three unrelated scans. See `webapp/public/assets/tirana-streets/residential/ATTRIBUTION.md`.

The civic NPC's source, CC0 attribution, binary and rebuild script are included under `webapp/public/assets/tirana-streets/civic` and `webapp/scripts/build-civic-npc.py`. Existing vehicle and uniform licenses continue to apply.

Ownership, bank funds, stored ammo and cooldowns share the versioned career profile. Pickup depletion is saved independently from player position so death, arrest or an invalid positional checkpoint cannot replenish caches. Mission retries and abandonment restore inventory and authored loot to the same checkpoint. Older profiles and population-v1 sessions migrate without resetting traffic, owned weapons or collected loot.

## Validation and review

New tests cover ammo transfer limits and pricing, population migration, bank conservation, ownership/stash rules, robbery outcomes, collision-clear entrances/exits, pickup persistence/rollback, convoy formation/routes/traffic, original asset integrity, Turi atlas preparation and navigation/handling. React/jsdom tests exercise purchase-to-storage, bank actions, robbery confirmation, wallet separation and navigation UI.

Actual Turi GLB contact checks verify weapon and steering hand targets. Blender CPU before/after head renders preserve the original likeness; they are not a WebGL or physical-phone benchmark.

Recorded checks on the completed implementation:

| Check | Result |
| --- | --- |
| Full Tirana gameplay TypeScript project, `tsc --noEmit` | Passed |
| Production Vite bundle | Passed (1 min 40 sec final run) |
| Full frozen external-asset import and offline integrity verification | Passed; 1,390 assets, zero failures |
| Post-build localization, game packs and complete application manifest | Passed; 2,583 files |
| Downloader regressions, including negotiated-thumbnail recovery | 22 passed |
| Nine focused feature/access/persistence suites | 57 passed |
| New bank/property/navigation React flows | 10 passed |
| Existing portrait movement-stick/radio React flows | 7 passed |
| Pickup persistence and actual player-experience checks after preparing bundled originals | 23 passed |
| Exact GLTF residence doors, batching, source pins and model lifecycle | Passed |

The full asset import exposed a provider format-negotiation change: twelve historical PNG thumbnail URLs returned WebP. A narrow Poly Haven-only retry requests `format=png` for recognized image responses, retains the canonical inventory URL and requires the existing reviewed SHA-256. HTML/invalid payloads and changed source hashes remain rejected. The complete frozen import and offline verification then passed without changing any existing thumbnail pin.

Browser verification was attempted with installed Chromium and software WebGL flags. Chromium cannot start here because its required process-singleton socket is denied (`Operation not permitted`). Phone appearance, touch feel and frame rate still need an actual browser/device review. No successful browser test or FPS claim is made.

Original residential modules are dense (about 193K–887K triangles per mapped property). Detailed visibility is capped at the two nearest homes within 320 m; battery mode allows one within 120 m, with original distant shells restored. This bounds the new work but is not a measured phone-FPS guarantee.

Two broader kart regression assertions are already stale on the base commit: they expect six tracks when `main` has nine, and an older SHA for `kartroyale/legacySimulation.mjs`. Those unrelated source files are unchanged by this PR.

## Phone review path

1. Open Games → Tirana Streets → free roam. In Map → Nearby, route to a weapon store, home or bank.
2. At a store, buy ammunition in each quantity and fill the reserve. At a cache with little free capacity, collect part, reload the page and verify only the remainder is available.
3. Buy a home at its entrance, enter it, store/take rounds and leave. Reload and verify ownership and ammunition amounts.
4. Enter a bank and move to the counter. Deposit/withdraw street cash; open the separate TPG wallet. Start a bank job, check the hold timer, escape, and verify the reward pays once. Repeat with death/arrest to verify cancellation.
5. Drive a route, brake into corners and reverse; check the guidance agrees with the visible road direction. Inspect Turi's rifle and pistol palms, head seams, and the civic convoy near its stops.

This change does not merge or deploy itself.
