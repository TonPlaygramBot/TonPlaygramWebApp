# Tirana city accuracy pass

This is a source-backed first pass within the existing central Tirana map. It is
**not an exact city replica or a completed facade survey**. The original WORLD
footprints, origin, map boundary and navigation data are retained. Identity tags
and point positions from OSM are evidence, not proof of current operating status.

## Implemented

- Ten individually styled exteriors: City Hall, Bank of Albania, Palace of
  Culture, Tirana International Hotel, Rogner Hotel, Tirana Police Directorate and
  Taivani / Regency Casino, Swiss Embassy, Kosova School and University of Arts. Dated photo references, source IDs and visible features
  are recorded in `profiles.mjs`. Full original footprints replace generic shells
  in FPS and legacy street rendering. Generic civic bay kits are retired there.
- Institution names attached only to exact source building IDs, uniquely
  containing footprints, or buildings wholly contained by a campus boundary.
  Public offices receive Albanian flags; embassies/consulates receive the source
  country's flag. Private schools, clinics and hotels are not assumed to be state
  institutions. Missing country tags produce a diagnostic, not an invented flag.
- Locally packaged SVG national flags, original proportions, cloth movement,
  failed-image handling, shared textures, distance culling and explicit disposal.
- 3,256 mapped tree centres in the retained district replace seeded park trees
  and street-name-based roadside tree placement in both street renderers.
- 582 source-derived cycling segments replace lanes guessed from street names.
  Independent cycleways use source geometry. Painted road lanes require explicit
  lane tags; their offsets still use the game's estimated carriageway width.
  Shared lanes, private paths, bridge/tunnel levels and unmapped parallel tracks
  are not promoted into dedicated ground lanes.
- Generic shopfront modules are excluded from recognized institution footprints.

## Evidence and reproduction

The source URL, acquisition timestamp, element IDs/versions/edit timestamps and
SHA-256 are committed with `src/games/tirana-city-source/sourceData.mjs`.
The source was downloaded on 2026-09-10 from:

https://api.openstreetmap.org/api/0.6/map?bbox=19.809,41.317,19.827,41.331

The importer rejects malformed/error responses, missing way nodes and open
building rings. It does not fetch the network during builds. To refresh, download
a complete response, record the actual UTC acquisition time, then run:

```sh
python3 webapp/scripts/import-tirana-city-details.py /path/to/tirana.osm --acquired-at ACTUAL_UTC_TIMESTAMP
node --test test/tiranaCitySource.test.mjs test/tiranaFpsCity.test.mjs
```

`registry.mjs` supplements the category of photo-referenced civic buildings whose
OSM tags only say bank/building. It does not alter the original source snapshot.
The former Iranian embassy is explicitly excluded because diplomatic relations
were severed in 2022; its stale OSM tag must not display an active embassy flag.

The [Swiss embassy's official address](https://www.eda.admin.ch/countries/albania/en/home/representations/embassy-tirana.html)
and [Serbian embassy website](https://tirana.mfa.gov.rs/en) were also reviewed.
This does not establish the current status or facade of every diplomatic tenant.

## Accuracy gaps requiring further work

| Subject | Current evidence / limitation | Work still required |
| --- | --- | --- |
| Embassies | Swiss frontage has its own model; other mapped identities and country flags mostly retain generic shells | Dated street-level photos of each frontage, exact doors, fences, signs, setbacks and flag mounts |
| Schools, universities, hospitals | Kosova School and University of Arts have specific styles; others have mapped names and footprint association | Individual elevation references and public/private verification |
| Fire brigades | No fire-station entry in the downloaded playable district | Locate a verified station and extend the authoritative map before placing it |
| City-wide coverage | Central map only; US embassy and other sites fall outside its boundary | A separate map/navigation/collision expansion with reviewed source geometry |
| Kosova School | City states three above-ground floors plus basement; corrected from four visible floors to an estimated 9.6 m above-ground shell | Confirm metric height and sloping basement ground level |
| Building massing | Most heights remain existing game estimates; facade bay spacing is authored | Measured heights, setbacks, roof forms and building-part footprints |
| Tirana International Hotel | Existing 21 m estimate is visibly too low for the photographed tower | Review tower/podium building parts and surveyed dimensions together; don't extrude the entire podium into a tower |
| Palace of Culture | Retains prior 18 m visual override; raw 50 m OSM tag is suspect | Independent dimensional confirmation |
| Rogner | Reusable reference is monochrome; hue is estimated | Current color reference and elevations |
| Cycling | Tagged alignments are mapped; missing widths, offsets and paint are estimates | Check current lane widths, intersections, barriers, colors and direction markings on the ground |
| Trees | Mapped centres; mapping may omit or retain removed trees | Current canopy survey, species, heights and crown dimensions; generic canopy where unknown |
| Logos and signage | Real flag artwork; original text plaques | Verified institution emblems and exact lettering with reuse provenance |

Google satellite imagery was visually inspected. The initial central-square
Street View request returned no available street imagery. No Google pixels,
tiles, videos or extracted 3D assets are shipped. Reference photos are dated
2014–2019 and are not represented as a 2026 survey.

## Review and validation

- Production webapp build succeeds.
- Source/flag/placement tests verify refusal of ambiguous embassy matches, stale
  identity handling, original flag proportions, source-oriented lane direction,
  source tree positions and rejection of partial XML.
- Of 114 existing targeted map/street/career tests, 112 pass. Two source-text
  assertions about the existing lobby and online guard fail identically on the
  unmodified base commit `1c8b6e9`.
- Repository-wide TypeScript checking reports the same 189 pre-existing errors
  as base `1c8b6e9`; there are no new normalized diagnostics.
- All 38 targeted source/FPS/map checks pass. Ten models generate finite geometry
  (40 material batches, 161,212 triangles total); all 20 SVG flags decode.
- A live gameplay/portrait-device performance check remains required before
  promotion. This change is submitted as a draft for visual review.

Reference photos and licenses are in
`webapp/public/assets/tirana-streets/references/ATTRIBUTION.md`; flag provenance is
in `flags/sources.json`. OSM derivative license information is beside the data.
