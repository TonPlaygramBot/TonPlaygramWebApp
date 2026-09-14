# Snooker Royal player perspective

September 14, 2026.

The September 10 eye-camera change (`b83fe7a905ed495c280be939ffeae78e12172614`)
introduced the animated player-eye handoff used on September 11. That shared
handoff stopped owning the camera 600–900 ms after the stroke. Snooker's action
and pocket cameras then tracked the balls, and a separate two-second timer
forced overhead. The prior September 11 camera fixture therefore preserved the
reported behavior instead of correcting it. The September 7 file also contained
the underlying action/pocket camera branches; this is not a whole-file rollback.

Snooker now uses its own shot-camera owner. It retains the established animated
player view while addressing and striking before impact, then keeps both the
pre-impact camera position and its aim target until all balls settle. A moving
or potted cue ball cannot move this view. If the character model is unavailable,
the existing pre-shot view is retained. The two-second automatic overhead switch
is removed. Explicit overhead, replay and cue inspection can still own rendering.
The shooter's head stays hidden while rendering from the held player viewpoint.
Held shots and explicit overhead bypass the legacy tracking-camera branches.
Side-pocket camera inputs are initialized before use, correcting an existing
runtime error that could otherwise stop rendering before the player view applied.

The shared Pool camera, Snooker rules, and the previous 5% character enlargement
are unchanged. Nine unchanged camera helpers remain pinned to the September 11
fixture. Tests exercise the new eye ownership through post-impact movement,
scratches, explicit view changes, missing assets, transformed table sizes, both
players and portrait projection, while preserving the established address pose.
