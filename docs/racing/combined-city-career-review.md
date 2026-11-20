# Combined city / circuit career review

This branch integrates the licensed facade modules, bounded medium tree LOD,
factual signage, twenty entirely new source-backed circuits, and local circuit
career. It is a review build, not a deployment or a claim of GTA-level fidelity.

## Integration decisions

- Only the twenty new routes are selectable. The six former central circuits and
  three rural selections are retired. Fourteen historical/theme IDs migrate to
  explicit new IDs; no old route is renamed and presented as new geometry.
- Garage selection starts at the actual first catalogue entry. Historical room
  and result labels are normalized before lookup, avoiding missing-track UI.
- Career derives its twenty stages from that same catalogue. The integration test
  completes every actual stage in order, saves/reloads each step, checks the next
  unlock and verifies zero duplicate reward on replay. Retired progress cannot
  unlock a new course; old device storage is not deleted.
- Career entry is disabled while an online room/session or request is active,
  so switching modes cannot abandon an in-flight room operation.
- Career inventory is local practice state, isolated from TPG stakes and online
  entitlement. The game catalogue explicitly labels it Local Career.
- Tests of unreachable historical city-job reward logic use an explicit closed
  track fixture. They do not claim the removed free-driving routes are playable.
  Historical road/pad fixtures remain test-only; new-course source geometry,
  boundaries, grid clearance and twelve-rival AI are independently checked.

## Release gates and limitations

- Blender renders validate the actual acquired facade modules and a mapped
  building with inset fallback walls, plus the medium tree silhouette. They are
  not game screenshots or a physical-device performance check.
- Browser/WebGL play verification is still blocked in this environment. Race
  handling/camera feel, alpha shimmer/LOD transitions, mobile readability and
  sustained frame time must be checked on a real playable build before claiming
  those outcomes verified.
- Root TypeScript and standalone kart Vite builds are run. Scoped kart TypeScript
  retains sixteen existing TS7016 missing-declaration diagnostics in unrelated
  Tirana scenery imports. These are not a clean scoped-typecheck result.
- Stake unit tests are run after installing the repository's locked bot test
  dependencies without scripts. Mongo stake integration is skipped unless a
  disposable replica-set URI is explicitly supplied, never production data.
- Newly acquired assets have recorded CC0 provenance. No new unverified landmark
  or brand-logo download is introduced; this is not a blanket rights clearance
  for historical assets already in the repository.

No merge, deployment, sponsorship, surveyed tree species, or complete real-world
city reconstruction is implied by this review branch.

## Final combined automated results

`node --test --test-concurrency=2` over all racing/kart suites plus career,
facade, tree and factual-signage coverage: **320 passed, 0 failed, 1 skipped**
(321 total). The skip is the explicit disposable-Mongo replica-set test.
The bounded concurrency avoids resource contention seen in the first broad run.
Online input tests synchronize socket receipt before advancing their injected
simulation clock; no production item-authority behavior was relaxed.

React/navigation/renderer coverage: **27 passed** after the online Career-entry
guard regression. Root TypeScript build and standalone Racing Vite build passed;
the separately scoped scenery declaration limitations above remain.
