# Tirana urban world update

The shared playable world is now an authored 8.6 km × 6.6 km urban cut, `[-5000, -3500, 3600, 3100]`, in the existing metre coordinate system. It retains Kombinat, Astir, Lapraka, Kinostudio, Fresku, Shkozë, Sauk and the central districts, including the Tabakëve / Njësia 2 / Ali Demi work. Surrel and Dajti are outside gameplay.

| Runtime data | Before | Urban cut |
| --- | ---: | ---: |
| Road segments | 149,566 | 99,544 |
| Buildings | 47,742 | 33,946 |
| Connected traffic graph nodes | 79,569 | 54,682 |
| Simulated road vehicles | 5,600 | 2,400 |
| Pedestrians | 2,400 | 1,400 |
| Buses | 30 | 24 |

These are content and simulation budgets, not measured frame-rate claims. Local rendering budgets remain independent of the total persistent population.

`webapp/scripts/build-tirana-urban.mjs` reproducibly crops the archived `sourceData.mjs` snapshots and writes compact, pre-cropped gameplay modules. Full source snapshots are generator inputs only and are not imported by gameplay. Attribution, original endpoint identities, one-way restrictions and provenance are retained. Source buildings must fit the cut; road segments crossing the edge are removed without fabricated junctions. The traffic graph retains the directed component with legal routes both from and back to central Tirana. One-way stubs cannot receive traffic spawns. Polygon surfaces are clipped to the same limits.

Map places, signs, education sites, canopy and completion fixtures use the same cut. On-foot and vehicle collision and flight limits use `WORLD.bounds`; long vehicles also clamp their full oriented footprint. The explorer no longer advertises rural destinations or cable stops. The active world no longer constructs mountain terrain, rural forest/cable layers or coastal scenery, and world enhancements no longer force a 55 km camera range. The independent archived cable/terrain preview mathematics remain available to their historical review modules.

All 15 weapon stores, 300 city pickups and 11 building access sites remain in the retained map. Existing Skanderbeg monument geometry is preserved.

## Two square monuments

The added Sulejman Pasha and Unknown Partisan models are original procedural, photo-informed approximations, not scans. Their dimensions, facing and small relief details are authored estimates. No reference photograph or third-party mesh is redistributed.

| Model | Source identity and map anchor | Depiction |
| --- | --- | --- |
| Sulejman Pasha | [Municipality](https://tirana.al/pika-interesi/shtatorja-e-sulejman-pashes), [OSM node 6442256741](https://www.openstreetmap.org/node/6442256741), 41.32832, 19.82165 | Standing bronze figure with long robe, mantle, fez, scroll and low hedge-framed base. Municipality identifies Maksim Shurdhi and installation in 2000. |
| Unknown Partisan | [Municipality](https://tirana.al/pika-interesi/monumenti-i-partizanit-te-panjohur), [OSM node 3006044550](https://www.openstreetmap.org/node/3006044550), 41.32820, 19.82191 | Forward-striding bronze soldier with raised pistol, pale stone plinth and original abstract relief. Municipality identifies Andrea Mano and 1949. |

Visual references inspected: [Sulejman Pasha, own-work March 2026 photo](https://commons.wikimedia.org/wiki/File:Suleim%C3%A1n_Pasha_(S%C3%BCleyman_Pa%C5%9Fa)_01.jpg) and the [Unknown Soldier reference collection](https://commons.wikimedia.org/wiki/Category:Monument_to_the_Unknown_Soldier,_Tirana). The two models use six static material batches and 4,904 triangles together, no new lights or downloaded textures, and hide beyond 650 m (320 m in battery mode). Their plinths share source anchors, dimensions and facing with walking and bullet collision.

## Verification

`test/tiranaUrbanWorld.test.mjs` verifies retained geometry and tree bounds, complete connected routing indices/directions, reachable municipal/Grand/Ali Demi focus targets, all stores/pickups/accessible roofs, four-edge walking and complete bus-footprint clamps, monument movement/bullet obstruction, and preservation of original road endpoints at the cut. The geometry smoke check verified all sculpture coordinates are finite and the stated batch/triangle budget. Device frame-time, final lighting and recognizability still require a live WebGL/phone review.
