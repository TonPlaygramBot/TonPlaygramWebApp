# Tirana city upgrade validation

Base: `e6bd9b7f81282ab1a0aa0e80f8de63df021751d7`.

## Automated checks

- 65 targeted tests passed across the regression run and the final event/force-rig rerun (18/18). Suites: city events, city life, crowd response, force squads, original force runtime, human animation, human material quality, predictive traffic, Street Career integration.
- Full asset prebuild passed: original assets, vehicle hashes, local decoders and all 1,378 vendored external assets verified. Production bundling is still running at this checkpoint.

- Focused TypeScript check: `cd webapp && ./node_modules/.bin/tsc -p tsconfig.tirana-gameplay.json --pretty false` — passed.
- New event tests cover all phases, population bounds, cleanup, disabled/remote/mission conditions, collision rejection, stale/expired orders, unit-specific decisions, crowd flight, traffic detours and the real StreetSimulation pause lifecycle.
- Existing human-animation tests now exercise rally gestures on six original rigs, including restoration to idle and immutable source clips.
- Existing force-runtime tests now inspect original officer gesture targets and material preparation, alongside lazy loading, independent skeletons, original uniforms and grip alignment.

## Baseline failure reproduced independently

`node --test --test-name-pattern='paired foot patrols' test/tiranaPatrolCustody.test.mjs` fails on both this branch and an unchanged detached checkout of the base commit. The canopy arrays differ: `5150 !== 4756` at line 46. This change does not modify the canopy registry or its test. The other five custody tests passed in the initial regression run.

## Browser limitation

Local Chromium failed to launch with `socket() failed: Operation not permitted`. The separate browser could not reach the local Vite server (`ERR_CONNECTION_REFUSED`). No screenshot, visual approval, or mobile FPS result is claimed. The portrait review entry is provided for testing in a reachable browser.

## Render

No deployment was attempted. The connector had no selected workspace; workspace selection remained unanswered. Production was not changed.
