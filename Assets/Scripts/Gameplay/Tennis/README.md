# Tennis gameplay upgrade notes

This folder adds modular tennis systems:

- `TennisShotTuning`: boosts shot power and supports flat/power/topspin/curve variants.
- `TennisCourtScaler`: scales court + characters and moves camera back to keep similar framing.
- `TennisAudioController`: trigger shot and bounce SFX.
- `TennisAIOpponent`: faster AI reaction and mixed shot variants.
- `CharacterWalk8Dir`: 8-direction walk movement (forward/backward/sideways).
- `TennisReplayController`: rolling gameplay capture + TV-style replay for fouls/decisive points, with skip button support in menu and replay overlay icon.

## Replay setup

1. Add `TennisReplayController` on the tennis scene root.
2. Assign `playerRoot`, `opponentRoot`, `ballRoot`, `netRoot`.
3. Assign `replayMenuSkipButton` and `replayOverlaySkipButton`.
4. Call `RequestReplayOnFoul()` or `RequestReplayOnDecisivePoint()` from scoring/foul system.

## Free/open-source sound effect sources

1. Kenney assets (CC0): https://kenney.nl/assets
2. Sonniss GDC free packs: https://sonniss.com/gameaudiogdc

Import chosen WAV/OGG files into Unity and assign them to `shotClip` and `ballBounceClip`.
