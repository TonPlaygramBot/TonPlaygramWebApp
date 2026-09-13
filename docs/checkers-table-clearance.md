# Checkers table and leg clearance

The old tables put their wide pedestal and trim through the seated characters'
thighs and knees. Imported tables were all scaled to the same overall span,
regardless of the space needed below the playing surface.

The Checkers-only fitter now gives each catalogue entry a defined footprint,
keeps the playing surface at its existing height, and narrows the underframe to
0.30 × 0.18 world units. The transition sits below the playing surface. Imported
models are also limited to 0.30 units of height below their top. Meshes crossing
the transition are split before fitting so long triangles cannot cut across the
leg space. UVs, material groups and transformed normals are retained.

Board coordinates, human placement and hand movement are unchanged. Initial
loading and table changes use the same fit, and stale table loads cannot install
a second table over the selected one. A failed replacement leaves the old table
visible until another selection succeeds.

## Individual table review

The four local tables use the actual production geometry and the actual bundled
Chess avatar's skinned leg vertices from both seats. Tests detect points inside
solid table parts and points within 0.008 world units of their surfaces.
Counts below are intersecting leg samples, not separate collisions or players.

| Table | Before | After | Verification |
|---|---:|---:|---|
| Octagon | 865 | 0 | Actual geometry, both seats |
| Hexagon | 858 | 0 | Actual geometry, both seats |
| Oval | 877 | 0 | Actual geometry, both seats |
| Diamond Edge | 778 | 0 | Actual geometry, both seats |
| Coffee Table 01 | — | — | Runtime fit added; external model not inspected |
| Wooden Table 02 | — | — | Runtime fit added; external model not inspected |
| Chinese Tea Table | — | — | Runtime fit added; external model not inspected |
| Coffee Table Round 01 | — | — | Runtime fit added; external model not inspected |
| Gallinera Table | — | — | Runtime fit added; external model not inspected |
| Gothic Coffee Table | — | — | Runtime fit added; external model not inspected |
| Industrial Coffee Table | — | — | Runtime fit added; external model not inspected |
| Modern Coffee Table 01 | — | — | Runtime fit added; external model not inspected |
| Modern Coffee Table 02 | — | — | Runtime fit added; external model not inspected |
| Round Wooden Table 02 | — | — | Runtime fit added; external model not inspected |
| Side Table 01 | — | — | Runtime fit added; external model not inspected |
| Side Table Tall 01 | — | — | Runtime fit added; external model not inspected |
| Small Wooden Table 01 | — | — | Runtime fit added; external model not inspected |

Poly Haven downloads returned HTTP 403 in this environment. The imported-model
test is a combined-mesh stress fixture; it does not substitute for inspecting
those 13 real assets. They still need individual visual checks on a phone,
particularly their support shapes and texture stretching. Browser inspection
was also unavailable in this session. Keep the change in draft until that check.

## Validation

```sh
node --test test/checkersTableClearance.node.mjs test/checkersHumanActors.node.mjs test/chessPhysicalMove.node.mjs test/chessRules.node.mjs test/checkersLaunch.node.mjs
```

All 61 tests passed locally. The existing hand-contact, portrait framing and game
rules regressions still pass. Strict TypeScript checks and the production Vite
build pass (with the existing large-chunk warning). The GitHub
workflow repeats these checks when table or character code changes.

The React/Three.js/TypeScript preview in `webapp/scripts/checkers-table-preview.tsx`
shows the real fitted geometry of the four local tables, the bundled humans,
and a lower camera for inspecting the leg space. It is a geometry preview,
not a screenshot of the complete game or proof of device GPU performance.
