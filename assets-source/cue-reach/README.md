# Cue extension and mechanical rest

Original assets for TonPlaygramWebApp, dedicated to the public domain under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

The free-source search found a [CC0 cue stick](https://sketchfab.com/3d-models/cc0-cue-stick-311d2a1ac8d64037b6b9f8561d6d13ed),
but did not establish a suitable, downloadable extension-and-rest bundle. No
third-party model or texture was copied. This replaces the earlier cylinder
and sphere construction with original Blender geometry.

`cue-extension-rest.blend` contains the editable component meshes. Rebuild with:

```sh
blender --background --python scripts/build-cue-reach-equipment.py
```

The script exports evaluated bevels and split normals to
`webapp/src/pages/Games/shared/cueReachMeshes.ts`. The runtime imports those
meshes synchronously; the Blender file is an authoring source, not a download
required during play. Blender Z-up vertices are converted once during export
to the game's Y-up coordinates, without altering screen-space controls.

The extension has nested carbon and anodised tubes, a fluted twist lock,
machined coupling rings and a rubber bumper. Only the telescoping tubes change
length; fittings retain their proportions. The rest has a bevelled brass cross
head, a cue cradle, two rubber cloth-contact feet, a tapered ash handle and a
brass socket. The hand grip is solved on the handle axis. Small deterministic
64 × 256 grain and weave textures supply the surface detail.

The exported unique components total 3,600 triangles and approximately 228 KB
of uncompressed mesh data. Both games use the shared model; their reach
selection thresholds are unchanged.
