# Survey-backed guardrail and tree metadata

OpenStreetMap contributors, ODbL 1.0 (<https://www.openstreetmap.org/copyright>).
This source excerpt reuses the repo's dated source extract under
assets-source/tirana-urban/source.osm.json.gz.000 … .007
(SHA-256 dca70c5d585b90c6c042b033bb4bfb001da8b297d7767b2cd927bb1875611602).
Source IDs are OSM objects; the data keeps the tags and version for attribution.
Coordinates use the game's metre projection; they are not resurveyed.

Trees retain the same node positions and LOD budget. Where an existing node
matches the source by ID and coordinate, preserve available species, genus,
foliage or height tags. Tagged metre heights replace estimates when valid;
supported tree silhouettes only indicate broad foliage distinctions. No new
tree placements were justified by the source audit, including near Petro Nini.

Guardrails reuse the existing local 3D rail profile and instance budget.
Only permanent, supported ground-level roadside ways tagged barrier=guard_rail
are used. Segments must be clear of traffic lanes, footpaths, footprint bounds
and existing rails; sections that fail these checks are omitted rather than
shifted. No bridge deck height, private fence, or missing section is inferred.
Widths, material finish and kerb height are existing art direction. The rails
are visual fixtures, not new collision or race rules.
