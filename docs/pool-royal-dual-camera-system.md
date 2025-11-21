# Pool Royal Dual-Camera Broadcast System

## Goals
- Capture the entire Pool Royal table with two fixed broadcast-quality angles mounted on the short rails.
- Deliver an ultra-realistic, 4K professional sports feed with real-time overlays and smooth angle switching driven by ball action.
- Keep the mounting unobtrusive: slim black metal framing hugging the rails with no intrusion into play.

## Physical Layout
- **Camera placement**: One camera centred on each short rail, lens axes parallel to the long rails. Height aligned just above rail level to frame the full table, pockets, and cue action without moving.
- **Mounting**: Minimalist black anodized aluminum frames bolted to existing rail hardware; vibration-damped feet and cable clips tucked beneath the rail lip. No overhang into the playfield or pockets.
- **Field of view**: Slightly wide (≈24–28mm full-frame equivalent) to cover the full table from each end; lens shift tuned so cushions and pockets remain undistorted.
- **Anti-glare optics**: Multi-coated broadcast lenses with matte hoods and polarizing filters to suppress reflections from balls, rails, and chrome trim.

## Lighting
- **Overhead grid**: Soft, even LED panel array above the table with high CRI (≥95) to preserve ball colours and felt texture. Panels angled to avoid hotspotting on the cue ball.
- **Edge control**: Low-intensity rim lights along long rails to separate balls from the felt without casting harsh shadows.
- **Flicker-free**: Broadcast-safe drivers (≥1 kHz) to prevent banding at high shutter speeds.

## Video & Quality Targets
- 4K UHD capture at 60 fps, 10-bit, Rec.709 broadcast tone mapping.
- Shutter/ISO tuned for crisp motion on breaks; auto-exposure locked per camera after calibration.
- White balance locked to lighting rig; identical colour LUTs applied to both feeds for consistent switching.

## Tracking & Overlay
- **Ball tracking**: On-table detection pipeline (e.g., GPU-accelerated segmentation + centroid tracking) calibrated to the table bounds for both cameras.
- **Action zones**: Virtual quadrants and pocket proximities defined so the switcher knows which end has the dominant action (e.g., break, clusters, pocket battles).
- **Overlays**: Clean lower-third with score, shot clock, and minimal live tracker dots/arrows showing active balls; overlays stay clear of pockets and projected aim lines.

## Switching Logic
1. **Default state**: Follow the camera aligned with the active player’s target quadrant or the cue ball’s half of the table.
2. **Breaks**: Auto-prioritize the head-end camera for the opening break; hold for 1–2 seconds post-impact to capture spread.
3. **Pocket proximity**: If a tracked ball is within a defined pocket radius on the far end, crossfade to that end before impact.
4. **Safety window**: Minimum dwell time (e.g., 3 seconds) before another switch to avoid rapid cuts; overrides allowed on high-velocity cue ball transfers.
5. **Continuity**: Maintain shot-reverse-shot rhythm—never cut mid-stroke; only switch pre-stroke, post-impact, or during player walk-around.

## Transitions
- 10–15 frame crossfades for routine cuts; faster 5–7 frame dissolves for urgent pocket captures.
- Audio remains continuous; optional subtle whoosh suppressed to preserve broadcast polish.
- Match exposure, colour, and white point between angles to make transitions invisible.

## Calibration & Maintenance
- Per-camera calibration grid aligned to cushion edges for tracking scale and lens distortion correction.
- Weekly verification of rail mounts, vibration dampers, and lens cleanliness (especially polarizers).
- Store presets: focus distance fixed to table centreline; recallable LUTs, white balance, and shutter/ISO per venue.

## Safety & Redundancy
- Dual redundant power and SDI/HDMI feeds per camera; cable runs taped to rail underside with strain relief.
- Over-temperature alerts for LED panels and camera bodies; automatic brightness rollback on thermal thresholds.

This configuration keeps both Pool Royal angles locked, glare-free, and ready for fast, confident switching that mirrors professional sports broadcasts.
