# Existing landmarks: presence and Racing visibility audit

Audited combined Racing draft content tree `3c5a82d0f1f6b04782026cea8c6fda1483c0ba6a` (local `8506dbb`, draft #26127). Earlier #25756 is merged (`3daaa1a`, September 7, 2026). No second landmark pack is needed.

## Existing runtime integration

`TiranaScenery` instantiates `TiranaCityScene`, which instantiates `FpsCity`. Its `NativeLandmarkLayer` synchronously builds all six existing original approximate landmark meshes. Source-matched generic shells/facade modules are excluded by building ID. Current resolver outputs:

| Landmark | WORLD x,z metres | Matched building | Closest new route centreline |
|---|---|---|---|
| Clock Tower | 73.22,-23.06 |233519333|Gurakuqi, 96.9m|
| Et’hem Bey Mosque |42.69,-32.05|175108083|Gurakuqi, 115.1m|
| Pyramid |220.95,494.49|174510408|Myslym Shyri, 341.1m|
| National History Museum |-117.03,-215.96|none|Zogu i Parë, 100.8m|
| Eyes of Tirana |-269.18,-126.90|885643061|Kavaja Centre, 46.2m|
| Skanderbeg monument |-20.90,-30.06|sculpture node, no building expected|Gurakuqi, 173.1m|

Coordinates are existing game-map/source anchors, not new geographic verification. Museum explicitly reports `no unambiguous source footprint; mapped-site placement only`. Its closest source building is the differently named Tirana International Hotel, about80m from the anchor; do not suppress or repurpose that hotel. Museum orientation and mapped-site alignment need external reference/visual verification before any footprint change.

Geometry is original approximate procedural work, not photogrammetry. Native materials are pooled color/roughness/metalness materials, not newly acquired photo textures. Museum has an intentionally abstract relief rather than a copied historical mosaic. Pyramid includes an existing game-specific mall branding element. These constraints remain; LOD changes do not imply photorealism or surveyed fidelity.

## Narrow visibility change

Previously the Pyramid switched to far geometry at190m and Skanderbeg at90m. Both closest race approaches are farther away. For Racing scenes only, the Pyramid switch distance becomes410m. Every other landmark retains its original threshold, including Skanderbeg at90m. Offline previews showed the monument too small at173m to justify its extra28,462 near-model triangles. Shared non-Racing scenes retain all original thresholds, battery mode retains35m, far culling remains2400m, and hysteresis remains unchanged. No coordinates, mesh scales, roads or collisions change.

This is a detail-selection improvement, not an occlusion fix. Buildings can still obscure landmarks; the monuments remain physically small in a normal wide-angle view. It does not claim every track can see every landmark.

## Cost and validation

Both near/far meshes already reside in memory. The worst theoretical additional active geometry is3,264 triangles for the Pyramid and zero extra material batches. No additional assets, requests or resident mesh buffers are introduced. Battery mode restores the existing cheap geometry.

Tests exercise the actual Three.js LOD with the Pyramid new-course camera position, ensure exactly one level is visible, check battery restoration/far culling, unchanged anchors/scales/mesh objects, and bound triangle/batch cost. Existing58 placement/native-geometry/fallback tests and3 new visibility tests pass. Root TypeScript and standalone Racing Vite builds pass.

Offline Blender previews compare the same exported GLBs at341m/173m and60-degree FOV against neutral ground. They are model comparisons, not game screenshots. Actual WebGL frame time, mobile thermal performance, rendered city occlusion and full-game appearance remain unverified.
