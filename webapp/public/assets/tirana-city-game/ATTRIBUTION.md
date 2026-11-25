# Tirana Streets standalone city exploration

The editable [central-city.json](central-city.json) subset is derived from
the project's [Tirana city database](/assets/tirana-streets/world.json) and
contains footprints, public roads, parks and water. © OpenStreetMap
contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
[Source and projection](/assets/tirana-streets/DATA-LICENSE.md).
[OpenStreetMap attribution](https://www.openstreetmap.org/copyright).
Heights and visual construction are gameplay approximations.

`public-landmarks.glb`: existing TonPlayGram original artistic reconstructions
of the historic Clock Tower and Et'hem Bey Mosque exteriors. These are
artistic interpretations, not exact or surveyed models. No third-party mesh or
architect photographs are redistributed. Other named points on the map indicate
locations only; the modern Pyramid redesign and monument sculpture are omitted. See the
[project asset credits](/assets/tirana-streets/ATTRIBUTION.md).
The `cover.svg` illustration is original project artwork.

`sedan.glb` and `Textures/colormap.png`: [Kenney Car Kit](https://kenney.nl/assets/car-kit)
(CC0 1.0; [notice](KENNEY-CARS-LICENSE.txt)). Asphalt textures resized and
converted to WebP from [Poly Haven Asphalt 02](https://polyhaven.com/a/asphalt_02)
(CC0 1.0). No purchase, reuse fee or new external service call is required.

## Optional Lana and Blloku district

[Lana and Blloku editable district data](districts/lana-blloku.json) is an
ODbL subset of the same checked-in OpenStreetMap-derived sources and
the project's supplemental hydrography, projected to the same local grid.
Landmarks label mapped streets/corridors; the water tank and park bench
placements are artistic, not a surveyed inventory.

The credited [original TonPlayGram fixture kit](/assets/tirana-streets/detail-kit/ATTRIBUTION.md)
is dedicated under CC0-1.0; only two civilian props are placed here.
`districts/lana-tree.glb` derives from Poly Haven [Island Tree 02](https://polyhaven.com/a/island_tree_02)
(CC0-1.0; Rob Tuytel and Rico Cilliers), from the project's reviewed LOD1.
Embedded PBR textures are resized to 256px and the leaf alpha container
is retained; geometry, UVs and PBR options remain unchanged. This is a
stylized urban broadleaf substitute, not a local species identification.

## Historical city sectors

This playable map uses the pre-removal Tirana Streets city geography from
TonPlayGram source commit `871f3c38c512084c495eeaa0811b0788d62c751b`, with its
original [OpenStreetMap-derived dataset](/assets/tirana-streets/DATA-LICENSE.md)
and supplemental source hydrography. Browse or download
[the editable ODbL sector index and first tile](historic/start.json) and each
listed sector as `historic/<key>.json` (except the first tile, which is inside
the index). Normal builds read the checked-in, pinned ODbL bundle and verify its digest;
they do not import historical software modules or require downloading source.
For source reproduction only, generation is reproducible with
`node webapp/scripts/build-tirana-historical-sectors.mjs`. The complete sector
collection, landmarks and original geographical grid remain derived works
under the [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Road/footprint fragments may cross multiple cells; meters remain in the same
historical local projection. Terrain heights and the visible buildings and
road forms are not a surveyed digital twin. No added public-facility or
security scenario data is part of this export.

## Historical façade texture

Optional wall finish: [Plastered Wall 02](https://polyhaven.com/a/plastered_wall_02)
from Poly Haven, [CC0](https://polyhaven.com/license). Derived from the historical
`webapp/public/assets/tirana-streets/materials/plastered_wall_02-diff.jpg`
(Git blob `0bfd77d09edbe3c2420f5363817f18b8dd903699`), resized to 512² RGB
and converted to WebP. The standalone asset is not a photograph of any specific
building.
