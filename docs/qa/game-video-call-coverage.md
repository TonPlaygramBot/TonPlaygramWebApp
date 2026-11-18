# Game video call coverage: draft, not approved for live

Games catalog currently lists 14 active games. Existing shared overlay already
covers Texas Holdem, Domino, Pool, Snooker, Air Hockey, Snake, Murlan, Chess,
Checkers, Four in a Row and Ludo (11). This patch adds Tennis and Table Tennis
online routes only with a nonempty tableId, and Racing with actual online room
state. Racing standalone shares the same component and styles. Offline/AI racing
has no call control. Room changes release media and require a new explicit tap.

GameLiveAvatarOverlay + useLiveVideoChat use Socket.IO signaling and real browser
WebRTC APIs. This is not a video mock in runtime; tests use fake media/peers.
The new room-bound sibling avoids router dependency and gameplay remounts. A
visible camera button is provided for the three new games when avatar anchors
are absent. Camera/microphone capture remains behind explicit click and browser
permission; existing cancellation/denial/cleanup behavior is retained.

## SECURITY BLOCKER BEFORE LIVE

The existing liveChat:join server path authorizes friend-call rooms but does not
verify match membership for game rooms. The general socket middleware's accountId
and googleId hints are not adequate authentication. Knowing a room ID must not
confer permission to see/hear players. This patch does NOT claim to fix that.

A correct server change must resolve a verified principal, bind it to each game's
authoritative current seat (including Racing private rooms), reject outsiders and
wrong-game rooms, revalidate expiry/removal on signaling, remove departed peers
and preserve friend-call rules. Racing's game socket and shared media socket may
be distinct; do not compare unverified IDs or assume socket.room membership across
connections. Fail closed where no trusted binding exists. No universal default
call room should be accepted. Existing buildGameLiveChatRoomId default remains an
additional legacy issue outside this UI patch; new integrations never use it.

Keep PR draft, do not merge/deploy before server-side authorization is integrated
and tested. Successful browser permission does not make a room private.

## Verification

61 mocked-media video tests pass, including start/stop for all three additions,
standalone no-router binding, no permission on mount, invalid/missing room denial,
room-change cleanup and gameplay state preservation. Prior shared tests cover
permission rejection, interrupted requests and repeated call toggles.
Root TypeScript and diff checks run separately. No two-device call, TURN/NAT
connectivity, real camera/microphone permission, visual standalone CSS, or mobile
frame-rate test was performed. Environment Chromium is blocked before startup;
this is not a claim that all games' real calls work end-to-end.
