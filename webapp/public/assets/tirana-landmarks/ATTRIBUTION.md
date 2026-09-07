# Tirana landmark recreations

The six native models are original procedural mesh approximations authored for
TonPlaygram's shared city layer. They are not Google Earth/Google Maps exports,
third-party catalogue downloads or exact scans. Source: `nativeModels.mjs` in
`webapp/src/games/tirana-landmarks/`. Models are built directly at runtime; the
optional `webapp/scripts/export-tirana-landmarks.mjs` exports identical GLB geometry.

Geographic placements use © OpenStreetMap contributors (ODbL) and the traceable
coordinate records documented in `docs/tirana-landmark-placement.md` and
`nativeLocations.mjs`. Preserve those notices with the derived geography.

The National History Museum's relief panel is an original abstract design, not a
copy of “The Albanians” mosaic. Dimensions, facades and orientation are approximate.
See the implementation document for model/site accuracy and release-test limits.
