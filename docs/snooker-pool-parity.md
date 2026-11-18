# Snooker Royal / Pool Royal control parity

Implemented against main `ec162995`, then rebased onto `e40336662a54c877e551d676adc445bc91627e36` in a separate worktree, with no Racing changes.

## Changes

- Snooker spin helpers re-export Pool's implementation: continuous proportional input, identical bounds, screen direction and no deadzone or extra response curve.
- Snooker uses Pool's pointer controller flow, spring, release/cancel behavior, busy-shot guard and camera-independent selection. Cue tip offsets use the same safe radius ratio.
- The actual strike initializes the same linear/angular momentum. Cloth slip, follow/draw, cushions and stopping use Pool's adapters and constants. Obsolete first-contact spin suppression and artificial spin-driven lift are removed. Angular state is cleared at explicit replay/placement/pocket/timeout resets.
- Broadcast switching uses Pool's 70 ms debounce, zoom profiles, predicted corner-pocket qualification, cushion cut activation/suppression, and contact-to-broadcast transition.
- Snooker dimensions, ball radius, shot power calibration, scoring, foul/referee, colour sequence, respot and D placement remain Snooker-specific. Remote-player camera ownership and Snooker's fallback player eye are retained.

## Verification

- 53 Node tests passed across `snookerSpinParity`, `snookerSpinPhysicsParity`, `snookerControls`, `snookerBroadcastParity`, `snookerPlayerShotCamera`, `snookerCharacterCamera`, `snookerShotAnchor`, `snookerRefereeIntegration`, and `royalPlayerCameraFraming`.
- 90 Jest tests passed after rebase across `snookerLiveStrike`, `snookerShotRelease`, `snookerRefereeRules`, `snookerReferenceRules`, `snookerRespot`, and `snookerDecidingBlack`.
- Tests execute extracted live JSX controller/physics/camera adapters, including repeated gestures, pointer cancel, shot locking, draw/follow after impact, stop detection, corner/rail spin and portrait framing. These are not visual game-play tests.
- Existing unmodified Pool spin suite has one failing actual-shot fixture: `humanShotCamera is not defined`. Its other tests passed in the combined initial run. Neither Pool's game source nor this fixture was changed here.
- `git diff --check` passed. Repository ESLint ignores JSX in this area; this is not a complete lint pass.
- Standard webapp build was attempted. Original asset/vehicle verification and decoder preparation passed, but the external-asset prebuild scans 879 groups and may download up to 10 GiB. It was stopped at that unrelated vendor stage; production build completion is unverified.

No claim of visually identical gameplay or physical-device performance is made without browser/device review. Browser QA could not reach the local Vite server from the cloud browser (connection refused); local Chromium was blocked by its socket policy. Publishing this branch and a draft PR is authorized separately; merging/deployment are not.
