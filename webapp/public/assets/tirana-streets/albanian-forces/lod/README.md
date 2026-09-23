# Parliament cordon LODs

Index-only derivatives of the adjacent original FNSH/Shqiponja GLBs. Original
vertex buffers, PBR maps, weights, rig and animation clips are unchanged and
shared at runtime. Rights and source attribution remain in ../ATTRIBUTION.md.

Rebuild: `node webapp/scripts/build-tirana-cordon-lod.mjs` from repository root.
Meshoptimizer 1.1.1; LockBorder + Regularize; normals, UVs and skin weights
included in the error metric. Each JSON records the exact source SHA-256 and
triangle counts. The game rejects stale or incomplete patches.
