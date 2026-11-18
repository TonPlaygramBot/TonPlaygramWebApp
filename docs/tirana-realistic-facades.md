# Realistic glTF facade follow-up

This is a separate follow-up to the published Tirana Racing Streets gameplay update. It does not change race mechanics, roads, building footprints, collision shapes or named Tirana landmarks.

## Actual acquired geometry

Four original Poly Haven Modular Urban Apartments Facade bays (James Ray Cock, CC0) are now integrated: two window treatments, a wider window treatment and a door. Each bay is 3×3 metres, with modeled frames/recesses and original plaster, object, glass and trim PBR maps. The self-contained GLB is 7.3 MB with ten embedded 1K images. Coplanar wall tessellation was dissolved while retaining UV/material boundaries; individual bays contain 563–1447 triangles. Source downloads and derivative checksums, licence and reproducible export script are included. No newly acquired Sketchfab model or copied website preview is used.

The source kit was selected after checking Poly Haven, ambientCG, Kenney, Quaternius and Sketchfab options. Stylized skyline kits would not meet the requested realism direction. Exact Tirana Sketchfab candidates lacked an accessible current download or had non-commercial terms. This generic architectural kit is not a measured reconstruction of any landmark.

## Runtime integration

The real glTF bays replace old box-window facade details on eligible mapped residential buildings as the player approaches. Width and floor scale follow each existing polygon edge and mapped height; polygons are not squared off. Named/special landmarks, authored reference buildings, aged housing and neighbourhood replacements remain untouched. A building is rejected if its facade protrudes into the race ribbon or cannot be completely represented.

Whole buildings enter a bounded near-field selection: at most 480 bays in high quality or 160 in battery/performance quality. Instancing shares original geometry/materials; the original fallback retains its existing spatial draw batches. Individual old details are masked only while the full replacement is present, restored when it leaves the budget, and never removed on failed/loading assets. While a replacement is active, only its rendered fallback side faces are inset 0.30m to clear the source window/door recesses; roof/caps, original footprint data and collision shapes stay fixed. Exact original vertices are restored when it leaves the near field. The instanced meshes, source geometries, materials and textures are released at teardown, including late-load cancellation. This is an incremental city facade replacement, not GTA V/VI equivalence or a full-city rebuild.

## Verification

Actual GLB checksum, normalized bounds, retained UV/PBR material maps and triangle ceilings are tested. Layout tests cover original outlines, outward normals, height fit, protected sites, race clearance and deterministic budgets. Runtime tests cover retained materials, streaming, load failures and late completion after dispose. Material/UV regressions also pass. Scoped kart typechecking retains 16 known unrelated missing declarations, without new diagnostics.

Blender successfully imported and rendered the actual PBR bays. A second render on the actual mapped footprint exposed solid-wall occlusion behind recessed glazing; a corrected render with the side-face inset restored frames, glazing and doors without shell bleed or floating bays at the reviewed camera. Exact side-face restoration is regression-tested. That render verifies mesh/material appearance, not WebGL gameplay or mobile frame rate. Chromium still cannot launch in the sandbox despite writable profiles and escalation; complete in-game visual/latency checks and real-device performance remain release gates. CPU draw/texture budgets are design limits rather than measured mobile performance guarantees.
