# Downloaded game loading — 2026-09-14

Baseline: `aa84f9e` on `main`. The user completed the full app download but reported unchanged game loading time. The investigation reproduced shared download-routing and metadata-work defects; it did not measure the user's phone.

## Findings and corrections

| Path | Before | After |
| --- | --- | --- |
| Page fetch for a mapped provider model | The outer download interceptor rejected the remote URL before the inner resolver mapped it to the bundled local file. A client without a controlling worker went to the network. | Both layers use the same pure URL resolver before checking downloaded files. The actual installation-order test returns the saved bytes with zero network requests. |
| Repeated file requests | Both page and worker readers parsed the full 2,467-entry receipt for every request. | Legacy receipts are parsed once per immutable cache version, with concurrent requests sharing that parse. New receipt headers expose the build without parsing the asset list. Memory is bounded to 32 versions per CacheStorage. |
| Returning Home / reconnecting / required game route | Routine reconciliation scanned all downloaded files; the route guard could await that scan before rendering. | Routine checks validate the cache and completion receipt. Explicit **Check for updates**, installation and default reconciliation still verify every file. |
| Domino entry module | The manual version query did not match the bare URL stored in the download. | The request uses the app build; only its single matching `v` query can alias the verified full-app entry. Other queries/builds retain exact lookup behavior. |
| Direct local external-asset queries | The resolver could remove query strings when recognizing a known local asset path. | Query strings remain intact. The fallback for provider-prefixed glTF sidecars applies only to foreign-origin URLs without a query. |

Every runtime lookup still checks that the completion marker and requested asset exist. Missing markers invalidate memoized build metadata. Incomplete caches, wrong builds, authorization, installer verification, live-service routes, arbitrary query strings, and existing no-store policies keep their protections. Cached Responses are returned directly instead of unnecessarily cloning their body streams.

## Verification

- `npm run test:app-download`: **122 Node tests + 21 component/hook tests pass (143 total)**.
- Both page and actual worker-source fixtures exercise 50 simultaneous file requests against a 2,467-entry legacy receipt: **one receipt parse, 50 completion-marker checks, zero network requests**. The old path performed 50 receipt parses. New build-header receipts require zero JSON parses.
- Real hook/reconciler tests show **zero individual asset reads** for Home/reconnect and a receipt-only required-game route check. Explicit/default verification checks all **2,467 files** and detects a missing individual file. Malformed or absent completion records remain invalid.
- Mapped provider fetches, normal local files, the current-build Domino entry, completion removal, asset eviction, concurrent reads, legacy-cache fallback boundaries, and authenticated/verification bypasses are covered.
- Independent source review found no blocking issues.
- Final Vite production source compilation passed for all four configured entries (2m 19s). It used the actual Vite configuration with `publicDir: false` and a separate output directory; unchanged multi-gigabyte public assets were not recopied or repackaged. Worker behavior is covered by the real worker-source fixtures above.

## Limits and using the change

Browser automation could not start (`Connection closed`), so there is no new live Telegram measurement or portrait screenshot. The runtime tests use the real modules/worker source with browser API fixtures; they are not a physical-device benchmark or a new 9.5 GB download.

Downloads remove repeat transfers. Model parsing, texture decoding, shader compilation and scene construction still happen when games start. This patch does not claim an FPS increase, instant loading, or a change to graphics quality. Same-build checks remain enforced; after deploying a new build, Home may offer an update to the saved app. The installer reuses verified existing file bytes during that update.
