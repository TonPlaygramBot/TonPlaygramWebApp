# Tennis gameplay upgrade notes

This folder adds modular tennis systems:

- `TennisShotTuning`: keeps shots at match-power pace, adds contact-quality power/spin, and supports flat/power/topspin/curve variants.
- `TennisCourtScaler`: expands the court independently across width, length, and height, raises the net, and moves the camera back to keep the bigger court framed.
- `TennisBallContactPhysics`: softens collisions against humans, nets, and soft obstacles so the ball loses power but keeps bouncing with gradual drag loss.
- `TennisRacketHitDetector`: only fires a shot when the ball physically touches the racket face/sweet spot; missed swings leave the ball on its existing path.
- `TennisAudioController`: trigger shot and bounce SFX.
- `TennisAIOpponent`: faster AI reaction, mixed shot variants, capped match-power shot selection, and precise racket-range contact checks.
- `CharacterWalk8Dir`: 8-direction walk movement (forward/backward/sideways).

## Free/open-source sound effect sources

1. Kenney assets (CC0): https://kenney.nl/assets
2. Sonniss GDC free packs: https://sonniss.com/gameaudiogdc

Import chosen WAV/OGG files into Unity and assign them to `shotClip` and `ballBounceClip`.


## Replay flow (TV-style VAR)

- Add `TennisReplayDirector` in the tennis scene and connect `ReplayBroadcastGate`.
- Call `OnDecisivePoint(...)` for match-point / winner moments and `OnFoul(...)` for fouls.
- Wire `menuSkipReplayButton` (menu-level skip) and `replaySkipIconButton` (overlay skip icon).
- Optional: assign `replayOverlay` CanvasGroup to show replay UI while active.


## Tennis realism setup

- Add `TennisBallContactPhysics` to the tennis ball Rigidbody. Tag the net as `Net`; tag player/opponent body colliders as `Player` / `Opponent` or name them with `human` / `player` for automatic soft-contact damping.
- Add `TennisRacketHitDetector` to player racket face colliders. Assign `shotTuning`, `ballBody`, `racketFaceCollider`, and an optional `aimTarget`. Set the racket collider as trigger or keep it as a normal collision collider; both paths require physical contact before a shot is applied.
- Assign `racketContactPoint` on `TennisAIOpponent` to the AI racket sweet spot so AI shots happen only when the ball reaches the racket radius.
