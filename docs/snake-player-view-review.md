# Snake & Ladder player-view and retired-game review

## Changes

Royal Lanes Bowling and Backgammon Royal are removed from gameplay, routes, catalogs, stores, online policies, previews, exclusive assets, and download packs. Unknown game URLs return to the Games catalog; generic obsolete lobby links already redirect there. The historical BowlingMatch schema and its refund recovery service remain intentionally: the server cannot create bowling matches, but expired reservations must still be refundable.

Snake & Ladder now uses the same 78-degree field of view and head-to-eye offsets as Ludo Battle Royal, through `seatedPlayerView.ts`. The camera tracks visual seat zero (the local player's seat), hides only that player's head in 3D, and looks at dice/token actions without changing seat or zoom. Upward phone drags look upward, and rightward drags look rightward. Dragging no longer moves the camera toward the table.

Other fixes: cancelled/multi-touch gestures cannot roll dice; two-finger gestures do not rotate the player view; 2D mode survives appearance changes; WebGL launch/context failures provide a scene-only retry; pending moves and capture presentation restart after a scene rebuild; late HDR resources are disposed after unmount; hidden-tab catch-up work is bounded.

## Review page

`/snake-player-review.html?ai=1` mounts the actual React game and Three.js scene, including its original human asset and controls. It is included in the Vite production inputs. This is not a separate mock game.

Check at 390 × 844 and 320 × 740: roll and wait for an opponent; look up/down and left/right; toggle 2D and back; change appearance in 2D; rotate the phone; cancel a touch or pinch without accidentally rolling; restore a lost WebGL context. The eye must remain at the local seat when an opponent acts.

## Validation

- Snake Vitest suite: 100 passing cases, including real GLB head placement at portrait and landscape ratios, original dice/hand/weapon regressions, local/online presentation, and WebGL launch retry.
- Node game/removal suite: 16 passing cases.
- Ludo gameplay/rules/dice: 25 passing cases.
- Cross-game inventory: 15 passing cases.
- Original-asset downloader: 19 passing cases.
- Root TypeScript build and production Vite build passed. Existing large-bundle warnings remain.
- Repository-wide ESLint is not clean: the existing configuration scans generated output and reports widespread style/parser violations outside this change. Changed files were parsed successfully and `git diff --check` passes.
- Navigation suite: 69 pass; one unchanged TiranaLoading test expects old copy ('taking longer than usual') while the component says 'Still loading Tirana Streets'.
- End-to-end backend tests could not start: this environment's native `canvas` binding is unavailable; rebuilding it fails because `pixman-1` development files are missing. No live multiplayer verification is claimed.
- Browser visual QA could not be completed: local Chromium cannot start its process socket, and the connected browser cannot access the local development server. The browser policy also blocks local-file previews. Camera geometry tests are not a substitute for a rendered phone check.
