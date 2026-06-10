# Tennis gameplay upgrade notes

This folder adds modular tennis systems:

- `TennisShotTuning`: keeps shots at a calmer match-power pace and supports flat/power/topspin/curve variants.
- `TennisCourtScaler`: scales the court/net larger than the players and moves the camera back to keep the bigger court framed.
- `TennisAudioController`: trigger shot and bounce SFX.
- `TennisAIOpponent`: faster AI reaction, mixed shot variants, and capped match-power shot selection.
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
