# Rebuild imported city tree

The runtime GLB is a derivative of Poly Haven's **Island Tree 02** (CC0), not extracted game content or a recovered workshop artifact. Source authors, URLs, original hashes and output hash are in `webapp/public/assets/tirana-streets/city-realism/provenance.json`.

1. Download the verified originals: `python assets-source/tirana-city-realism/download.py /tmp/tirana-tree-source`.
2. In a temporary tooling directory, install `meshoptimizer@1.1.1` and `sharp@0.33.5` from npm. These are build tools, not new application dependencies.
3. Run `node assets-source/tirana-city-realism/build-urban-tree.mjs /tmp/tirana-tree-source /tmp/urban-tree.glb /path/to/tooling/node_modules`.
4. Inspect the new GLB with Blender. Verify leaf coverage, texture alpha and silhouette before replacing the runtime file. Refresh the derivative hash/statistics in the receipt only after review and rerun `node --test test/tiranaCityRealismAssets.test.mjs`.

All PBR maps are embedded at 512px. The source's leaf-alpha image is restored as RGBA PNG and an alpha-tested double-sided material. Existing mapped positions, crown dimensions and heights remain authoritative; this broadleaf model is an artistic stand-in, not a surveyed Tirana species. Upright boulevard trees and cypress columns are deliberately not replaced with it.
