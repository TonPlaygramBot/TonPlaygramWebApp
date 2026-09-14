# Skanderbeg Building and the updated square skyline

The face-shaped building is **Skanderbeg Building / Tirana’s Rock**, separate from the equestrian Skanderbeg Monument already present in the square. The game now replaces its two existing low-detail building parts with an original Blender exterior. This is a recognizable interpretation of the architect’s design, not a measured architectural replica or a photogrammetric scan. No reference photographs or architect drawings are redistributed.

## Source and placement

| Item | Evidence and implementation |
| --- | --- |
| Identity, 85 m height, 25 storeys | [MVRDV project](https://www.mvrdv.com/projects/461/skanderbeg-building), checked 14 September 2026. One retail level, four office levels, twenty residential levels. The architect still lists the project as “On site”; the rendered completed exterior represents the published design. |
| Position northeast of the square | MVRDV’s context plan and map link (41.3298048, 19.819372). The game retains its own more precise existing building footprints rather than relocating a guessed building to that point. |
| Head and podium | [OSM way 1482874842](https://www.openstreetmap.org/way/1482874842) and [OSM way 1482874836](https://www.openstreetmap.org/way/1482874836). Original snapshot copied to `assets-source/tirana-skanderbeg-building/source-anchors.json`; attribution © OpenStreetMap contributors, ODbL 1.0. Both generic visual shells are excluded together. |
| Facial form | Authored curved balcony contours for forehead, eye recesses, bridge and tip of nose, ears, lip and scalloped beard. These surround a simpler recessed glazed core, following the architect’s description of rational internal floor plans behind the sculpture. Orientation and individual balcony curves are interpretations, not surveyed coordinates. |
| Close detail | Gradient-tinted glass guards, slim top rails, panel joints, window mullions, built-in planters, original simple shrub meshes and underside light strips. All are material-batched, with no individual runtime lights or transparent foliage cards. Small fittings and planting are authored approximations. |
| Mineral surface | Poly Haven [Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02), OpenGL normal and ARM at 1K. [CC0 license](https://polyhaven.com/license). The normal amplitude is subtle and only the ARM green channel supplies roughness; the slabs retain their pale authored color. |

The editable `.blend` contains individually named objects. `tools/blender/tirana_skanderbeg_building.py` recreates that source, both public GLBs and the exact evaluated distant geometry module. `tools/blender/render_skanderbeg_building.py` renders the portrait source review using CPU Cycles. Blender 4.2 was used.

Physics uses the same Blender-exported floor contours: recessed glazing, solid balcony slabs and hollow guard bands have their actual vertical ranges. The two obsolete OSM prisms are removed from the shared collision set. Both `minY` and `minHeight` are supplied so pedestrian and driving collision cannot treat overhead balconies as ground-level barriers. These generated bands serve gunfire, walking, driving and aircraft queries; map outlines remain placement provenance rather than incompatible invisible walls.

## Rendering and loading

| Level | Triangles | Material draws | GLB size |
| --- | ---: | ---: | ---: |
| Detailed | 59,924 | 8 | 3,663,892 bytes |
| Distant | 3,068 | 2 | 197,904 bytes |

The distant Blender sculpture is immediately available without an asset request and remains present at skyline distances. The detailed model streams only within 520 metres, or 170 metres in battery mode, with 12% distance hysteresis. It does not block entering the game. A failed request retains the complete distant sculpture and may retry after 30 seconds. Both levels are 85 metres tall. Optional 1K surface maps load after the detailed mesh. Disposed scenes reject late loads.

The HTML conversation preview embeds both actual game GLBs, omitting unused UVs and rounding positions to 1 mm only in the embedded preview to meet its 1 MB transport budget. This does not change the game models. Rebuild with `node webapp/scripts/build-tirana-repairs-preview.mjs`; its React/Three.js TypeScript source lives in `webapp/src/previews/tirana-repairs/`.

## InterContinental Hotel Tower

The existing InterContinental building footprint behind Tirana International Hotel now uses **135 metres**, supported by its [structural engineer AEI](https://www.aeiprogetti.com/en/projects/intercontinental-hotel-tower/), rather than the game’s former 85-metre value. The original map height is retained separately as provenance.

The [main contractor Ales Construction](https://ales.al/construction/projects/new-hotel-tirana-international/) describes 33 storeys and gold and black cuboid volumes, with rooms facing the square to the south. A material-batched facade profile adds those colors, recessed glazing and facade divisions on the retained footprint. The bay spacing and exact color distribution are photo-informed interpretations, not a claim to reproduce every constructed panel.

## Validation

`node --test test/tiranaSkanderbegBuilding.test.mjs` checks mapped placement between the existing hotel and opera, suppression of both generic parts, corrected heights, finite normals and geometry, site containment, triangle/byte budgets, independent decoding of both GLBs with the actual Three GLTFLoader, network-free distance changes, and idempotent resource disposal. It also compares physics rays with the actual loaded detailed GLB across nine heights and four approach directions and verifies walking clearance immediately outside and inside the ground-floor glazing. Independent review caught the original multi-metre collision discrepancy; the generated floor bands fix it. A portrait Blender render was inspected and corrected so the interior glazing no longer inherits the protruding nose or bridges the eye recesses.

The broader game validation covers the shared scene integration and gameplay. This source review does not constitute validation on a physical phone, and the approximated balcony detail should not be described as microscopic architectural accuracy.
