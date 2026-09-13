# Air Hockey: dedicated uploaded table and portrait controls

Air Hockey previously imported `Table3D` and dimensions from `PoolRoyale.jsx`, making its appearance depend on Pool Royal. It also retained corner-pocket capture behavior.

This change loads the supplied Hoven66 GLB exclusively from `public/assets/airhockey/air-hockey-table.glb`. Its four connected geometry islands become the table, two moving mallets and moving puck. The table keeps its authored texture and UV coordinates. Moving pieces keep their original geometry and existing selectable colors. The asset is byte-for-byte identical to the upload; attribution appears in the asset README and game settings.

Air Hockey now owns its dimensions and loader. It no longer imports Pool Royal's renderer. No Pool Royal, shared table, shared material, game-pack definition or camera file was edited. The existing Air Hockey field size, surface height, camera construction, fit calculations, top view, lift range and screen-to-table input mapping are retained from main `5c5e7f3`. The new model is fitted to those coordinates. There are no pool corner pockets: corners rebound, and only pucks fitting within the modeled end openings score. Simulation waits for the model to load.

The portrait interface has a compact top scoreboard, five labeled controls with 44–54 px touch targets, a separate camera-height control and a native modal settings sheet with safe-area spacing. Graphics, commentary, environment, puck, mallets, goals, chat, gifts and live-video controls remain available. Pool-style cloth, wood and base selectors are removed from this game because the uploaded table supplies its own fixed surface and base; stored inventories are not modified.

## Validation

- Six tests in `test/airHockeyModel.node.mjs`: complete geometry/UV extraction, field alignment, piece radii and height, four solid corners, end-goal clearance and unaffected midfield motion.
- TypeScript check for the new model, collisions, controls and preview renderer.
- Vite production build.
- Camera and input code compared directly with the main baseline; unchanged.
- Integrated offline preview smoke check: load the uploaded model, render both views, open/close settings, toggle sound, toggle views and lift the camera. No runtime errors. Software-rendered frames were inspected.
- The live browser check was blocked by the existing app's unrelated Tirana asset downloader failing during startup. Full WebGL rendering on a phone and online multiplayer were not exercised in this environment.

## Review

`webapp/air-hockey-review.html` mounts the production component. `node scripts/build-air-hockey-preview.mjs` creates the in-chat portrait preview from the same production game, camera, control and collision code. The inline preview embeds the GLB, substitutes local audio, omits the external HDRI picker, and replaces live services with a notice. It can render the same scene in software if the preview frame has no WebGL context. Those substitutions are only in the preview build, not the production game.

The `assets/airhockey` path is already included in the existing Air Hockey game-pack definition. No changes to Pool Royal's pack are required.
