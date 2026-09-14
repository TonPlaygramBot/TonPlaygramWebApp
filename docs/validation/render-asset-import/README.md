# Render asset import repair — 2026-09-14

Render deployment `dep-dajvbsdg1s2s73cas6h0`, commit `1593eb3`, failed before Vite compilation. Its logs show 27 HTTP 403 responses from `static.poly.pizza` and invalid PNG data for Poly Haven's Autumn Park 256px thumbnail. The import reported 1,351 assets / 9,724,174,515 bytes, 28 failures. Exact log messages are in `failed-assets.json`.

The local validation before the previous PR had cached these originals and did not exercise their availability from Render. This repair removes that dependency for the affected resources: 28 unchanged originals totaling 2,931,411 bytes are now committed under `webapp/public/assets/vendor-originals`, with source URLs, sizes, SHA-256 and creator provenance. Their bytes match the existing source lock; the lock is unchanged. Nine other Poly Pizza originals were already committed and continue to be reused.

The collector requires these files and verifies their checksums; the frozen importer independently enforces the source lock. Runtime source URLs map to the committed files and the full app package includes them. Resumed imports update cached record paths consistently when switching to a committed original. Stable original URLs revalidate through the bot's static server. CI runs when these originals change.

## Validation

- `npm run test:app-download`: **106 Node tests and 7 UI tests pass** (113 total).
- Six importer regressions cover an empty output with network unavailable, every one of the 28 real shipped originals, missing/modified files, missing/different source pins, external model dependencies, and migration from an existing downloaded copy.
- The real 28-file cold-import test performs **zero provider requests**, checks each original against the unchanged source pin, and passes offline manifest verification.
- `npm run build --prefix webapp` completed: frozen import **1,379 assets / 9,727,105,926 bytes, zero failures**, offline verification, Vite production compilation and full app manifest generation.
- Before that build, all 28 affected external cache files and their prior manifest records were removed. The unaffected large assets were reused from their verified cache; this was not a second full 9.7 GB network transfer. Provider metadata was freshly resolved in the separate build worktree based on current main.
- The complete emitted application contains **2,467 files / 10,238,655,777 bytes**. Every new original is present with exact size/hash, and every affected original source URL maps to its local file. Bot cache-header verification confirms those stable paths revalidate.
- An existing recovery test assumed a cache write would finish within 15ms. It failed under concurrent build load; explicit cache-commit and worker-cleanup barriers now test the intended ordering without wall-clock assumptions.

This change fixes the observed build failures. It does not claim a completed Render deployment before the repair is merged, a full-device download, physical Home Screen installation or improved rendering FPS.
