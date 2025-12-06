# Tennis Battle Royal – Design & Gameplay Logic (Mobile Portrait)

## Vision & Core Loop
- **Objective**: Last player/duo standing in a shrinking tennis arena; rally survival plus knockout scoring.
- **Loop**: Quick matchmaking → onboarding prompt (2-ball rally + serve tutorial) → battle rounds (serve → rally → elimination on faults/zone shrink) → reward chest/XP.
- **Session length**: 3–6 minutes; increasing tempo via smaller playable zone and faster ball speed caps.

## Court & Ball Tuning
- **Court scale**: Use 70–80% of a standard singles court footprint to shorten rally time; keep net height official (0.914m center).
- **Shrinking zone**: Out-of-bounds ring moves inward between rounds; ball landing outside ring = fault/elimination.
- **Ball physics (portrait-friendly)**
  - Gravity: 9.81 m/s² baseline; reduce to ~8.5 m/s² if rallies feel too short.
  - Bounce restitution: 0.75–0.82 (reduce on clay-like surfaces to 0.70–0.76).
  - Air drag: Cd ~0.45; increase drag by +0.05 when wind is active.
  - Spin influence: Lift coefficient up to 0.2 for topspin; skid coefficient 0.1–0.15 for slices.
  - **Force presets** (map your engine’s swing animations):
    - Serve power: 55–70% of max impulse for safe serves; up to 90% for power serves once user nails timing window.
    - Forehand/backhand drive: 45–65% impulse; add topspin torque for arc height control.
    - Volley: 35–50% impulse; lower launch angle (5–12°) to keep ball low over the net.
  - Clamp ball linear speed to prevent unfair rallies: soft cap 55–60 m/s; hard cap 65 m/s with small decay per frame after crossing the soft cap.

## Controls & Input (Portrait)
- **Tap/hold serve meter**: Upwards swipe to toss; press/hold to build serve power; release in timing window for accuracy.
- **Swipe direction**: Left/right swipes set lateral aim; upward swipe for deeper shots (higher arc), downward for drop/slice.
- **Context buttons**: Auto-surface-aware actions (topspin, slice, lob) surfaced as 2–3 large buttons near right thumb; vibration + color flash on perfect timing.
- **Accessibility**: Adjustable button size; aim assist toggle; haptic cues for timing windows.

## Official Tennis Rules (Applied)
- **Scoring base**: 15–30–40–game; tie-break to 7 (win by 2) at 6–6. In battle royal, accumulate “lives”/faults rather than full sets to keep sessions short.
- **Faults**: Serve lands outside current valid zone or hits net and lands out → fault; two consecutive faults = point loss/life loss.
- **Lets**: Serve touches net and lands in-bounds → let, redo serve without penalty.
- **In/Out**: Ball is out if any part lands fully outside the shrinking valid ring; use line detection with small inward tolerance (1–2 cm) for fairness.
- **Rally rules**: One bounce max; volley allowed except on second-serve return if you want stricter realism toggle.
- **Foot faults**: Server’s lead foot crosses baseline before contact → fault (detected via pose/foot trigger volume).

## Battle Royal Layer
- **Players**: 8–16 entrants; rotate mini-rallies in parallel courts or split halves of a dynamic court.
- **Elimination**: Each player has 3 lives; lose one on point loss. Last 4 players move to semifinal court; last 2 to final.
- **Zone shrink**: After each round or every 60s, playable zone contracts; serve boxes and baselines move inward proportionally. Update line colliders and UI rings.
- **Power-ups (optional)**: Short buffs (5–8s) like Spin Boost, Speed Clamp Breaker (+10% cap), or Perfect-Timing Window (+30ms leniency).

## AI Logic
- **State machine**: Serve → Recover → Anticipate → Swing → Recover.
- **Serve decision**: Choose wide/body/T depending on opponent position bias; mix spin types every 3–4 serves.
- **Shot selection**: Evaluate ball height + lateral offset; if near net, prioritize volley; if deep and wide, pick lob/defensive slice.
- **Positioning**: Maintain ready stance slightly behind shrinking baseline; adjust depth after each shot based on predicted bounce point.
- **Error modeling**: Add timing variance based on difficulty to avoid robotic play.

## Networking (Authoritative Server Recommended)
- **Authoritative physics** with client-side prediction for ball; reconcile on server tick (e.g., 60 Hz).
- **Input packets**: Desired shot type, aim vector, timing stamp; server applies swing/ball impulse and broadcasts delta states.
- **Anti-cheat**: Validate serve timing windows and impulse caps server-side; reject over-cap inputs.

## Camera & UX (Portrait)
- **Default camera**: Slightly elevated behind-player offset; keep ball, player, and opposite court visible. Auto-tilt upward on high lobs.
- **Alerts**: Flash shrinking-zone ring; haptics on faults/lets; subtle trail on high-speed balls.
- **Onboarding**: 30-second guided serve + rally with ghost opponent; show visual aim arrow and timing bar.

## Data & Balancing Hooks
- Track rally length, serve accuracy %, unforced errors, power-up win rate, and disconnects per session for tuning.
- Provide live configuration (JSON/ScriptableObject) to tweak impulse multipliers, restitution, drag, and zone-shrink rate without code changes.

## Implementation Notes (Engine-Agnostic)
- Use a fixed timestep for ball physics; decouple render framerate.
- Collision layers: ball vs. net (thin capsule + trigger), court (box or mesh collider), boundaries for shrinking ring.
- Object pooling for balls and VFX trails to avoid allocations.
- Unit tests: serve fault detection, let logic, in/out detection, and cap clamping on ball speed.
