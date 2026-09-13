# Tirana startup and model-download recovery

Base: `main` at `1f49c21`, after lobby PR #25927.

The user's screenshot shows Street Career failing to fetch `/assets/tirana-streets/living/operator.glb` with HTTP 502. The file is present (about 1.1 MB) in the checked-in assets. This is evidence of a failed server response, not proof of a missing repository file. Render runtime logs have not been read: the connector requires the user to confirm a workspace first. The production cause of the 502 remains unresolved.

## Fixes

- Both FPS modes retry transient character-download failures, with a deadline per attempt, caller cancellation and validation of binary GLB headers/size. If the operator fails, they try the existing `suited-agent.glb` rig. A persistent server outage still produces a clear error instead of an invisible character.
- Required city and held-weapon downloads also use bounded retries. Leaving aborts required city/character downloads; partial successful city results are disposed if another required asset fails.
- Battlefield startup no longer repeatedly scans every road/obstacle for each spawn candidate. A segment BVH preserves nearest-road/source-order ties; obstacle cells retain the exact polygon/courtyard and circular-cover tests.
- Spatial lookups also replace full scans when placing street furniture, checking bridges/rivers/signals, and matching mapped institutions. No scenery or gameplay counts were reduced.
- A development-only exception for `terminal.local` prevents the app's canonical-origin redirect from sending the supported preview to the production hostname with port 4173. Production wallet-origin enforcement remains unchanged. This explains the previous preview's 502/connection-refused result, which had been misclassified as preview infrastructure failure.

## Evidence

- Fresh-process layout import measured 31,035 ms before changes; another baseline was 27,928 ms. Final measured import: 8,221 ms. This is local initialization timing, not total network load, a phone measurement or game FPS.
- Compared all 113 map spawn/extraction records and force-vehicle placements with a baseline snapshot: exact equality.
- SHA-256 comparisons of the complete street-prop, collider, railing and mapped-place outputs also matched the baseline. The indices change lookup cost, not placement results.
- `node --test test/tiranaStartupRecovery.test.mjs test/tiranaLobbyLoading.test.mjs`: **10 passed**, covering 502 recovery, 404/HTML rejection, timeout, cancellation, size budgets, backup selection, exact spatial lookups, and lobby import isolation.
- `node --test test/tiranaCitySource.test.mjs test/tiranaStreetDetail.test.mjs test/tiranaFullBodyCareer.test.mjs`: **64 passed**.
- Scoped TypeScript and production build passed. Large world-chunk warnings remain. The final development-only hostname exception was additionally exercised in the live browser.

## Browser checks

The real lobby loaded after the development redirect fix. Changed the map and weapon selectors and verified the launch URL. Opened Battlefield, deployed into an operation with the character and AK-47 ready, paused, and returned to the outer lobby. The runtime stayed interactive after deployment.

The cloud browser uses software compatibility rendering (about 1–2 FPS here). This does not validate GPU visuals, actual phone frame rate, or a complete Street Career WebGL playthrough. Local successful downloads also do not establish that Render's production 502 is resolved. Hosting logs and a real-device check remain necessary.
