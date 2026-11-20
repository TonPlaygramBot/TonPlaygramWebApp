# Optional medium-distance tree LOD

The existing CC0 Island Tree02 derivative is already appropriate for a bounded
ornamental/garden close-canopy layer, not a universal Tirana boulevard species.
No new source was downloaded. The runtime retains the existing tree for close views and uses the derivative at medium distance.

New `city-realism/urban-tree-lod1.glb` reduces the existing35,869triangles to17,928
and3,601,484bytes to2,100,236bytes. Keep the existing tree for close views. This is
a performance option, not a new species or more detailed near tree.

Blender4.3.2 split the three source material regions before0.5 collapse reduction.
Original512px maps, RGBA leaf texture with MASK cutoff0.45, double-sided foliage
and branch texture-transform values remain. Source and derivative checksums are
in `urban-tree-lod1-provenance.json`; original licence/author/download records
remain in `provenance.json`. Reproduce with `scripts/assets/export-tirana-tree-lod.py`.

A same-camera Cycles side-by-side render was inspected independently: recognizable
trunk forks and canopy envelope are retained, with no obvious broken leaf-card
silhouette at medium viewing scale. Both remain sparse gnarled ornamental forms.
The static render does not validate in-game alpha shimmer, transition popping,
frame time or device performance. Runtime integration retains fallback and near-model quality, one combined budget of eight trees (three on battery), and a ten-metre transition dead band: 55/45 metres normally, 35/25 on battery. Both source loads are lazy; original canopy survives any failure. Two executable
asset tests verify actual geometry budget, source lineage, UVs, PBR map bindings,
RGBA leaf transparency and branch texture transforms.

Runtime validation: real `MatureTreeLayer`/`ImportedTreeLayer` classes run under
Node with Three and injected source loaders (only the canvas context is mocked).
Tests cover procedural fallback, pending/ready transitions without camera movement,
single ownership, hysteresis, the combined budget, battery shadows, preserved
cypress forms, retirement and idempotent resource disposal. The existing spatial
update throttle may delay a threshold crossing until the next selection update;
this is not a measured frame-rate or visual transition test.

Signage follow-up removes nearest-tenant branding from unsurveyed authored panels:
they display neutral TIRANË text, not invented commercial endorsements. Toptani's
mapped building fascia remains, rendered as factual text instead of copied logo
art. Existing mapped storefront names are retained; this is not a newly surveyed
sign inventory or a rights clearance for all historical artwork in the repository.
