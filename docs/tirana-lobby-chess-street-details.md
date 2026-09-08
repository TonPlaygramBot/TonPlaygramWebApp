# Tirana Streets lobby, Chess cast and shared city details

Follow-up to merged PR #25781. Source baseline: `0062b998db2490ac4b13ca88757aef1350ac9b7e`. Publication base: `76a611f0ef29c2692c866b9d8c8e97781a62cb07`; the intervening social-wall change is preserved.

## Actual entry points

`TiranaStreetsLobby.jsx`, the `/games/tiranastreets/lobby` component used by the Games catalog, now displays a primary **Career mode** card and a **City Stories** card. They launch the existing `activity=street-career` and `activity=career` paths with `mode=ai`. The original Blackwater operation/TPG lobby is retained as an expandable section, opened initially for an online query. No stake, room ID, currency or unrelated URL parameters are passed into either local career.

This is a lobby integration, not another career implementation or a new save migration. Nine existing Street Career missions and all existing local profiles are retained. Payments, matchmaking and online scoring rules are not changed.

## Existing human characters

The Street Career NPC layer now consumes `CHESS_HUMAN_CHARACTER_OPTIONS` from the actual Chess Battle Royal configuration, via `SharedGameCast.ts`. The four opted-in humanoid entries are `rpm-current`, `rpm-67d411-domino`, `rpm-67f433-domino` and `rpm-67e1b5-domino`. The non-default GLB URLs are read from that configuration rather than duplicated in another model catalog.

Police and most civilian contacts use those Chess avatars. Existing Adrian/Maya humans remain in the mixed civilian pool. Military NPCs retain the existing Mixamo soldier also referenced by Chess. Police role labels/armbands remain separate accessories; no photoreal uniform or new bespoke human model is claimed. Original embedded mesh/material maps are retained; Chess-specific cloth overlays are not copied by this loader.

The default Chess model uses the already bundled `/assets/table-tennis/chess-human.glb`. Other opted-in Chess avatars load from their existing public catalog URLs, with at most two concurrent requests, a ten-second per-URL fetch deadline, an incremental 16 MiB download limit, cancellation on disposal, URL fallbacks and a local Chess fallback. Availability of those remote avatars is not assumed. Original Tirana actors remain visible until a usable replacement exists. Unknown, portrait, robot and explicitly non-commercial entries are not automatically enabled.

Licenses remain those documented in the existing catalogs and `webapp/public/assets/table-tennis/CREDITS.md`; Ready Player Me and Mixamo are not reclassified as CC0. No third-party human binaries or font files are added. This change affects Street Career NPCs, including its police/military actors. Original operation-mode opponents, traffic drivers and the player avatar are not reskinned in this follow-up.

## Shared streets in both games

`WorldEnhancements` now owns `StreetDetailLayer`. It is used by the active Tirana Streets FPS/City Stories, the driving/combat Street Career renderer and Racing Royal's `tiranaScenery.ts`.

- White edge markings, cycle-lane surfaces, lane separators and white bicycle symbols.
- Red-backed crossing treatment; existing FPS zebra/stop geometry stays intact. Street Career receives white zebra/stop geometry because its older city renderer does not include `StreetVisuals`. Racing scenery receives matching white markings outside its separate racing ribbon.
- Round, bevel-profile concrete pedestrian posts, with original glTF geometry and PBR maps. They are not misrepresented as flexible cycling delineators.
- Shared 2K base-color, normal and packed occlusion/roughness/metallic maps parsed through standard glTF 2.0. The finish is original authored plaster/concrete artwork, not a photograph or scanned Tirana wall.
- Correct metre-based vertical wall UVs on eligible untextured building shells that match stored footprint vertices. Detailed/previously textured materials, named native landmark layers, transformed props and skinned characters are excluded. Not every existing building material is replaced.

No new runtime npm dependency, Google texture extraction or runtime map API is required for the street/material layer. The separate non-default Chess avatars still have their existing remote-source dependency.

## Placement and accuracy

WORLD coordinates, footprints and racing circuits are not moved or widened. Explicit cycleway tags take priority where available. The legacy city snapshot lacks those tags, so Bajram Curri/Gjergj Fishta sections can use a clearly labelled **authored Lana-side approximation**, and only when a nearby stored river segment establishes a side. No arbitrary road becomes a cycling street solely because of its width. Bicycle glyphs do not invent an unverified direction arrow. Bridges, tunnels, inaccessible sections and crossing approaches are excluded from generic lane painting.

