# Tirana Streets / Racing Royal — modes, social Explore and Grand racing

Source inspection began at `a808b9685e993b432a95d9d2f1a0bed150ad014f`. The implementation is based on main `7153cafbc472f4fe2157b5b8292812efb21efde4`, preserving the intervening Pool/Snooker cue updates, 8 September 2026. No merge or deployment is performed by this change. Deploy matching frontend and server after review; a frontend-only deployment cannot provide the new shared rooms.

## Modes that actually launch

The actual Tirana Streets lobby has three primary cards: **Battlefield**, **Career mode**, **Explore**. Battlefield retains the existing first-person wave/extraction and multiplayer operation code. Career retains the existing nine-mission driving/combat campaign, account-independent street cash, weapon inventory, save key and progression. City Stories remains a secondary link. This is not a newly authored GTA VI campaign or a claim of GTA feature parity.

The actual Racing Royal wrapper has **Multiplayer racing**, **Career mode**, **Explore together**. The existing multiplayer/AI-practice lobby remains the multiplayer entry. The explicit career view uses the existing KartRenderer, race completion, career save key and original cup indices. Explore unmounts racing and opens the same peaceful Tirana service as the Streets entry. Paid `mode=online`/table URLs never redirect into a free activity. No stake amounts, balances, payout rules, start-grid rules or original race time limit are altered.

Direct routes: `/games/tiranastreets?mode=ai&activity=explore`, `/games/kartroyale?mode=ai&activity=explore`, and `/games/kartroyale?mode=ai&activity=racing-career`. The existing Streets career route remains `activity=street-career`.

## Shared peaceful city, not an offline imitation of networking

`bot/services/exploreRooms.mjs` is connected by the existing Tirana service factory/attach path; the original service is retained verbatim as `legacyTiranaStreets.js`. Both games share four-person public instances, plus code-based joining. The four-person cap follows the existing Royal WebRTC mesh budget, not an MMO-scale promise. Rooms are single-process and memory-backed; they do not survive a restart or span multiple server replicas without a shared room service/sticky routing.

Only server-registered, account-bound sockets may join. Profiles, display names, photo URLs and friend-request identifiers come from the server user store, not client-supplied identity. Per-client session fencing prevents stale component cleanup on a reused socket from leaving a newer session. The server owns player positions, driving and fixed simulation steps. Fire, purchases, damage, wanted dispatch and rewards are stripped. Allowed interactions are entering/exiting vehicles and recovery.

Chat is plain text, rate-limited to four messages per five seconds, 280 characters and a sixty-message room history. The People panel sends the existing `sendFriendRequest` API only on a user click; acceptance is still required. Session blocking hides both peers' presence/messages and denies further signaling. Reports reach an operator log callback; this is NOT a durable moderation queue or a platform-wide block list. Room persistence, moderation operations, authentication integration and abuse testing remain production gates.

## Opt-in live media and character identity

The implementation uses the existing shared game socket, the same configured `VITE_WEBRTC_TURN_URLS` / `VITE_WEBRTC_TURN_URL`, username and credential settings, and a four-person mesh. The dedicated Explore media hook is adapted to membership-scoped signaling rather than reusing the older unrestricted `liveChat:*` room events.

Camera and microphone are off by default. Only **Join voice** or **Go live — camera + mic** calls getUserMedia. Every signal requires two opted-in members in the same room, no session block and matching server-issued media epochs. A prepare/activate handshake prevents early signaling before the local capture is ready. Permission requests are exclusive; late cancelled captures are stopped, not published. Stop, hiding the document, page exit, disconnection and disposal stop all local tracks and close peers. Microphone mute is explicit; a joined but muted participant can keep listening without advertising a live microphone. Remote audio provides a manual playback button when browser autoplay is blocked. Real two-device WebRTC/TURN connectivity and permission races still require browser/device QA.

Players select existing Chess/RPM or Adrian/Maya human assets through the existing catalog and SharedHumans loader. Profile images (or initials) and opted-in camera feeds are **face-mounted identity panels**, with stored profile name labels. They are NOT UV-remapped facial skins, identity verification or face scans. Embedded human PBR materials are preserved. No new third-party character binaries or font files are added. The existing model permissions/credits still apply.

## Bigger racing circuits and correctly facing turn guides

