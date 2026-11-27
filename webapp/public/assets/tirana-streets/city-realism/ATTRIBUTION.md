# Imported near-field tree

- Original: [Island Tree 02](https://polyhaven.com/a/island_tree_02), Poly Haven.
- Authors: Rob Tuytel (scanning/processing), Rico Cilliers (cleanup/processing).
- License: [CC0-1.0](https://polyhaven.com/license).
- Derivative: mesh simplification, compact embedded 512-pixel PBR textures and original leaf opacity. See `provenance.json` for source URLs, original file hashes, changes and output SHA-256.
- This is an artistic broadleaf substitute, not a surveyed Tirana tree or species identification. Existing mapped positions and height/crown measurements are retained. Upright boulevard trees and cypress columns keep their existing representation; this model replaces only nearby garden/umbrella forms.

Rebuild instructions are in `assets-source/tirana-city-realism/README.md` at the repository root. No extracted commercial-game content is used.

## Distant broadleaf cutout

`urban-tree-distance-v1.webp` is a CC0 derivative of the same authored model,
not a new species or a photo of an actual Tirana tree. It uses the original
`urban-tree.glb` (Git blob `56dc3d7400f49a9cfa43c22c0103daa20d1039b5`).
Render a centered 256 × 256 transparent orthographic front view from (0, 2.5, 20),
with half frame size equal to 0.57 times the largest model dimension. Use sRGB,
hemisphere colors #f1f6ff / #998674 at intensity 2.05 and directional color
#fff4da at intensity 1.85 from (-3, 8, 4). Crop to (19, 23, 238, 221) and
encode lossless WebP. The output is 25,724 bytes, SHA-256
`76f6579a572f266cfd464ae1d566098d7ef8d4a866d97e72c5dde672f96b0004`.

## Upright and column cutouts

These are appearance profiles, **not species identifications** for the existing
mapped locations. Original heights, crown widths, and ground coordinates remain
unchanged. The existing detailed broadleaf GLBs continue to have priority.

| Cutout | Original tevy v1 LOD2, CC0 | Original SHA-256 | Cutout bytes | Cutout SHA-256 |
| --- | --- | --- | ---: | --- |
| `plane-tree-distance-v1.webp` | [Plane Tree](https://tevy.dev/models/plane-tree) | `76001c5667fb27e2e3da3d9b512ab33a2108dd67bb98231ec69f55f069158da2` | 21458 | `b260697c37995566dfb8373b93acb22ac4ff9215d77ee0e8cdbad360aae0f35f` |
| `italian-cypress-mature-distance-v1.webp` | [Mature Italian Cypress](https://tevy.dev/models/italian-cypress-mature) | `23f498b200a12160e947dc43df0e3143f376d31fe7376ebb1481b67c9bfb8e71` | 7632 | `3a06e3620e3dd1c2c63e4a15ec665d7e471bf68c7c036309abd608baf5b594b2` |

Both references were decoded as the published glTF files, captured against a
transparent background, cropped with four pixels of alpha padding, and encoded
as lossless WebP. No new trunk locations or species tags are inferred.
