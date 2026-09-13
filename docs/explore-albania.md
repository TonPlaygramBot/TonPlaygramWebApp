# Explore Albania

Explore Albania is a portrait-first 3D truck-driving game at `/games/explorealbania`. Its dedicated garage/lobby is `/games/explorealbania/lobby`.

The first production slice includes twelve geographically positioned Albanian cities, fourteen named intercity corridors, five deterministic freight offers per depot, cargo weight and fragile-load bonuses, fuel, damage, repairs, delivery payouts, career levels, local persistence, day/night lighting, traffic, mountain/coast scenery, three cameras, keyboard controls and mobile hold controls.

This is an original mobile game inspired by the long-haul job loop of commercial truck simulators. It does not copy Euro Truck Simulator 2 code, maps, branding, sounds, vehicle models or textures. Matching a large PC simulator's complete map density and graphical fidelity requires a multi-release art and engineering programme; this PR provides a playable, performance-bounded foundation rather than claiming parity.

## Map and assets

City positions are stored as latitude/longitude and projected into the compressed game world. Major road names and corridor topology follow Albanian geography. The map is a driving interpretation and must not be used for navigation.

Geographic attribution: © OpenStreetMap contributors, Open Database License 1.0. See https://www.openstreetmap.org/copyright and https://opendatacommons.org/licenses/odbl/.

The truck, trailer, buildings, roads, traffic, vegetation, mountains, icon and synthesized engine sound are original procedural game content. No ETS2 or other proprietary game assets are included. The project may later reuse the existing CC0 road materials already credited under `webapp/public/assets/tirana-streets/materials`, but this initial renderer has no runtime third-party asset download.

## Verification

Run:

```sh
node --experimental-strip-types --test test/exploreAlbania.test.mjs
npx tsc -p tsconfig.explore-albania.json
npm --prefix webapp run build
```

The deterministic tests cover graph connectivity, geographic endpoints, freight generation, acceleration/steering/braking, fuel, off-road damage, delivery completion and servicing. Physical iOS/Android performance, touch feel and WebGL compatibility remain release checks.
