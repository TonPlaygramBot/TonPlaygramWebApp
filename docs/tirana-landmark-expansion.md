# Tirana landmark expansion — 10 September 2026

This extends the shared source-backed facade layer from PR #25826. There are
49 mapped building footprints across 15 selectable locations. Eight previously
modeled institutions remain available in the city alongside these locations.
The models are original photo-informed interpretations, **not identical replicas,
photogrammetry, or a surveyed digital twin**.

## Coverage and access

Open the large city map and choose **BUILDINGS** to inspect every location. The
explorer uses the same Three.js geometry as the FPS and street renderer, supports
portrait camera fitting, and never teleports a player. Central models appear in
the existing driving district. Regional geometry retains its actual coordinates
and is distance-culled in gameplay; the explorer makes it accessible immediately.

The driving bounds, navigation graph, roads, mission graph and server collision
footprints are preserved. **This does not add a continuous driveable route to
Delijorgji, Grand, Mangalem, Qyteti Studenti, TEG, QTU or Ring Center.** Buildings
at or beyond the southern boundary are not advertised as fully reachable.

| Location | Source footprint(s) | Exterior evidence / status |
| --- | --- | --- |
| Delijorgji | 659792494–659792500, 1184315630, 1184315631 | [14 December 2024 listing](https://duashpi.al/en/property/675dd193aad07cd14402ace9/11-apartment-for-sale-at-delijorgji-complex.html): pale balconies and orange-red bands. Selected core, not entire neighbourhood. |
| Pallati Grand | 548100908 | User confirmed ish-Tregu Elektrik; [named photo](https://wikimapia.org/14185230/sq/Kompleksi-Grand), nine OSM levels, curved corners, pink surrounds and green bands. |
| Qyteti Studenti | 21 individually mapped dormitory buildings inside 234270352 | Campus is not a building. [2019 photo](https://shqiptarja.com/lajm/perfundon-rikonstruktimi-i-godines-27-ne-qytet-studenti-veliaj-ne-vere-do-nderhyjme-ne-dhoma) shows shared 26/27 entrance: only those two profiles receive red/white balcony detailing. Other dormitories remain neutral provisional models. |
| Air Albania | Relation 10311002 (outer 746635211, inner 746635210); Marriott 795642504 | [Archea](https://www.archea.it/en/progetto/new-national-stadium-of-albania/), [2024 photo](https://commons.wikimedia.org/wiki/File:Air_Albania_Stadium_2024.jpg). Preserve roof opening and separate 112 m tower. Foreground Archaeological Museum colonnade is not copied onto the stadium. |
| Mangalem 21 | 1512253120–1512253125 inside site 1512253126 | [OMA](https://www.oma.com/projects/mangalem-21), © Kontakt photo. Six mapped outlines, colour/window grid interpretation. **27 m site rise, exact stepped storey heights and ground passages are not reconstructed**; elevations remain provisional. |
| TEG | 293898197 | [Operator](https://www.teg.al/), [2016 green entrance photo](https://commons.wikimedia.org/wiki/File:TEG_Tirana_2016.jpg). Canopy placement/depth estimated, not entrance-survey data. |
| QTU | 268022192 (not campus 531551015) | [BALFIN](https://balfin.al/industries/asset-management/), [undated exterior](https://wikimapia.org/652801/QTU): red diamond facade, no seasonal star lights. BALFIN interior image was not used as facade evidence. |
| Ring Center | 449527787 | [Operator](https://ring.al/), [undated exterior](https://wikimapia.org/7347981/Tirana-Ring-Center): blue-green glazing and dark grid. Stepped upper volumes simplified. |
| Toptani | 177186612 | [Operator exterior](https://toptani.com.al/en/), angular pale panels and glazed openings. |
| Sky Tower | 465295338 | [Official current photo](https://skyhotel.al/wp-content/uploads/2025/03/main2-scaled.jpg), uploaded March 2025, capture undated. [Mechanism manufacturer](https://360platform.com/Highlights/Revolving%20Restaurants/7/Sky%20Tower%20Hotel%20in%20Albania) gives 22.5 m platform diameter for 2023, **not enclosing roof diameter**. Crown model dimensions estimated; OSM tower height 76 m. |
| Former Sheraton / Mak Albania | 248344798 | [2019 licensed exterior](https://commons.wikimedia.org/wiki/File:MAK_Hotel_Tirana.jpg), blue glazing/white podium. Historical exterior, not a verified 2026 redevelopment state. |
| Rogner | 249185545 | Existing curved model retained; [hotel source](https://www.hotel-europapark.com/) and licensed 2019 photo. |
| Taivani / Taiwan | 236569963; pond 233519336 | Existing facade retained; [2014 photo](https://commons.wikimedia.org/wiki/File:Taiwan_center_in_Tirana.JPG). Fountain now uses the actual pond polygon and nodes 13137827486, 13137853256, 13137854829. Jets' animated arcs are authored. |
| The Plaza / TID Tower | 469424840 | [Hotel](https://www.plazatirana.com/), 85 m OSM height; [dated exterior record](https://commons.wikimedia.org/wiki/File:TID_Tower,_Tirana,_Albania,_2014-04-17,_DD_07.JPG). Deep pale window grid; circle-to-square transformation simplified. |
| Pallati i Kongreseve | 248344804 | [City reference](https://tirana.al/pika-interesi/pallati-i-kongreseve-6931): 70 m long, 18–23 m tall; model uses estimated 21 m, branching supports and blue upper glazing. |

## Data and reproduction

`landmarkData.mjs` retains building tags, exact imported polygon vertices, source
IDs, hole membership, height provenance and SHA-256 hashes for the source extracts.
All geometry uses the existing origin (41.3275, 19.8188), 111320 metres per degree,
longitude cosine correction, x east and z south. World-contained buildings keep
their original WORLD polygon so rendered walls agree with collision geometry.

`webapp/scripts/import-tirana-landmarks.py` accepts a reference directory containing:

- `landmark-geometry.json`: Overpass `way(id:548100908,234270352,1512253126,248344798,449527787,465295338,293898197,268022192,177186612,233519336,249185545,236569963); out tags geom;` (also queried relation 10311002; its members are read from the full XML).
- `campus-buildings.json`: `way[building]` queries in four south/west/east Tirana bounding boxes: `(41.3202,19.7905,41.3241,19.7964)`, `(41.3255,19.8438,41.3297,19.8489)`, `(41.3155,19.831,41.322,19.838)`, `(41.3165,19.821,41.3202,19.826)`, followed by `out tags geom;`.
- `../tirana-central.osm`: the complete central XML retained during the previous import, including member ways/nodes of relation 10311002, Plaza, Congress and fountain nodes. Reject missing nodes and unclosed ways.

Sources were acquired from Overpass and the OSM map API on 2026-09-10. A refresh
is not assumed byte-identical: compare source hashes and review changed identities.
OSM geometry is © OpenStreetMap contributors, ODbL 1.0. See
`webapp/src/games/tirana-city-source/DATA-LICENSE.md`. Only the three newly licensed
photographs are redistributed; their individual terms are in the references
`ATTRIBUTION.md`. No Google Street View, satellite tiles or third-party screenshots
are distributed as game textures.

## Validation and remaining limits

- Source tests cover named identity, separate campuses, relation holes, fountain
  placement, unchanged collision polygons and no accidental civic flags on malls.
- Geometry verification builds the actual Three.js classes: finite vertices,
  material batching, clear stadium opening, distant-region culling and disposal.
- Projecting facade elements remain mesh details and do not add new gameplay
  collision shapes. Approximate heights use source levels × 3.2 m unless an OSM
  height or documented profile override exists.
- Source meshes batch thin window/cladding fronts as two triangles; solid fins,
  balcony edges and supports retain depth. New region chunks are distance-culled.
- Existing source-backed trees, cycling lanes and institution flags are retained.
  No invented planting or cycling coverage is added around regional buildings.
- A current facade survey, terrain/elevation model, additional licensed imagery
  and new connected road/navigation tiles are still needed for exact replicas and
  continuous regional driving. No real-phone performance claim is made.

Validation result: production build passed; 46 targeted tests passed. Geometry check: 226 material meshes and 419,364 triangles across all 57 reference models, with a clear stadium opening. The full TypeScript check still has the same 189 pre-existing diagnostics and no new diagnostics. No browser or physical-phone performance test was run.
