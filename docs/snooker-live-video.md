# Snooker Royal live avatar calls

Snooker now uses Pool Royal's existing call implementation and avatar controls:

- Tap either player's photo or Start video call in a valid online match.
- Voice-only calls, independent camera/mic toggles, opponent audio and hangup use the shared WebRTC lifecycle.
- The photo-sized video replaces each avatar without hiding scores or changing gameplay.
- AI/career practice offers a local camera-only preview, never joins a call room and never captures microphone audio.
- Online calls require a nonblank tableId. Snooker rooms remain separate from Pool rooms.
- Match changes and leaving the game stop tracks; stale permission results are disposed. No automatic media capture.
- Settings, chat, gifts, rules and results hide the controls. Replay/HUD replacement preserves ongoing opponent audio and restores video when avatars return.

## Verification

- 85 shared video tests pass, including the real SnookerMatchHud, Pool and Checkers regression cases. Media and WebRTC are mocked; tests cover activation from both photos, voice/video, permissions errors, duplicate starts, cancellation, reconnect, peer negotiation, one remote audio source, toggles, hangup, route changes and cleanup.
- Six Snooker HUD navigation tests pass.
- 23 Snooker module startup/spin/broadcast regression tests pass.
- All changed JSX/TSX files pass esbuild transforms; diff whitespace checks pass.
- Full project typecheck still fails with the same diagnostics as the hotfix checkout (only the shifted HUD import line differs); no new diagnostics. Full production build was not run.

No real two-device call or native camera/microphone permission test performed. Local preview cannot be reached by the cloud browser; its WebGL support is disabled. No publication or deployment performed.
