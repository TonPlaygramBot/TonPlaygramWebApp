# Tirana Streets squads and original asset integration

Based on `main` at `9cc29214a30dd7b4501ad07dfdc3352f39ae6967`.

The city simulation now dispatches complete squads. Shqiponja has two motorcycles
with two officers on each and a two-person patrol escort. FNSH, RENEA and army
responses have 10–20 personnel across vans, based on heat and difficulty. These
are fictional gameplay formations configured from the request, not a claim about
real operational doctrine. Squad, vehicle, seat and animation data survive public
snapshots. Escalation replaces whole squads without orphaned occupants.

The existing road graph drives convoys. Repathing no longer repeatedly sends a
vehicle back to its previous node. Officers dismount when the lead vehicle reaches
the response area, maintain spacing, walk/run toward formation or cover positions,
aim, and alternate cover with side peeks. Stationary vehicle hulls block outgoing
and incoming city gunfire. Officers route around parked hulls. Battlefield uses
the same cover/formation decisions for its existing enemies, with 10/15/20-person
FNSH/RENEA/army waves and its existing pathfinding, hitboxes, collision and damage.
Online human-controlled Battlefield actors remain server controlled.

Original Albanian Forces skeletons receive aim, crouch and riding overlays over
Idle/Walk; running accelerates Walk because the source has no dedicated Run clip.
Bone lookup accounts for GLTFLoader name sanitization. Skeletons remain private;
source meshes and textures remain shared. Motorcycle passengers are visible;
van occupants remain inside until dismount. Existing distant proxies are retained.

## Vehicles and supplied models

One shared Racing Royal vehicle catalog contains the existing nine classes plus
Ferrari and Go-Kart Buggy. All eleven are enterable city cars and parked Battlefield
assets. Racing Royal loads the two additions through the normal garage and asset
adapter, with a bundled Draco decoder for Ferrari. Original IDs and controls remain.

All 26 supplied originals are represented: 18 weapons, Ferrari, Buggy, three
aircraft and three equipment models. City weapon inventory/held visuals use their
corresponding originals, with new AWP and MRTK inventory entries. Aircraft and
other equipment are world props; this change does not introduce flying controls
for the drone/F-15 or launch controls for the rocket. The existing playable
helicopter remains its existing subsystem.

Placements are baked to avoid expensive searches at game startup. Battlefield
shares them with server collision; city props use the same absolute positions.
Spawn/extraction locations and the original police fleet remain clear. Models
load on approach, with two requests at a time and a bounded template cache.
Large weapon displays load only within 14 metres.

## Reproducible asset packaging

`webapp/scripts/import-tirana-originals.mjs` runs in predev/prebuild. The checked-in
manifest records original source URLs and SHA-256 hashes. It bundles external
GLTF buffers/textures, resolves Git LFS pointers through their original media
URLs, and verifies each LFS content hash and final model hash. Missing or changed
originals fail the build instead of becoming transparent fallback pixels. The
runtime files and Draco copies are generated, not committed binaries. Existing
verified files are reused. A cold Uzi import, including LFS textures, was tested.

The original pack is 379,720,100 bytes before HTTP compression. Some individual
weapons contain large textures. Demand loading limits when they load; physical
phone GPU memory, frame rate and first-use download time remain unmeasured.
Provenance is in `public/assets/tirana-streets/imported/manifest.json`; no blanket
license claim is made for the mixed-source assets.

## Validation

61 focused regression/integration tests pass across squads, city life, the
existing city engine, Street Career, original model loading, private rig poses,
Racing Royal's existing military vehicles and all 26 bundled model/texture hashes.
The importer was also exercised after removing the cached Uzi.

The final production build passed. Twelve additional Battlefield/Racing tests
also passed; seven existing browser-dependent cases were skipped by their harness. A browser run opened the actual
Battlefield game and exposed the LFS texture issue, which was then fixed and
covered by asset-signature tests. The cloud browser subsequently could not create
a WebGL context, including in an isolated officer preview. Complete visual
verification of the final poses, riding seats, Ferrari/buggy orientation, and
physical-phone performance is still outstanding. This change should receive
that visual review before release; no successful final browser QA is claimed.
