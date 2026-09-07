# Preserve Tirana; extend the atlas towards Dajti

Follow-up to merged PR #25767 and the user's instruction to keep the Tirana map as it was. This change applies to the shared map used by Tirana Streets and Racing Royal. It does not replace either game or rewrite its career logic.

## Added atlas extent

CityMap still starts in the original central Tirana view. `Tirana centre` resets that view. `Tirana + Dajti` fits the existing city and the two source-recorded cable-car terminals in one continuous coordinate frame. Zoom and drag reach those regional reference positions. Selecting a Dajti terminal now centres the atlas on that terminal instead of doing nothing.

The original Geometry, Markers and minimap rendering source remains unchanged and is guarded by a regression hash. No roads, buildings, parks, water shapes or racing circuits are rescaled, rotated, relocated or replaced. A separate overlay draws the terminal markers and a dashed approximate cable alignment, explicitly not a drivable road. It labels the existing playable city boundary and discloses the missing intervening road coverage.

Regional pins use the existing geographic favourites format. Route availability still follows the ORIGINAL playable bounds, never the enlarged atlas bounds. A visible terminal therefore cannot silently become a false walking or driving route through missing infrastructure.

## Preservation evidence

Before the earlier PR merged, inspected main `099f3b8a764db69f127cb660ba9111440edf54a1` and feature head `788ce92f086e4ed785317bcb3bc58aa6e92703b3` contained the same WORLD blob: `69157413d6ebc8eeb2c822436dde2761e793b6b7` at `webapp/src/games/tiranastreets/shared/world.mjs`.

The new follow-up branch is based on merged main `4279a6093133bdd60f57a8ebabf9b49bb0db9d96`. Its CityMap baseline matched the inspected feature source exactly (`2128fa58d0e3ff0d0e1b7dd0a923d0b740137dcf`). Only the shared atlas, an extent helper, tests, workflow and this document change. WORLD retains the original origin, bounds, footprints, roads, parks, water and graph data.

CI checks the original WORLD hash explicitly. A later intentional geography expansion requires a reviewed update to that guard; do not silently bypass it.

## Checks executed for this follow-up

`node --test test/tiranaDajtiAtlas.test.mjs test/tiranaMap.test.mjs test/tiranaDetailKit.test.mjs test/tiranaLakeSource.test.mjs`

49 tests passed; zero failed or skipped (10 new atlas checks and 39 existing checks). These are local numeric, source-preservation and contract tests with synthetic geography fixtures, not browser/gameplay tests. They cover immutable bounds, regional coverage, visual drag direction, anchored zoom, original city/minimap source, unchanged road graphs, geographic favourites and rejection of off-map routes.

The changed CityMap.tsx passed transpilation syntax checks. It is not a dependency-aware typecheck or full build. Published CityMap and test-file blob hashes matched the locally checked files. The earlier career/glTF suite was not rerun in this follow-up. Full application build, browser gestures/rendering, physical-phone checks and successful CI execution are not claimed.

## Still not a continuous playable expansion

This is an ATLAS extension on top of the already merged authored Dajti scenery/cable-car excursion. It does not yet implement continuous roads from Tirana to Dajti, walkable mountain terrain, surveyed elevation data or accurate pylons. The lake remains incomplete. A larger map viewport or dashed cable alignment is not evidence of a drivable city-to-mountain connection. This PR stays draft pending full app/browser verification; production deployment is not performed.
