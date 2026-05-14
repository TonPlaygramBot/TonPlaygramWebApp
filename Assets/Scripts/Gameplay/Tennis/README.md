# Tennis gameplay upgrade notes

This folder adds modular tennis systems:

- `TennisShotTuning`: keeps shots at a calmer match-power pace and supports flat/power/topspin/curve variants.
- `TennisCourtScaler`: scales court + characters and moves camera back to keep similar framing.
- `TennisAudioController`: trigger shot and bounce SFX.
- `TennisAIOpponent`: professional positioning AI that predicts the first bounce, moves either behind the landing point for a groundstroke or steps inside the bounce for a volley/intervention, faces the incoming ball, recovers to a ready position, and only releases a shot when the ball is reachable and at a hittable height.
- `CharacterWalk8Dir`: camera-relative 8-direction movement with optional incoming-ball facing and a shared soldier-style procedural leg cycle so every tennis character can use identical leg timing.
- `TennisPlayerCameraRig`: camera/player follow rig that trucks with the player, pulls slightly back under incoming-ball pressure, and blends the look target from the player to the predicted incoming ball.
- `TennisRacketSwingAnimator`: additive shoulder-to-racket swing overlay for both shot and serve motions, with a clear pull-back, forward strike, wrist snap, and recovery.

## Professional tennis logic reference

Implementation is based on coaching/gameplay principles gathered during the upgrade:

1. Split-step / ready-position logic: players should be ready before the opponent contact and recover after their own shot.
2. Contact positioning: move diagonally in/out, use small adjustment steps, and choose depth so contact happens at an optimal point rather than exactly on the bounce.
3. Groundstroke vs volley decision: if the player can reach the ball before the first bounce, step in; otherwise get slightly behind the predicted landing point to hit after the bounce.
4. Ball-facing camera/player logic: incoming-ball tracking should bias the view and character facing toward the ball without losing the player as the main follow target.

Sources consulted: Tennis Nation footwork guide, Sportplan movement/split-step notes, CoachUp split-step explanation, and third-person camera design notes.

## Scene wiring checklist

- Add `TennisPlayerCameraRig` to the camera rig and assign the human player transform + tennis ball rigidbody.
- Assign the ball transform to each `CharacterWalk8Dir.incomingBall` and enable `faceIncomingBall` for the human player.
- For identical walking on all human characters, assign the same humanoid leg bones (`proceduralHipRoot`, upper legs, lower legs, feet) and keep the same stride/swing values. The procedural walk runs after the animator, so it can standardize different GLTF characters to the soldier-style gait.
- Add `TennisRacketSwingAnimator` to each tennis character and assign shoulder/upper-arm/forearm/hand-or-racket bones. Call `PlayShotSwing()` on shots and `PlayServeSwing()` on serves.
- For AI characters, assign `TennisAIOpponent.characterController`, `homePosition`, `hitTarget`, `ballBody`, `shotTuning`, and optionally `swingAnimator`.

## Free/open-source sound effect sources

1. Kenney assets (CC0): https://kenney.nl/assets
2. Sonniss GDC free packs: https://sonniss.com/gameaudiogdc

Import chosen WAV/OGG files into Unity and assign them to `shotClip` and `ballBounceClip`.


## Replay flow (TV-style VAR)

- Add `TennisReplayDirector` in the tennis scene and connect `ReplayBroadcastGate`.
- Call `OnDecisivePoint(...)` for match-point / winner moments and `OnFoul(...)` for fouls.
- Wire `menuSkipReplayButton` (menu-level skip) and `replaySkipIconButton` (overlay skip icon).
- Optional: assign `replayOverlay` CanvasGroup to show replay UI while active.
