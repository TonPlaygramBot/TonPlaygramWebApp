# Game voice/video controls (draft, not deployment ready)

## Changes
- Replace shared game quick-chat launch slots with explicit Voice and Video buttons. Existing avatar opt-in remains.
- Pool retains its existing voice/video controls; its separate text-chat button is removed. Domino and Air Hockey quick actions use shared call controls.
- Voice requests microphone only, keeps avatars visible, renders each remote audio stream once and exposes an end-call action.
- AI/practice/local sessions and URLs without a nonblank match identifier use local preview only, never a shared default room.
- Signals/participant/media/leave/error events must exactly match the current room ID; unscoped and stale events are ignored.
- Blocking overlays/native dialogs release camera and microphone rather than hide the stop controls. Closing a sheet requires a fresh opt-in; switching matches/unmounting also releases media.
- Non-game Social Hub chat, game rules, gift actions and score logic are untouched.

## Coverage and limitations
Shared actions apply to existing wrapped games including Ludo, Murlan, Snooker, Chess, Checkers, Four in Row, Texas Hold'em, Snake, Air Hockey and Domino. This does not add matchmaking or calls to Racing or Tennis, which do not use this shared overlay. Unused legacy static game templates have not been redesigned.

**Deployment gate:** the existing server `liveChat:join` authenticates friend calls but does not verify signed game-match membership for `live-*` room IDs. Exact client room filtering and non-default URLs do not fix guessed-room access. Add server-side membership authorization and adversarial tests before expanding this UI in production; do not describe game calls as private/secure.

No camera or microphone starts automatically. Users must click their avatar or Voice/Video. Preview is local, not a call to AI. Media/browser permissions remain under browser/OS control.

Two-device Telegram/WebView testing (permission denied, reconnect, mute, end, navigation, all affected game layouts) and actual TURN/NAT checks remain required. Unit tests use mocked media/socket/RTCPeerConnection; they are not evidence of real network calls. The production asset preparation pipeline and native binaries are not validated by targeted ESM bundling.
