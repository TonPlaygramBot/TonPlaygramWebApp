# Tirana Streets city infrastructure update

The uploaded Namazgjah mosque replaces its mapped reference facade, while the separate Et’hem Bey mosque is preserved. The uploaded GTI is the first enterable car in Street Career/City Stories and is parked nine metres from the operation start.

Five original Blender bike models replace the generic civilian motorbike: city bicycle, mountain bike, delivery e-bike, city scooter and street motorcycle. The simulation distributes 700 of these across real road lanes. Renderers share loaded assets and cap visible bikes at 20 in battery mode or 48 in normal mode. Existing Albanian police motorcycle models keep their liveries.

Police cars and crews exist before wanted levels change. Nearest reachable units receive staggered orders after a 3.5-second dispatch delay; escalation retains existing responders. Patrols and station reserves use road routes, lane offsets, traffic gaps, line of sight, search, regroup and return states. Six mapped stations provide reserves. Custody reuses an existing station van and crew, boards the escort, and drives to the police directorate. It never creates a van beside the player.

Pedestrians choose connected walking paths, pause, avoid neighbors and yield to predicted vehicle movements. Traffic includes junction reservations and mapped bus-stop dwell periods. Thirty-three mapped roundabouts receive traffic officers with alternating approach phases. These timings are game rules, not real traffic-control schedules.

Shopfront glazing now has transparent panes, frames, interior shelving, merchandise and lighting. Twelve identities have Blender-authored raised signs using packaged operator artwork, including the University of Tirana. Marks are attached to matching mapped identities. This is an incremental improvement of the existing city, not a surveyed reproduction of every facade.

## Review

After `cd webapp && npm ci && npm run dev`, open `/tirana-city-update-review.html` for the models and `/tirana-mobile-review.html` for the portrait game. These review pages are also included in the production build. If WebGL is unavailable, the model review displays Blender renders of the actual exported files.

## Rebuild assets

Use Blender 4.5.3 / its Python `bpy` module, Pillow, NumPy and OpenCV. From the repository root:

```sh
python tools/blender/tirana_mobility.py --uploads /path/to/original/uploads
node tools/blender/compress_city_uploads.mjs
python tools/blender/tirana_identity_signs.py
python tools/blender/tirana_asset_previews.py
```

Editable bike/sign sources are in `assets-source/tirana-city-mobility/`. Upload originals are identified by SHA-256 in the runtime manifest; the scripts bake their hierarchy, resize textures and compress meshes with Draco without changing triangle topology. The mosque's main plinth is aligned to terrain while retaining scan fragments below it.

## Verification and remaining checks

- Production build passed, including original-asset hash verification and game-pack generation.
- Police infrastructure, route continuity, escalation persistence, custody, fleet placement, enter/drive/exit and deterministic traffic tests passed.
- Existing Street Career tests passed.
- The population suite has one failing shop-wall assertion using fixed offsets; the other eight tests passed. The shop collision implementation was not changed by this update.
- Repository-wide strict TypeScript checking reports existing errors outside this change; it is not a clean project-wide gate.
- Browser review opened successfully, but the available browser rejects WebGL context creation. Actual exported assets were rendered and inspected in Blender. Live device gameplay, frame rate and final in-world visual approval remain necessary before merging.

## Credits

See [asset attribution](../../webapp/public/assets/tirana-streets/city-mobility/ATTRIBUTION.md). The uploaded mosque identifies CC BY-NC 4.0 and the GTI identifies Sketchfab Standard; these are not unrestricted open-source assets. The five original bike meshes are CC0. Brand marks retain their owners’ rights.
