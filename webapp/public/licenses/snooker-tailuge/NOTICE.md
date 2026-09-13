# Tailuge billiards integration

Source: https://github.com/tailuge/billiards
User-provided billiards-master.zip, archive commit b446544206c6d0d7f32e718649afbb679351e986.
Copyright: tailuge and contributors. License: GPL-3.0; see COPYING.

Physics, table/pocket geometry, outcome analysis, snooker utilities and respot
algorithms are vendored from the supplied archive. Browser-owned meshes, cue,
session, telemetry and unrelated rack variants were removed for a headless
adapter. Ball IDs are supplied by the adapter so multiple frames are isolated.
The surrounding TailugeSnookerRules adapts controller/rules/snooker.ts to the
existing serializable FrameState rather than importing upstream browser states.
Local rule corrections cover pre-shot colour order, no-contact colour strokes,
colour nominations and deciding-black fouls. Table sizing is configured in the
adapter. Original source is available at the pinned GitHub commit above.

The geometric AI adapter additionally derives from upstream aimcalculator.ts
at e6ed0dba43e09177540f176ad7a62b1ef6f64415. See the source ai/NOTICE.md.

Corresponding source for the combined game: https://github.com/TonPlaygramBot/TonPlaygramWebApp
The upstream editable model is dist/models/snooker.blend at the pinned commit.
