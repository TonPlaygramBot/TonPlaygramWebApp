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

**Production-baseline deployment gate:** the production baseline `liveChat:join` authenticates friend calls but does not verify game-match membership for `live-*` room IDs. Exact client room filtering does not fix guessed-room access. This draft now includes the fail-closed membership candidate described below, but it has not been deployed or validated end to end. Do not describe production game calls as private/secure.

No camera or microphone starts automatically. Users must click their avatar or Voice/Video. Preview is local, not a call to AI. Media/browser permissions remain under browser/OS control.

Two-device Telegram/WebView testing (permission denied, reconnect, mute, end, navigation, all affected game layouts) and actual TURN/NAT checks remain required. Unit tests use mocked media/socket/RTCPeerConnection; they are not evidence of real network calls. The production asset preparation pipeline and native binaries are not validated by targeted ESM bundling.

## Follow-up: fail-closed server membership candidate (still draft)

The draft now gates game joins using the existing signature-verified Telegram/Google social identity **and** the exact `tableMap` roster account, socket ID and game type. It does not create a new signed match token: it validates signed login credentials and the live server roster. Legacy `register`, `playerId`, caller account fields, watcher status and Socket.IO room joins are not authority. Joined account IDs are pinned. Both signaling endpoints and media updates revalidate membership. A one-second sweep removes expired/disconnected/reassigned/unseated members and notifies peers to close; client rejection stops capture and blocks automatic recapture until the user explicitly ends and retries.

**Compatibility restriction:** calls require a current authoritative `tableMap` seat on this exact socket. Supported game-slug mapping is explicit: Snake, Air Hockey, Chess, Checkers, Four in Row, Ludo, Texas Hold'em, Domino, Murlan, Pool, Snooker, 2048, Hextris and Underrun. This is mapping coverage, not a claim every mode works. Alternate/legacy room stores, watcher-only routes, `default`, unknown slugs, shooting range, local/AI rooms, unauthenticated legacy clients, and reconnects that have not yet reseated fail closed. Local-only camera preview does not join and remains available. No fallback to unverified call membership is permitted. Existing friend-call authorization is retained.

Validation: 60 server tests pass (24 new policy/actual-handler tests, 14 private-call regressions, 22 signed-credential tests); 87 frontend video tests pass. Handler tests execute the actual server event-handler block in a harness, not a running full server. The signed-credential unit suite passes; real signed-login/Socket.IO/device integration must still be verified. The existing legacy game seating system itself accepts caller IDs; this change prevents those IDs authorizing media but does not claim to harden gameplay/seat takeover or its denial-of-service risks. Ban, deletion and identity-link changes in the database are not continuously polled; cached verified identity has its existing expiry. Revocation tests change cached state, not database records. Real legacy register/seatTable/reconnect integration remains a deployment gate; handler fixtures are not a claim those game paths are secured.

**Deployment remains blocked:** independent security review, full production build, signed-credential integration, per-game/room-store compatibility and two-device reconnect/TURN tests are required before removing the draft gate. The original production vulnerability is not fixed until an audited change is safely deployed.
