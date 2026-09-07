# Google Photorealistic 3D Tiles in Tirana Streets

The integration is implemented. It is **inactive until an authorized Google Maps key is configured**. No key or Google map imagery is included in the repository. The currently deployed city remains the original Blender/OSM scene while inactive.

## Activate

1. In the owner's Google Cloud project, enable billing and **Map Tiles API**, then create an API key restricted to **Map Tiles API**. This integration makes server requests, so a browser HTTP-referrer restriction will not work. Where the host provides fixed outbound IPs, restrict the key to those addresses as well.
2. Add `GOOGLE_MAPS_TILE_API_KEY` as a **secret runtime environment variable** on this existing Site. Redeploy its saved version to apply runtime environment changes. For TonPlaygramWebApp, set the same variable on the Express bot server and restart it. Do not set it in a `VITE_*` or `NEXT_PUBLIC_*` variable.
3. Open Settings → City scenery → **Google 3D + playable streets**. Verify real API access, detailed Tirana coverage, the height at the seam, and performance on the actual portrait phone before considering the Google presentation validated. If necessary, set `GOOGLE_MAPS_TILE_ORIGIN_HEIGHT` to the **WGS84 ellipsoidal height in metres** of the map origin. The initial 150 m value is an unverified starting point, not a measured elevation.
4. Set suitable Google Cloud request quotas for the project's intended audience. `GOOGLE_MAPS_3D_ENABLED=false` turns streaming off without removing the secret.

This workspace has no configured Google key and no authority connected for creating a Google Cloud billing project/key. No paid API calls have been made. Tirana's photorealistic coverage and imagery date have **not** been verified. Tiles are served as available from Google; Street View capture dates do not identify the date of these 3D models.

## Presentation and game behavior

- The Google layer supplies live streamed surroundings outside a 145 m radius around the player (or lobby view target). The foreground keeps the original Blender buildings, railings, river, street furniture and physical surfaces. The enterable weapon shop and moving characters remain locally authored.
- The layer uses a rigid WGS84 ECEF → east/up/south transform at **41.3275 N, 19.8188 E**. This preserves north and heading. The original map's metre approximation has less than 3 m horizontal drift across this compact district; this is a hybrid scene, not a surveyed reconstruction.
- No Google mesh is used to create collision maps, exported to Blender or saved as game assets. The player/camera/aiming and authoritative multiplayer simulation continue using the existing OSM/game geometry. Ground-level Google meshes do not supply walkable shop interiors.
- A coarse globe is not treated as detailed coverage. The original city stays visible until nearby detailed tiles are present; missing detail after 45 seconds, API errors, access errors and quota errors restore the original city. Retry is explicit, without an automatic request loop.
- A Google session is replaced after 170 minutes. Switching to Built city, disposing the renderer or leaving the game cancels the session and releases geometry/textures/decoder workers. Background tabs stop scheduling new tile updates.
- Battery/adaptive/high use 80/128/200 MiB tile memory budgets and 3/4/6 simultaneous downloads, respectively. These limits cover the tile renderer's estimated memory, not total browser/GPU usage. Actual mobile GPU verification remains outstanding.
- Visible tiles' copyright strings are aggregated and sorted under **Google Maps → Data sources** inside the map. Local game models and OpenStreetMap credits are identified separately.

## Network and security

`GET /api/tirana-3d/config` returns availability and origin, never the key. `GET /api/tirana-3d/tiles/v1/3dtiles/...` authenticates the viewer, accepts only approved Google tile paths/session parameters and adds the key on the server. Absolute and relative tileset resource links are rewritten to the same proxy while preserving file extensions and the Google session. Redirects and unrelated hosts/APIs are rejected; upstream error bodies are not exposed.

Site requests use the existing ChatGPT identity. The App endpoint requires signed Telegram init data no older than 24 hours, or the existing server API service token. A self-declared TPG/Google account ID is insufficient for this billed endpoint; browser-only players without verified Telegram auth retain the built city. No existing account or game authentication is changed.

Each authenticated viewer is limited to 360 requests/minute per server process/Worker isolate. The local limiter is a best-effort abuse control, **not a global billing cap**; use Google Cloud quotas for aggregate limits. JSON is size-bounded and not stored; binary responses stream through with private cache directives and ETag revalidation. There is no server tile cache, prefetch archive, offline export or service worker tile cache.

## Validation

- `node --test test/tiranaGoogleTiles.test.mjs test/tiranaGoogleRoute.test.mjs` validates georeferencing, URL/session handling, key redaction, failure cases, caching and budgets.
- `scripts/check-google-tiles.ts` exercises the actual 3D Tiles renderer with an original triangle fixture, verifies the streamed geometry/attributions, and checks failure recovery and disposal. Bundle it with esbuild, externalizing `three` and `three/*`, then run with Node. It does not assert Google coverage or a GPU-rendered result.
- TypeScript and the production Site build must pass. Actual Google loading and the visual transition require the owner's configured key and a WebGL-capable phone/browser.

## Primary references

- [Google Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles)
- [Create and restrict an API key](https://developers.google.com/maps/documentation/tile/get-api-key)
- [Google attribution and usage policies](https://developers.google.com/maps/documentation/tile/policies)
- [3D Tiles Renderer, NASA AMMOS](https://github.com/NASA-AMMOS/3DTilesRendererJS) — pinned to 0.3.40 for the existing Three.js 0.164.1; Apache-2.0.
- [Draco decoder](https://github.com/google/draco) — the local decoder distributed with Three.js; Apache-2.0. Decoder files contain no Google Maps data.
