# External game assets

`node scripts/vendor-external-assets.mjs` inventories the app's original game
models, textures, environments, fonts, and standalone module dependencies, then
downloads them into `public/assets/external`. Run it from `webapp`.
The live third-party wallet registry and its provider icons are outside this
game asset inventory; wallet connections continue to use the online integration.

```sh
# Inspect declared work without network requests.
node scripts/vendor-external-assets.mjs --dry-run

# Materialize original assets, retaining all declared runtime resolutions.
node scripts/vendor-external-assets.mjs --concurrency 4 --timeout 45000 --retries 1

# Resume within an explicit additional download budget and disk reserve.
node scripts/vendor-external-assets.mjs --max-download-bytes 6500000000 --min-free-bytes 5000000000

# Offline completeness and integrity gate.
node scripts/vendor-external-assets.mjs --verify

# Focused HTTP fixture coverage, including recursive dependencies and resume.
node --test scripts/external-assets/downloader.test.mjs
```

The complete game collection can occupy multiple gigabytes. Assets already
present in the app are reused in place only when their recorded original source,
SHA-256, size, and dependency checks match. Other binaries retain their provider's
original payload. Only URI-bearing glTF/GLB, stylesheets, modules, and metadata
are rewritten to reference local dependencies; GLB binary chunks are preserved.
The default inventory includes required resources. An EXR environment that is
only a fallback for the same available HDR scene and resolution is omitted;
explicit first-choice EXR resources remain required. No texture resolution is
reduced. Defaults cap each import at 10 GiB of additional downloads and retain
at least 2 GiB of free disk space. Exceeding either guard retains an incomplete
checkpoint and fails the build gate.

`manifest.json` records source URLs, downloaded and served hashes, dependencies,
equivalent aliases, selected groups, and unresolved sources. `url-map.json` and
`url-map.js` provide the runtime mappings. The separate `source-lock.json` in this
directory pins original payloads for later builds. Commit that lock after reviewing
a successful import. Downloads checkpoint every ten assets and resume by checking
the existing bytes. Incomplete checkpoints retain previously downloaded originals
that the current pass has not visited, without restoring retired URL aliases.
A dependency whose local target changes causes its referring document to be
restored from the pinned original before rewriting. Verification checks the actual
glTF/GLB, CSS, and module references as well as the manifest's dependency list.
A changed upstream payload fails until an explicitly reviewed
`--update-lock` run accepts it.

`npm run build` materializes assets with `--frozen-lockfile`, then verifies them
before building. A frozen import rejects any source URL absent from the reviewed
lock. The generated download tree and metadata request cache stay outside Git;
the inventory code and source lock make a fresh build reproducible.

The verifier fails for missing required assets, unbundled dependencies, invalid
local checksums, invalid audio signatures (including source symlink text), or
incomplete imports. Source-documented legacy and unused format
fallbacks can be marked `essential: false` by an inventory provider and are excluded
from the default import. The downloader does not invent replacement
models or lower-resolution textures when a source fails.

`--inventory file.json --output directory` supports reproducible fixtures or a
specified inventory using `{ "groups": [{ "id": "asset", "candidates": ["https://…"] }] }`.
Optional `aliases` must describe the exact same resource. HDR and EXR URLs cannot
be aliased across formats because their decoders differ. `--limit` makes a partial
import for investigation and deliberately leaves completeness false.
