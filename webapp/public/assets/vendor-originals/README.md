# Bundled source originals

These 28 unchanged files (2,931,411 bytes) are the existing game resources that failed during Render deployment `1593eb3` on 2026-09-14: 27 Poly Pizza requests returned HTTP 403 and the 256px Autumn Park thumbnail returned invalid PNG data.

They were copied from the previously verified asset import, without downloading through the failing endpoints, changing formats, resizing, recompressing, or substituting another model. Every file matches both its existing `sourceSha256` and the unchanged committed `webapp/scripts/external-assets/source-lock.json` pin. The nine GLBs are self-contained; their original model metadata and embedded textures remain intact. Nine other Poly Pizza GLBs are already committed under `assets/tirana-streets/imported` and are reused there.

`manifest.json` records the exact source URL, local URL, size, SHA-256, and this provenance for every file. The build requires these originals, verifies them before importing, and maps the existing source requests to these local paths. Missing files, modified bytes, and disagreement with the source lock fail the build. They are included in the complete app download.

## Existing creator attribution

The names below are retained from `webapp/src/config/snakeWeaponCatalog.js`, which describes their license as “CC0 / Poly Pizza source page”. Original source URLs are recorded per file in the manifest. This copy does not change the source licensing or claim new authorship. GLB metadata is preserved byte for byte.

| Poly Pizza asset ID | Existing catalog label | Creator |
| --- | --- | --- |
| `032e6589-3188-41bc-b92b-e25528344275` | Quaternius Shotgun | Quaternius |
| `b3e6be61-0299-4866-a227-58f5f3fe610b` | Quaternius Assault Rifle | Quaternius |
| `3b53f0fe-f86e-451c-816d-6ab9bd265cdc` | Quaternius Pistol | Quaternius |
| `9e728565-67a3-44db-9567-982320abff09` | Quaternius Heavy Revolver | Quaternius |
| `9a6ee0ee-068b-4774-8b0f-679c3cef0b6e` | Quaternius Sawed-Off | Quaternius |
| `7951b3b9-d3a5-4ec8-81b7-11111f1c8e88` | Quaternius Revolver Silver | Quaternius |
| `f71d6771-f512-4374-bd23-ba00b564db68` | Quaternius Long Shotgun | Quaternius |
| `08f27141-8e64-425a-9161-1bbd6956dfca` | Quaternius Pump Shotgun | Quaternius |
| `fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710` | Quaternius SMG | Quaternius |
| `78e23275-cb6a-4ba3-ae5e-48a9b4ee2e65` | Quaternius Robot Large Gun | Quaternius |
| `6d0889f1-0c3f-4f98-b011-fbcf6c79a93b` | Quaternius Robot Flying Gun | Quaternius |
| `613e3b1b-d07c-496b-94a1-7c85b507bac4` | CreativeTrio Bazooka | CreativeTrio |
| `503bb2c5-4a69-404b-9b82-13e85e8f8467` | CreativeTrio Grenade Launcher | CreativeTrio |
| `38e858db-325f-4dce-9680-da62c20c5c31` | CreativeTrio Dynamite Bomb | CreativeTrio |
| `d7bb0b50-09af-49f8-b1f9-dbdb0c707d40` | CreativeTrio Molotov | CreativeTrio |
| `9c4d2ac5-114b-4da2-a26a-8049e2b1ba04` | Quaternius Gas Tank | Quaternius |
| `03fa7f5b-4df5-45d6-86fb-87e8590f28d7` | CreativeTrio Hand Grenade | CreativeTrio |
| `58c387b2-636f-49dc-a900-13b0852717d6` | Quaternius Battle Tank | Quaternius |

The `autumn_park-256.png` file is the original 256 × 256 preview from [Poly Haven Autumn Park](https://polyhaven.com/a/autumn_park), with its exact query URL retained in the manifest. Poly Haven's source and attribution remain applicable.

## Additional build recovery on 2026-09-21

Two more existing images are bundled because their providers changed automatic format negotiation and blocked the Render prebuild. Both files match the already committed source-lock SHA-256 exactly; no source pins, image content, dimensions or game references were changed.

| File | Recovery | SHA-256 |
| --- | --- | --- |
| `old_wood_floor-256.png` | The existing Poly Haven URL returned WebP despite its `.png` extension. Requesting the same URL with `&format=png` recovered the original 256 × 256 PNG (106,288 bytes). | `6fa9d96cf8bcb032536a3438898bee5195fd93ccf293f572bfb576ad35bc0654` |
| `domino-room-background.jpg` | The existing Unsplash URL returned a different automatically encoded JPEG. Adding `&fm=jpg` recovered the original 1600 × 1200 JPEG (286,221 bytes). | `a8c4f267291c290ef6310ef0e8d3e1b5a8e2e3c585e0f54633212e00d0a102a2` |

The exact original source URLs remain in `manifest.json`. The existing provider attribution and licensing continue to apply. These copies use the same required-file and checksum verification as the earlier bundled originals, so clean builds no longer depend on the two format-negotiating endpoints.
