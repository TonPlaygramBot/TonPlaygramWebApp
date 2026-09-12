# Racing Royal: Future Series

Original Blender artwork for Photon GT (twin ion channels), Vortex R (split vector fins), Aegis XR (protected endurance chassis), and the shared seated driver. No third-party vehicle or character mesh is used.

Each kart has four rotating wheels, two steering pivots, a steering wheel, an active aero surface, emissive energy accents, and a separate brake-light material. The articulated human driver wears a full-face helmet, visor, racing suit, gloves, boots, and five-point harness. Runtime arm IK keeps the hands on the wheel; the right boot follows gas and the left boot follows the brake.

Regenerate the editable `.blend` files and production GLBs from the repository root:

```sh
blender -b --python tools/blender/future_karts.py
```

Blender 4.5.3 LTS was used. Coordinates in the generator are metres, Y up, +Z forward; it converts to Blender coordinates before export. Runtime assets and per-model triangle/byte counts are in `webapp/public/assets/kart-royale/karts/future-manifest.json`. Opponents use the lower-detail models.

The portable handling preview can be regenerated with `node tools/previews/build-racing-manual-preview.mjs /workspace/racing-manual-karts.html`. It embeds the real kart/driver models, physics, controls, and Blloku course, with reduced nearby city rendering. The full game continues to instantiate `TiranaCityScene` and its existing buildings, landmarks, and materials.
