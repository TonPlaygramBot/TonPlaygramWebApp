# Tirana Racing Streets: city asset audit

Checked 2026-11-18. The initial audit was followed by the verified acquisition described below. It does not change the
roads, collision footprints or production deployment. The bounded material pass below changes generic building surface appearance. Asset licences are
not software open-source licences; use the specific terms below.

## Recommended sources

| Asset / author | Verified source and licence | Use in Tirana |
| --- | --- | --- |
| Modular Urban Apartments Facade / James Ray Cock | [Poly Haven](https://polyhaven.com/a/modular_urban_apartments_facade), CC0, glTF available, source lists 118K triangles | Generic facade components only, not a surveyed Tirana landmark. Fit selected components to existing shells; do not replace street blocks wholesale. |
| Exterior Aircon Unit / Monsta3D | [Poly Haven](https://polyhaven.com/a/exterior_aircon_unit), CC0, glTF available, source lists 19K triangles and 1.8m width | Plausible generic wall utility detail. Existing apartments already have procedural AC units; replacing all with this mesh would multiply geometry substantially. Use a simplified, bounded nearby LOD only after profiling. |
| Plastered Wall 02 / Charlotte Baglioni | [Poly Haven](https://polyhaven.com/a/plastered_wall_02), CC0 | Already present as diffuse/OpenGL-normal/roughness maps in `materials/`, with SHA-256 provenance in `materials/sources.json`. Existing FpsCity facade shells already use it. Preserve UV scale and avoid duplicate texture downloads. |

[Poly Haven's asset licence](https://polyhaven.com/license) permits commercial
use, modification and redistribution under CC0; attribution is optional. Keep
creator/source credit for provenance nevertheless. Website previews and other
website content are not covered by the asset dedication. Download original
asset files rather than copying preview images or third-party conversions.

The existing `living/ATTRIBUTION.md` records a Quaternius CC0 `city.glb` kit fitted
to 657 footprint placements. That is existing provenance, not a claim that the
current FpsCity path renders every one of those models. Runtime paths must be
checked before promising a visible change.

## Candidates not cleared for this change

- [Eyes of Tirana](https://sketchfab.com/3d-models/eyes-of-tirana-d25c07d8c69e46b2a5a9f100e33464d8): the earlier repository audit records CC Attribution and 154.7K triangles, but this recheck returned HTTP 403. No current download or licence was verified. Its 2021 model also predates the built facade. Do not bypass access controls or import based only on that historic record.
- [Downtown Buildings Set](https://sketchfab.com/3d-models/downtown-buildings-set-low-poly-model-7378e7fb9c914c39880d9913a6f4e1d6): source lists CC Attribution, but describes American city architecture. Not an authentic replacement for Tirana landmarks. Any later use needs author/title/source/licence attribution and a modification note.
- Existing `city-mobility/ATTRIBUTION.md` lists Great Mosque of Tirana under **CC BY-NC 4.0**, and a Golf model under a **Sketchfab Standard** licence. These records do not establish commercial-compatible open assets. Do not reuse them as free commercial sources. This audit neither removes them nor establishes where they are currently rendered; a separate rights/runtime review is needed before claiming the whole asset library commercially cleared.

## Integration gate

1. Preserve OSM footprints, road centre lines, junction topology and collision data.
2. Download a verified original glTF with all referenced buffers/textures; record creator, source URL, licence, acquisition date and hashes. For CC-BY retain the applicable licence link and modification credit.
3. Keep source PBR textures and materials. Create an explicit optimized derivative rather than replacing realistic materials with flat colours. Generic facade parts must not be labelled accurate reconstructions.
4. Begin with a small nearby detail layer, a bounded mesh/draw-call budget, and existing fallback geometry. Do not add a global high-poly AC/facade clone per window.
5. Check glTF parse and missing textures, imports, disposal during asynchronous load, error fallback, repeated mount/unmount and quality-mode limits.
6. Compare matching before/after street and landmark views in the actual game, then profile mobile texture memory and frame time. Health checks and string-only tests cannot establish visual correctness.

The selected Poly Haven facade components have now been acquired and optimized as described below. City geometry remains unchanged. Runtime integration and visual review are tracked separately.

## Implemented bounded material pass

Generic FpsCity shell caps now use the bundled CC0 `rough_concrete` material rather than facade-tinted plaster. Wall plaster tiles use the source-reported 2.2m width instead of 4m; ground and roof UV scale are unchanged. Triangle indices are partitioned after cell merging so wall/roof materials remain correct across multiple buildings. Vertex positions, triangle count, collision topology, landmark replacements and GLTF materials are untouched. Each existing generic shell cell gains at most one material draw group; textures are shared through the existing cache. This is not a photogrammetric city replacement.

Regression tests exercise real concave extrusions, merged cells, indexed and non-indexed geometry, material assignment and unchanged vertices/triangle count. Actual in-game visual/mobile profiling remains a release gate.


## Acquired modular glTF derivative

The official 1K glTF and all dependencies were acquired successfully through the official API on 2026-11-18; each original file matched its published MD5. `webapp/public/assets/tirana-streets/facade-modules/` now contains four 3×3m bays with original PBR/glass, 563–1447 triangles per bay after coplanar wall tessellation reduction, 7.3 MB total. See its `sources.json` for SHA-256 records and `ATTRIBUTION.md` for CC0 author credit. No additional Sketchfab assets were acquired. Actual GLB structure, dimensions, material maps, triangle budget and checksums have executable regression coverage.
