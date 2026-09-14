# Home download storage correction — 2026-09-14

The Telegram screenshot reports 9.5 GB of application files and about 10.0 GB available, but rejects the download at 0 B and asks for another 501 MB. Main at `134a195` multiplies the remaining download by 1.1 before comparing it with `navigator.storage.estimate()`. That hidden 10% reserve explains the contradiction. The estimate describes browser storage for the origin, not physical free disk space; it is approximate and cannot prove that a write will fail.

The installer now attempts the verified download without an estimate-based veto. Actual cache-write failures still stop it, preserve verified files for retry and prevent publishing the completion receipt. Quota errors use the same browser-specific explanation in saved state and in rejected errors. Home labels its figures as estimated browser storage. Inside Telegram, a quota failure offers the existing external-browser action even when the Home Screen shortcut is already installed; it explains that another browser keeps a separate download.

No assets, file sizes, integrity requirements or browser quotas are changed. No existing downloads are automatically deleted to make space.

## Validation

- The new tight-space and conservative-estimate regressions fail against the previous installer. The quota-message regressions also reproduce the prior generic exception reaching callers.
- `npm run test:app-download` passes **110 Node tests and 11 component tests**, including all previous asset-import checks.
- Tests exercise enough estimated space without the old reserve, underestimated/unavailable space, real quota errors after some files are saved, resume without repeating verified downloads, and quota failure while writing the completion receipt.
- Component tests cover screenshot-sized totals, Telegram recovery with installation already confirmed, retry availability, and no extra storage guidance for ordinary/network-error states.
- Full Vite production source compilation passed for all four configured entries (2m 17s). This used the real Vite configuration with `publicDir: false` and a separate output directory; unchanged multi-gigabyte public assets were not downloaded/copied and the full offline package was not regenerated for this source-only change.
- Independent review found no blocking issues.
- Browser automation could not start on two attempts (`Connection closed`), so no new portrait screenshot or physical Telegram download is claimed. A complete 9.5 GB device download remains unverified.

References: [StorageManager.estimate()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate), [Chrome storage estimates](https://developer.chrome.com/blog/estimating-available-storage-space), and [quota write failures](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
