# 3D Billiards Mode Specifications

These notes capture the shared expectations for the upcoming 3D billiards experiences so every build of the table (mobile portrait first) stays aligned. The same baseline applies whether we ship Pool Royal, UK 8 Ball, 9 Ball, or American Billiards.

## Shared 3D Table Requirements

- **Camera & Controls** – Reuse the mobile-first three.js mappings defined in `mobile-3d-controls-prompt.md`. Players must be able to orbit, zoom, and line up shots comfortably while the device is held in portrait orientation.
- **Physics Scale** – Keep cushions, pockets, and ball radii in real-world proportions so mode switching does not require reauthoring cues or aiming aids. Balls share the same rigid body settings across every variant.
- **Lighting** – Neutral three-point lighting with subtle rim highlights keeps all coloured balls readable, especially in portrait mode. Tone mapping should avoid clipping the cue ball or pink/blue balls.
- **HUD Layout** – Score rails cling to the top/bottom edges of the portrait viewport. Toggle the rule card for the active mode on demand so newcomers can read the frame objective without leaving the table.

## Chalk Placement Rule

Exactly **four** chalk blocks are visible at all times—one centred on each wooden rail of the table. The chalk meshes should sit near (but not overlapping) the pocket leather so that when a pocket is in frame the nearby chalk remains readable. Highlight the closest chalk when the cue tip is recharged so players always know which block was used.

## Mode Snapshots

### Pool Royal (Arcade)
- Same table geometry as American Billiards but with neon accent lighting.
- Power-up spawn pads appear on the long rails; reuse the chalk placement rule so props do not collide.
- Rail melamine is split into **six** surface pieces in total, each one kissing the chrome fascia with no visible gaps; the grain/pattern lines must run the full length of the rails so every strip reads as a continuous long-direction plank.
- Match the skirt underlay: melamine and wooden rails must share the same grain direction, pattern scale, and plank widths as the skirts beneath them so the table reads as one uniform shell and stops cleanly above the legs.
- Pocket jaws and rims must match the chrome plate cutouts **100%**—never size them from the wooden rail arches.

### 3D UK 8 Ball
- 7 ft pub-style table with rounded corners and smaller pockets.
- Use red/yellow object balls plus the black. Update ball material presets accordingly.

### 3D 9 Ball
- Diamond rack on a 9 ft table. Balls numbered 1–9 plus cue ball.
- Include the call-shot overlay highlighting the lowest-numbered target ball.

### American Billiards (8 Ball)
- 9 ft table, solids vs. stripes set.
- Break camera mirrors the 9 Ball intro but focuses on the triangle.

## Asset Checklist

- ✅ Mode-specific ball textures (UK red/yellow, stripes/solids, numbered 1–9).
- ✅ Reusable wooden rail prefab with mounting points for chalk and optional power-up pads.
- ✅ Pocket proximity triggers so chalk visibility can be boosted when the camera frames a hole.
- ✅ Rule-card UI snippets for each mode.
- ✅ QA pass ensuring the chalk objects never clip through cue animations or player avatars.

These guidelines ensure every 3D billiards variant feels consistent while still highlighting the differences players expect between Pool Royal, UK 8 Ball, 9 Ball, and American Billiards.