Concrete posts are authored at pedestrian road edges and exclude carriageways, separate footpath centrelines, building boundaries, crossing approaches and the existing shop access area. Their exact number, spacing, shape and placement are not a surveyed inventory of real Tirana posts. Added posts have shared FPS obstacle boxes, and Street Career resolves matching circle envelopes at its 1/60-second simulation substeps. **Frontend and FPS server must deploy the shared layout together**; this changes collision geometry, not payment or scoring rules. Street Career post collision is movement collision, not a new ballistic-cover system.

Racing Royal excludes new paint/solid posts from the full closed race ribbon, including its closing edge. The original track paint, barriers, collision and start grid take priority. Scenery posts outside the track do not add a second race collision system.

The retained `SIGNALS` data defines crossing geometry; it is existing game data, not evidence of a newly completed survey. Dajti terrain, the measured elevation/outer-ring work and the original playable bounds are outside this change. Nothing here establishes exact Street View/Earth registration.

Reference context: existing OSM source/license, the city road and river modules, and qualitative municipal/streetscape references. The Tirana Municipality Dibra renovation article (https://tirana.al/artikull/transformohet-totalisht-rruga-e-dibres-625) is contextual evidence of street renewal and cycling infrastructure, not a lane-position source for the Lana corridor. No pixels from reference photographs are copied. Material handling follows the Three.js GLTFLoader, MeshStandardMaterial and color-management documentation. Color textures use sRGB; normal/ORM maps remain data textures.

## Mobile budgets and resource handling

Paint and posts are instanced and queried through spatial bins at four updates per second. Normal/battery modes use 220/100-metre selection radii, up to 1,200/400 instances per paint kind and 256/96 visible posts. Existing nearby human limits remain 24/12. These are configured caps, not measured physical-device FPS guarantees.

The default finish textures are 2048 square and shared between post/wall materials. An explicit 1024 texture option/export is supported; battery mode reduces visible geometry but does not automatically replace already loaded 2K textures. Three RGBA 2K maps plus mipmaps alone can consume roughly 64 MiB of GPU memory before other city assets. Phone memory/thermal/FPS validation remains a release gate.

## Validation actually executed

- Node 22.16.0: **95 passed, 0 failed, 0 skipped** across `tiranaStreetDetail`, `tiranaStreetCareer`, `tiranaRegionalDetails`, `tiranaRegionSource` and `tiranaRegionalValidation`. The 28 previous career and 40 previous regional cases were not weakened; 27 new cases cover the changed contracts.
- Ten changed JSX/TS/TSX modules pass TypeScript 5.8.3 transpilation syntax diagnostics. This is **not** dependency-aware typechecking.
- The exporter produced an actual self-contained glTF with 96 non-degenerate triangles and three embedded **2048 x 2048 PNGs**. Python trimesh independently checked finite vertices and winding; Pillow decoded all three images.
- `node --check` accepts the full-checkout integration driver. That driver was not run locally: the source subset does not contain the full WORLD, track and dependent modules.

The new workflow references real entry points for full-source integration tests, full app build, dependency-aware typecheck and real asset export. No skipped checks are marked successful and no errors are suppressed. Workflow creation is **not** a successful CI-run claim.

Not executed/confirmed: the complete app build, dependency-aware typecheck, all pre-existing game tests, real-WORLD placement counts, remote Chess avatar rendering, browser/actual-game visual checks, phone FPS/memory/thermal tests or successful remote CI. The local environment lacks a full checkout and the React/Three dependency tree. Keep the PR draft until those checks are completed. No merge or production deployment is performed by this change.

## Reproduce

```sh
node --test test/tiranaStreetDetail.test.mjs test/tiranaStreetCareer.test.mjs test/tiranaRegionalDetails.test.mjs test/tiranaRegionSource.test.mjs test/tiranaRegionalValidation.test.mjs
# Full checkout additionally:
node --test test/tiranaStreetDetail.integration.test.mjs
npm ci --prefix webapp
npm run build --prefix webapp
(cd webapp && npx --no-install tsc --noEmit)
node webapp/scripts/export-tirana-street-detail.mjs artifacts/tirana-street-detail 2048
```

The generated `preview.html` is a portrait React + Three.js **asset showroom**, not either running game. It uses pinned CDN imports and needs internet access. It contains an authored sample block, not real city geography. Generated packs contain only original assets, not existing licensed humans or fonts.
