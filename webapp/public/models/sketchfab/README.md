# Runtime-only Sketchfab assets

Do not commit downloaded Sketchfab binaries, textures, ZIPs, `.glb`, `.gltf`, or extracted asset folders here.

This folder is intentionally kept almost empty in git. Runtime assets are installed from `webapp/config/sketchfab-assets.json` with:

```bash
cd webapp
SKETCHFAB_TOKEN=<your-token> npm run fetch:sketchfab-assets
```

To install one asset from a manually downloaded Sketchfab ZIP/folder on a phone-synced drive:

```bash
cd webapp
npm run fetch:sketchfab-assets -- --asset asset-id --from /path/to/sketchfab-download.zip
```

Every installed output path under `webapp/public/models/sketchfab/` is ignored so pull requests contain only text manifests, code, and documentation.
