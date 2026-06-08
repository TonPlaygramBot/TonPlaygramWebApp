# Sketchfab asset workflow without binary pull requests

This project must not put downloaded Sketchfab model binaries into pull requests. The pull request should contain only text files: code, manifests, README notes, and attribution/license metadata.

## What to do when a Sketchfab link is provided

1. Confirm the model is legally usable for the game:
   - It must be downloadable, purchased, or otherwise licensed for this project.
   - Record the creator, license, and attribution requirement.
   - Do not bypass Sketchfab downloads or rip non-downloadable models.
2. Add a text-only entry to `webapp/config/sketchfab-assets.json`.
3. Point the entry at a gitignored runtime path under `webapp/public/models/sketchfab/<asset-id>/`.
4. Use `npm --prefix webapp run fetch:sketchfab-assets` to install the real asset locally or in deployment, not in the PR.
5. Load the installed same-origin model from React/Three.js with a URL such as `/models/sketchfab/<asset-id>/scene.gltf` or `/models/sketchfab/<asset-id>/model.glb`.

## Manifest entry format

`webapp/config/sketchfab-assets.json` starts empty:

```json
{
  "assets": []
}
```

When adding a Sketchfab asset, append an object like this:

```json
{
  "id": "wooden-crate",
  "label": "Wooden Crate",
  "uid": "00000000000000000000000000000000",
  "sourceUrl": "https://sketchfab.com/3d-models/example-00000000000000000000000000000000",
  "format": "gltf",
  "targetDir": "public/models/sketchfab/wooden-crate",
  "targetFileName": "scene.gltf",
  "license": "CC BY 4.0",
  "creator": "Creator Name",
  "attribution": "Wooden Crate by Creator Name on Sketchfab, CC BY 4.0",
  "notes": "Mobile optimized before release; keep under runtime storage, not git."
}
```

Use `format: "gltf"` for Sketchfab converted glTF ZIPs. Use `format: "glb"` only when the API/account returns a GLB archive URL or when manually installing a `.glb` file.

## Phone-friendly workflow

If working from a phone in portrait:

1. Send the Sketchfab URL in chat.
2. The assistant adds or updates the manifest entry in the pull request.
3. The binary model is not committed.
4. On deployment or a machine with asset access, run the fetch command with `SKETCHFAB_TOKEN`.
5. If you manually downloaded the ZIP from your phone, upload it to private storage and run the fetch command with `--from` pointing at that ZIP/folder.

## Commands

Install all configured assets through the official Sketchfab API. By default the script sends `Authorization: Bearer <token>` for OAuth access tokens. If you need token auth instead, add `SKETCHFAB_AUTH_SCHEME=Token`.

```bash
cd webapp
SKETCHFAB_TOKEN=<your-oauth-access-token> npm run fetch:sketchfab-assets
```

Install one configured asset:

```bash
cd webapp
SKETCHFAB_TOKEN=<your-token> npm run fetch:sketchfab-assets -- --asset wooden-crate
```

Install one asset from a manually downloaded Sketchfab ZIP, extracted folder, `.gltf`, or `.glb`:

```bash
cd webapp
npm run fetch:sketchfab-assets -- --asset wooden-crate --from /path/to/wooden-crate.zip
```

Validate installed local files without downloading:

```bash
cd webapp
npm run fetch:sketchfab-assets -- --validate-only
```

## Pull request rule

Allowed in PRs:

- `webapp/config/sketchfab-assets.json`
- loader code
- attribution markdown
- documentation
- small text placeholders such as README files

Not allowed in PRs:

- `.zip`
- `.glb`
- `.gltf` payloads
- `.bin`
- downloaded texture images
- extracted Sketchfab folders

The runtime output root `webapp/public/models/sketchfab/` is gitignored to enforce this.
