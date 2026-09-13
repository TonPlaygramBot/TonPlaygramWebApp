# Tirana Streets: uploaded arsenal and starting kit

The five supplied GLBs now appear in the authoritative TPG store catalog, solo
operations, Street Career inventory, NPC equipment and store displays.

| Weapon | Game ID | Store price (TPG) | Mobile GLB |
| --- | --- | ---: | ---: |
| Adaptive Combat Rifle | adaptiveCombatRifleAttack | 3,200 | 1.76 MB |
| SVD 63 / Dragunov | dragunovAttack | 3,900 | 1.78 MB |
| PP-19-01 / Vityaz | vityazAttack | 2,100 | 4.09 MB |
| AR15 Rifle | ar15Attack | 3,000 | 2.53 MB |
| Makarov PM | makarovAttack | 950 | 1.39 MB |

All stats are fictional game balance. Prices still come from the shared server
catalog, with the existing authentication, atomic debit and idempotent receipt
handling. Choosing a starting kit gives local session equipment, not paid account
ownership. Existing saved weapons, spent ammunition and campaign progress survive.

Solo starts now offer the installed Human Soldier and City Operator bodies in a
React/Three.js preview, followed by exactly three distinct starting firearms.
The first choice is equipped. Street Career retains its utility knife. Existing
uninstalled soldier entries remain in the catalog and appear when a validated
local rig is installed. Online matchmaking retains its existing entry flow.

Patrol/traffic police carry the Makarov, Shqiponja units use Vityaz/Makarov,
FNSH/RENEA use AR15/Vityaz/ACR, and army squads rotate ACR/AR15/Dragunov. Both the
city dispatch simulation and the FPS visual adapter use the same role policy.
New store models load sequentially only near a shop and share resources across
the fifteen interiors. Thumbnails are generated ahead of time from the shipped
geometry, so opening the selection list creates no extra WebGL contexts.

## Asset provenance and reproduction

`webapp/public/assets/tirana-streets/weapons/manifest.json` records each uploaded
filename, original hash, output hash and its original embedded author, source URL
and license metadata. That metadata includes CC BY, CC BY-NC and Sketchfab
Standard entries; importing the models does not change those terms.

The original uploads are unchanged. Runtime derivatives omit presentation floors,
stands, spare parts and duplicate display copies, bound PBR textures, and use the
existing meshoptimizer pass with a 26,000-triangle target and locked boundaries.
Every model is below the existing 5 MiB mobile test budget (about 11.55 MB total).

Rebuild with installed webapp dependencies, Python, Pillow and numpy:

```sh
python scripts/import-tirana-uploaded-weapons.py /path/to/original/uploads
node scripts/generate-tirana-weapon-thumbnails.mjs adaptiveCombatRifleAttack dragunovAttack vityazAttack ar15Attack makarovAttack
```

Run the normal webapp dev command and open `/tirana-loadout-preview.html` to
exercise the actual picker and enter Street Career. `?weapon=ar15Attack` (or another
uploaded ID) opens the individual model inspector. This is a development entry,
not a replacement for the game's normal route.

## Validation

- Production Vite build passes.
- Actual GLB parsing, embedded textures, hashes, size limits, character skins,
  locomotion clips and hand bones checked without a GPU.
- Starting selection, invalid counts, duplicates, ammo preservation and legacy
  starter migration covered by tests; React navigation test covers the full
  character → three weapons → start flow.
- 43 targeted Node tests pass, including force rendering, campaign, player combat,
  all five server-side store purchases, price tampering and concurrent receipts.
- The React navigation test passes (44 targeted checks in total).
- Live portrait browser inspection remains unverified: this session blocks the
  network permission needed to expose the local preview server.
- The repository-wide strict TypeScript command reports existing unrelated
  errors; the production build and targeted tests are the validation gates here.