The original five circuit IDs and original simulation source remain unchanged in `legacySimulation.mjs`. New Grand circuits have separate IDs, preserving old best times and live-session geometry.

The **Lana–Pyramid Grand** perimeter combines adjacent shipped race paths by removing their shared corridor. Every resulting edge already occurs in one of those source paths. Its unsmoothed source length is **1,993.973 m** in the existing city frame: about **37.7% longer than Lana** (1,448.397 m) and **102.7% longer than Pyramid** (983.929 m). It is registered in the actual track list and a fixed new cup slot, not just a preview. The fixture reproduces the two paths fetched from source blob `69529cb43abe8754fcf347d6293bbc07911db94c`; the full-checkout test checks that fixture against the actual shipped file. These are calculations in the existing approximate metre frame, not surveyed road-length measurements.

Additional per-district Grand candidates use connected existing road edges, reject private/narrow/unbuilt eligibility where represented, require at least 1.4 times the old route length and cap length at 2.2 km. They are omitted with diagnostics when connectivity or the fixed 360-sample simulation cannot represent them safely. Their number is not claimed here: full-WORLD execution was unavailable locally. The integration gate requires every enabled new circuit's real AI racer to finish within the unchanged race limit; a route failing that check must not ship. Only the fixed combined cup is appended, so changing optional detour availability cannot silently shift saved cup indices.

Turn boards use signed change in travel direction, metric look-ahead and spacing across the closing seam. Front faces point toward approaching drivers; chevrons point visually left/right relative to that approach, including reversed/rotated loops. Placement stays outside the entire race ribbon and avoids building footprints/edges. This does not move the city, scale its geography or construct imaginary connecting roads. New closed race routes are authored events, not legal public-road driving directions.

## Paving, grass, trees and city realism

The shared environment layer retains the earlier building PBR finishes, road markings, cycle-lane details, posts, landmark models and city coordinates. New grass surfaces stay inside recorded park polygons with mapped roads, pavements, buildings, lakes and waterways subtracted; race ribbons are additionally excluded. Racing scenery receives bounded existing glTF-tree infill in those green areas, replacing neither the landmark layer nor the source map. Individual tree locations are authored infill, not satellite-detected tree centres.

A natural-stone-style finish is limited to mapped pedestrian areas containing the documented Skanderbeg Square reference. The material family is supported by the Albanian National Tourism Agency's square description; the two-kilopixel tile pattern is authored. Unknown road surface materials are not labelled verified stone. The legacy road snapshot lacks full surface surveys, so this does NOT establish original stone species, tile pattern or exact paving for every Tirana road. No satellite/Street View pixels or Google geometry are copied. No measured terrain/altitude or outer-ring map expansion is part of this change.

Reference: https://akt.gov.al/en/attractions/Skanderbeg-Square/ . Existing geography remains © OpenStreetMap contributors / ODbL; all prior asset credits are retained. Technical references: https://www.w3.org/TR/mediacapture-streams/ and https://threejs.org/docs/pages/VideoTexture.html .

## Verification actually executed

- **142 focused Node tests passed**, zero failed/skipped: the preceding 95 source-subset tests unchanged plus 47 new tests for social rooms, signaling consent, cancellation, source-backed/analytic circuits, turn direction, park boundaries and surface classification.
- Twenty-four source-subset TS/TSX/JSX files pass TypeScript transpilation syntax diagnostics. This is NOT a dependency-aware type check or full build.
- Calculated the real source-backed Lana/Pyramid fixture lengths and validated that the combined loop uses only their edges and all of its corners survive 360-sample resampling.

Not executed locally: full repository/WORLD import, actual simulation AI completion on the new track, full production build, dependency-aware type check, existing end-to-end socket suite, actual-game WebGL view, real remote/avatar resource loading, two-device calls, physical-phone performance/thermal testing or successful remote CI. The local container lacks the full dependency tree and cannot resolve the GitHub/npm download hosts. The added workflow runs the actual integration checks without skipping failures; adding it is not a success claim.

Keep this PR draft until those checks pass. Existing camera/microphone permissions and browser autoplay restrictions are respected, not bypassed. No background delivery, recording, payments, automatic friend additions, production deployment or branch-protection changes occur in this implementation.
