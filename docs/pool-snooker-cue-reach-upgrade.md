# Pool Royal and Snooker Royal cue-reach upgrade

## What changed

- Pool Royal and Snooker Royal now share the same two-player Ready Player Me character system.
- Long-reach shots automatically equip the active player with a telescopic butt extension and a four-prong mechanical rest.
- The support hand changes from an open bridge to a raised grip on the rest handle, while the rear hand moves onto the extension.
- The ordinary left-hand bridge is solved from the rendered cue axis, then constrained to the cloth, so the wrist and fingers support the shaft instead of floating beside it.
- Snooker Royal now starts ball physics only when the visible leather tip reaches the cue-ball contact point. The cue completes a short follow-through after impact.
- Pool variants retain the white head string and penalty spot while hiding snooker-only markings.

## Reach selection

The equipment decision uses table geometry rather than camera angle. A ray is projected behind the shot direction to the first table edge. If that distance exceeds the normal standing reach plus a small activation margin, the extension/rest appears. The equipment stays hidden for the non-active player, idle poses, replays, and the cue gallery.

## Asset provenance

The extension and mechanical rest are original procedural Three.js meshes created for TonPlaygramWebApp. They use generated cylinder/sphere geometry and PBR carbon, brass, rubber, and ash materials, so there are no third-party model files or new asset-license obligations.

The implementation followed a source audit that found a CC0 cue-stick model but no verified, game-ready CC0 mechanical-rest/extension bundle. The external models were not copied or included:

- CC0 cue stick: <https://sketchfab.com/3d-models/cc0-cue-stick-311d2a1ac8d64037b6b9f8561d6d13ed>
- Printable cue extension reference: <https://www.printables.com/model/102676-billard-cue-extension/files>
- CC0 legal text: <https://creativecommons.org/publicdomain/zero/1.0/legalcode.en>

## Validation focus

- Short and long reach selection.
- Extension/rest visibility and normalized pose directions.
- Pool penalty spot/head-string visibility.
- Snooker contact ordering: render contact, apply impact once, then permit shot-resolution logic.
- Existing Pool Royal pose, bridge clearance, cue contact, online, rules, and production build suites.
