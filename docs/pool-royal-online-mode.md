# Pool Royal – online mode realtime sync and replays

Goal: opponent must see every cue stick and camera movement at game-frame fidelity and replays must match gameplay FPS without visual quality loss.

## Core principles
- **Authoritative server** controls physics and final state; clients are visual/UX only.
- **Deterministic physics** (fixed timestep, shared RNG seeds, consistent floating point paths) to replay inputs identically.
- **Tick-based netcode**: simulate on a fixed tick (e.g., 60 Hz). Clients render at display FPS while interpolating between server ticks.
- **Input-first replication**: send player intents (cue pose, stroke power, strike command) instead of raw transforms; server re-simulates and broadcasts state deltas.
- **Timestamps + clocksync**: run NTP-style client/server clock sync to align tick times and avoid drift.

## Live view of cue stick, cueball, camera & aim line
- **State bundle per tick**: server broadcasts compact binary packets containing:
  - Tick ID and server time.
  - Cue ball position/velocity/spin.
  - Cue stick pose (position + orientation), current stroke charge, and contact offset.
  - Aiming line (origin, direction, collision preview points) derived from server physics query.
  - Active camera rig pose for the shooter; opponent uses these to mirror the exact view for spectating.
- **Reliable + unreliable mix**:
  - Use WebSocket with per-message acks or UDP/ENet channels; mark critical events (stroke start, strike, foul) as reliable.
  - High-rate pose updates (cue stick/camera) sent unreliably with sequence numbers; client interpolates missing frames.
- **Client-side prediction**:
  - Predict cue stick pose locally while charging/aiming for responsiveness.
  - When a strike is issued, send input (contact offset, force, spin). Server simulates and broadcasts authoritative ball motion. Clients reconcile ball states using snap-threshold + interpolation to hide corrections.
- **Interpolation & smoothing**:
  - Maintain a small buffer (100–150 ms) of server snapshots; render by interpolating between two nearest snapshots.
  - On packet loss, temporarily extrapolate for ≤2 ticks; after that, ease toward the next authoritative snapshot to avoid popping.
- **Camera sync for opponent**:
  - Opponent uses the shooter’s server-driven camera pose to render the aiming phase. When control switches, swap to the new shooter’s camera feed.
  - For portrait users, keep UI anchors responsive and avoid screen-space flips; server sends only world poses, while client maps them to the current aspect.

## Replay fidelity (same FPS as game)
- **Record inputs + seeds**: log tick-stamped player inputs, random seeds, and break outcomes; avoid storing full frames.
- **Deterministic playback**: re-run the fixed-timestep simulation using the recorded inputs to regenerate ball/cue/camera states.
- **Frame pacing**:
  - Replay renderer runs at the original game FPS target; cap to the user’s display but never drop below the recorded tick spacing.
  - If the device can’t sustain render FPS, decouple render from sim (simulate at source tick rate; render interpolated frames) and warn the UI.
- **Quality retention**: store high-level events (balls pocketed, fouls, timer) for metadata overlays; avoid recompression of textures/audio during export.

## Data formats & compression
- Prefer **MessagePack** or a custom binary schema; include sequence numbers, tick IDs, and CRC for integrity.
- Delta-compress snapshots against the previous acknowledged tick; quantize floats (e.g., millimeter precision) to shrink bandwidth without visible loss.

## Error handling & resync
- Heartbeat + round-trip measurement; if RTT spikes, expand interpolation buffer slightly.
- On desync detection (CRC mismatch, divergent ball count), request a full-state refresh from the server and re-seed the replay log.
- Support pause/resume by persisting the latest snapshot and input log; upon resume, fast-forward the sim to the current tick.

## Testing checklist
- **Latency simulation**: test at 50/100/200 ms RTT with 2–5% packet loss; verify cue stick and aiming line remain smooth to the opponent.
- **Replay consistency**: run deterministic replays on CI comparing end-state hashes (ball positions, scores) against authoritative logs.
- **Frame pacing**: validate that replay renders maintain target FPS under device throttling by monitoring frame time histograms.
- **Spectator view**: ensure opponent camera tracks shooter’s aiming camera with no divergence when possession changes.
