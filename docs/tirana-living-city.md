# Tirana Streets: local life, full-body player and TPG equipment

This change targets the active `TiranaStreets → Blackwater → StreetCareerGame` route. It continues the business expansion on `main` with mapped local amenities, a suited player, account-backed equipment purchases and wider streaming.

## City detail and references

- **106 mapped fuel stations**, including **101 additional identity boards**. New boards have their own posts; existing source canopies remain intact. Four operator-published identities—Gega Oil, Eida, Bolv and Kastrati—cover 46 station signs. Kastrati retains its written name beside the operator's white rhino mark.
- Six additional food identities: **Crepa Crepa, Heb's, Delibros, Mr. Chicken, Hermanos and MonoMia**. These cover eight existing mapped storefronts. The combined registry has **74 identities / 422 branded boards**, including fuel signs. Existing Mon Chéri artwork also matches its mapped coffee-shop name variants. No branch is placed solely because another business shares part of its name.
- Barber poles, bakery display bread, cafe cups and fast-food menu boards use existing tenant locations and category tags. Shared central and neighbourhood layers do not add duplicate storefront walls.
- **242 park and 116 playground source records** are retained. The placement build found room for benches in **227 park polygons** and compact play equipment in **74 playground polygons**. Furniture stays within the mapped boundary and avoids mapped buildings, roads and water. Point-only or cramped records are omitted from the furniture pass. Equipment arrangements are authored, not surveyed.
- The [Tirana municipality article](https://tirana.al/artikull/kende-lojerash-ne-cdo-lagje) documents neighbourhood playgrounds, including Mine Peza and the Lake Park. It does **not** supply equipment coordinates. Geometry comes from the checksummed OpenStreetMap archive already held by the project; source IDs, URLs and coverage are in `tirana-local-life-sources.json`. Unsourced observation-wheel/carousel models are replaced by the mapped park pass; the Rinia fountain remains.
- Old apartment finishes use varied faded plaster, repair patches, restrained brick exposure, vertical stains, window surrounds and mixed enclosed/open balconies. The reference was the apartment photograph in [BZ's Tirana article](https://www.bz-berlin.de/ratgeber/29-stunden-in-tirana-albanien). This changes the existing classified housing set; a morphology estimate does not prove a building's construction era. The photograph is not redistributed.

`tirana-local-logo-assets.json` records each of the ten new prepared PNGs, source image URL and checksum. Operator sites supply fuel marks; the merchants' Tirana Wolt listings supply explicitly named `brand_logo_image_url` assets. Brand artwork is not CC0 and implies no sponsorship. Photographs, merchant coordinates, facade colors and individual equipment layouts have not been surveyed on site.

## Player and equipment

The player now uses a bald, charcoal-suited Quaternius CC0 character with a white shirt and red tie, retaining the complete head and the original Idle/Walk/Run skeleton. This is a suited-agent interpretation, not an official Agent 47/IO Interactive asset. The source archive and deterministic builder are included. Runtime geometry is 4,674 triangles in a 684,392-byte GLB.

Every fresh or migrated loadout owns the existing Glock model and a **Vinrax CC0 knife**. The 30 cm knife retains its original 1,176 triangles in a 160,944-byte GLB. Slashes use melee range, line of sight and one damage window, consume no ammunition and emit no firearm flash/tracer. The held knife follows the attacking hand. The introductory tutorial still begins holstered; both items remain owned.

The on-foot camera frames the full body from behind, pulls forward for walls and moves over the shoulder while aiming. Driving retains the existing cockpit camera. Weapon shops have larger **WEAPONS** boards and pistol-shaped map markers.

`StreetArsenal` now uses the existing `/api/tirana-store` route and the same `User.balance` TPG balance/transaction ledger as Store. The six paid catalog weapons use authoritative server prices; ammunition, healing and armor retain street cash. The free Glock is never charged. Account unlocks are loaded on game entry and restored across mission retries.

The purchase handler atomically checks balance, receipt and ownership while debiting and delivering. Retries after a lost response keep the same account/item purchase reference in local storage. Reusing a reference for a different item returns a conflict. The client uses the shared API base URL and existing Telegram/native/account headers. This change retains the application's existing authentication model; it is not a new authentication system. Tests use simulated accounts, never real TPG funds.

## Rendering, weather and movement

- Building/road radius: **1,800 → 2,400 m**, battery mode **1,100 → 1,400 m**. Approximate circular coverage grows 78% at normal quality. Shared cells keep unfinished generators as the player moves instead of restarting them. Coarse shells precede nearby detail; work uses a 3 ms / 1.5 ms target and bounded caches. Individual geometry operations can exceed the target, so this is not a frame-time guarantee.
- Vehicles/police prefetch before their display radius. Initial nearby sources are awaited under the existing loading screen. Pending original assets suppress generic replacements; permanent failures can use a stable fallback. Detailed civilian cars no longer swap their base identity at 45 m. Collection/force assignments have one visual owner, including legacy snapshots; new collection vehicles are assigned only civilian car types.
- Traffic: **2,800 ordinary/service vehicles plus 30 buses**, with more initial local traffic. Of these, 240 civilian traffic vehicles use the existing original collection. Simulation keeps its 20 Hz integration; distant traffic refreshes expensive perception at 4 Hz. Drivers reduce speed for bends and lane ends and retain queues, signals and pedestrian checks.
- Normal cars cap at **55 km/h**, sports models at **70 km/h**, buses at **45 km/h**, reverse at **12 km/h**, using the world's metre scale. Braking overrides throttle and cannot reverse a stopped car.
- The nearby lighting pass supports 280 / 90 fixtures and a fixed pool of 8 / 2 shadowless street lights plus business lighting. Small rain puddles are one instanced PBR draw, with at most 180 / 60 nearby ovals on non-elevated roads. Wetness expands/fades them; normal perturbations suggest rain ripples. They use the existing environment map, not real-time planar reflections.

## Reproduction and validation

```sh
python webapp/scripts/build-tirana-agent.py
python webapp/scripts/build-tirana-knife.py
node webapp/scripts/build-tirana-local-life.mjs
npx --prefix webapp tsc -p webapp/tsconfig.tirana-living.json
node webapp/scripts/build-tirana-living-preview.mjs
node --test test/tiranaLivingCity.test.mjs test/tiranaWeaponPurchaseClient.test.mjs bot/tests/tiranaStore.test.js
```

The portrait React/Three/TypeScript review contains seven views with production geometry: the suited agent/knife, Kastrati, Turkish Barber, MonoMia, Crepa Crepa, a mapped playground and an old apartment building. It includes screen-relative navigation and day/night/rain controls. The character is baked from its actual idle pose solely for this compact inspection view. The preview is not the live game or a device performance benchmark.

Validation includes production Vite compilation, focused TypeScript, mapped footprint clearance, streaming retention/cancellation, actual rig and portrait-camera geometry, wet/dry instance budgets, vehicle ownership, gameplay regressions, melee walls/range, and payment duplicate/retry/balance races. Payment races use an atomic in-memory document adapter, not a live MongoDB transaction or real account. Local browser navigation is restricted in this environment; GPU rendering, physical phone frame rates and real-account end-to-end payments remain unverified.
