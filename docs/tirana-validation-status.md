# Tirana regional validation — 8 September 2026

Follow-up to PR #25776, source baseline `0101361201624cb414934c6e9415ec2d8f53356d`.
**Not all release checks have passed. Keep the PR draft.** No merge, deployment, branch-protection change, balance mutation or paid-multiplayer change is part of this follow-up.

## Executed locally

A source subset was read from the GitHub connector and reconstructed locally. Seven baseline source/test Git blob identities were compared byte-for-byte with the GitHub responses. This was not a full repository checkout.

- Original two regional suites: **22 passed, 0 failed, 0 skipped** on Node 22.16.0.
- First 14 additional regression cases against the original source: **2 passed, 12 failed**. The failing cases exposed unstable equidistant facade selection, mutable spatial-index data, invalid cell-size acceptance, malformed provenance URLs, overflow dimensions, repeated/self-crossing polygon rings, and crossing/touching/overlapping/nested water holes.
- After fixing the implementation and adding four further boundary cases: **40 passed, 0 failed, 0 skipped** across `tiranaRegionalDetails`, `tiranaRegionSource`, and `tiranaRegionalValidation`. The original 22 tests remain unchanged.
- Actual delivered four glTF assets were independently parsed with Python trimesh; each has 650 non-degenerate triangles and six material groups. Embedded PNGs decode with Pillow at 2048 x 512. This is asset validation, not game rendering.
- The Blender script passes `python -m py_compile` only. The new browser driver passes `node --check` only. Workflow YAML parses; the final gate was exercised locally with success/failure/skipped/cancelled inputs and rejects every non-success outcome.

## Implementation fixes

Facade selection now resolves equal-distance candidates independently of footprint winding or starting vertex. The spatial index snapshots and freezes coordinates, rejects invalid cell sizes, and uses occupied bins for extremely large queries instead of an unbounded empty-cell loop.

The OSM review importer validates HTTPS provenance URLs and finite dimensions. It rejects repeated vertices, degenerate/self-crossing rings, island boundaries outside or touching the owning shoreline, overlapping islands and ambiguous nested holes. A concave shoreline case verifies edges as well as vertices. No source vertex is moved, repaired or invented; `runtimeReady` remains false.

## Expanded CI, not evidence of a completed CI run

The workflow now defines the existing city/FPS/career/racing Node regressions, a full webapp production build, the existing project's dependency-aware `tsc --noEmit` check, actual glTF export checks, a three-viewport portrait **asset-viewer** browser check, and actual Blender execution/render-output checks. A final gate rejects failed, skipped or cancelled dependencies; no `continue-on-error` or type-error suppressions were added.

The build/typecheck jobs install the existing webapp lockfile normally. Only the root installation used for the browser driver disables unrelated lifecycle scripts. The Blender command includes `--python-exit-code 1`, so a Python exception is not mistaken for success. The original map/Dajti Git-blob preservation assertions remain intact.

The asset-viewer check is deliberately labelled: it is NOT either running game and is NOT a physical-phone GPU/FPS/memory test. Software WebGL and viewport dimensions cannot establish those results. Adding jobs does not make branch protection require them; no repository rules were changed.

## Still blocked or not verified in this session

- The container cannot resolve GitHub/npm/Blender download hosts, and the React/Three/Vite dependency tree is not installed or available in the local npm cache. **The full app build and dependency-aware typecheck were not executed.**
- The full repository's pre-existing city/FPS/career/racing suites were not executed locally; the 40 passing tests above are the explicitly named source-subset suites.
- The agent-browser CLI is unavailable. A Python Playwright/Chromium attempt to open the previously delivered preview at 390 x 844 was rejected by browser policy (`net::ERR_BLOCKED_BY_ADMINISTRATOR` for the local file URL). No browser policy was changed and no successful WebGL rendering is claimed.
- Blender is not installed; no `.blend` or Blender render was generated locally.
- Successful remote CI, actual-game interactions, physical-phone performance and surveyed regional geographic precision remain unconfirmed. The atlas is still not a continuous playable outer-ring/Dajti expansion.

## Reproduce the focused suite

```sh
node --test test/tiranaRegionalDetails.test.mjs test/tiranaRegionSource.test.mjs test/tiranaRegionalValidation.test.mjs
```

Use the workflow for the full-check attempt in a network-enabled runner. Actual-game QA and a documented physical-device run remain separate release gates even after that workflow is green.
