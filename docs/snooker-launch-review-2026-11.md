# Snooker Royal launch review — 14 November 2026

Review base: `db87525aecb41b7157ececc5e8e777ac028df3a8` on `main`. This branch improves local gameplay and the online relay boundary. It does **not** certify a staked or competitive public launch.

## Camera, rules and AI changes

The local player's shot view now starts directly behind the cue axis and holds the same position and gaze through backswing, impact and all ball motion. It cannot switch to side-follow/pocket tracking after 900 ms. Portrait projection checks cover the cue ball, rail clearance, both seats, world scaling and explicit view overrides. Visually upward/downward aiming swipes keep their existing behavior.

The rules add direct-contact evidence for foul-and-miss calls, restoring the full scene while retaining penalty scores, a warning before a third full-ball miss loses the frame, touching-ball play-away/push handling, reported off-table handling, and a drawn deciding-black starter choice. Existing alternation, foul scoring, colour respots, free balls, clearance and deciding-black tests remain. See `rules/snooker-fouls-scoring.md` for the remaining referee cases; full professional rules compliance is not yet claimed.

Snooker now uses its own bounded shot planner. It distinguishes semantic ball IDs from material colours, matches each colour exactly, uses full-ball route clearance and live first-contact tracing, rejects backward cuts, considers the next legal ball from the rules engine, compares attacking and defensive leaves, and nominates free balls. Planned draw/follow spin survives the UI reset and reaches the delayed strike. Stale AI callbacks cannot fire or change the camera after turn, frame or scene ownership changes. Leave and scratch predictions are geometric estimates, not a complete multi-ball physics rollout; complete-frame playing strength still needs match evaluation.

## Build and gameplay verification

- 168 Jest tests across 17 suites, including the final online deciding-black case; 50 Node tests cover the camera, actual production release/callbacks, referee scene replacement, table mapping, controls, AI and relay boundaries.
- Root TypeScript compilation, server syntax and whitespace checks passed.
- The full Vite production bundle passed in approximately 93 seconds. It reports existing large-chunk and external-url-map warnings.
- The complete packaging wrapper cannot finish in this checkout because `assets/external/manifest.json` has not been imported. External-asset prebuild/download packaging and Render deployment were not verified. No deployment configuration was changed.
- Chromium could not launch because this environment denies its process socket; the shared browser could not connect to the local server. No browser-rendered visual, physical-phone FPS or two-device online claim is made. The existing React/Three.js `webapp/snooker-review.html` entry opens the actual game for follow-up testing.

## Online fixes in this change

- A seated player can publish live frames and shot results only while their server-cached seat is active. The roster order maps to A/B exactly as the lobby does. A match must have started, and completed frames reject further writes.
- The server checks bounded frame state, scores, all 22 distinct ball identities, finite positions, mesh snapshots and aim inputs. Malformed replacement layouts from the miss/replay choice are rejected before reaching the renderer.
- Valid aim-only packets now reach the opponent. Previously the server required a layout and silently discarded the client's aim stream.
- Scores, placement and the local control turn derive from the current frame and the receiver's seat, rather than the sender's local HUD. This prevents the waiting phone from enabling its shooting controls when the opponent sends `turn: 0`.
- Relay timestamps use server time, while relative animation timestamps remain available separately.

These checks limit unauthorized and malformed relay writes. A legal-looking but invented result from the active client is still possible: the server does not yet simulate/adjudicate each shot.

## Remaining launch blockers found in source

| Priority | Finding | Required before release |
| --- | --- | --- |
| P0 for staked/competitive play | `bot/server.js` accepts the active client's complete resulting frame; rule/physics outcomes are not recomputed on the server. The new actor/schema checks do not prove that a pot or foul occurred. | Server adjudication using shot inputs and a canonical layout, replay/deduplication controls, and durable match recovery. |
| P0 for TPG stakes | `snookerRoyalOnlineFlow.js` debits a stake, while the match-completion path in `SnookerRoyal.jsx` displays a calculated prize without a Snooker settlement request or confirmed payout receipt. The server Snooker handlers contain no settlement operation. | Durable, idempotent reserve/refund/settlement, confirmed receipts, and tests for duplicate results, disconnects, timeouts and process restarts. Display a payout only after confirmation. |
| P0 for paid inventory | `bot/routes/snookerRoyal.js` accepts inventory writes for a caller-provided account and merges caller-provided unlocks. The global middleware is `optionalAuthenticate`; this router has no required authentication, ownership check or authoritative reward/purchase validation. The shared authentication middleware also accepts caller-provided account/Google identity headers, so adding it alone would not establish secure ownership. | Require a verifiable owner credential and grant unlocks from verified purchases or server-validated achievements. Preserve legitimate existing purchases during migration. |
| P1 for payment recovery | The matchmaking refund helper clears its debit reference in `finally`, including when the refund fails, while several messages say the stake was refunded before confirmation. | Persist pending refund receipts, retry safely with an idempotency key, and distinguish a confirmed refund from a pending/failed refund in the UI. |
| P1 for online recovery | Snooker frame cache is an in-memory Map. No durable Snooker state recovery/settlement was found for server restarts. | Restore current layout, active seat, rule state, deadlines and financial receipts across restarts. |

No production funds, payouts or inventory were changed by this review.

## Verification performed for the online changes

- `node --test test/snookerOnlineBoundary.node.mjs`: 7 passing tests (actor ownership, turn transitions, completed frames, state bounds, layout/aim validation, receiver HUD mapping and resynchronization).
- `jest test/snookerOnlineRulesBoundary.test.js --runInBand`: 4 passing tests using the real rules engine, covering foul/miss replacement, malformed replacement-layout/position rejection and deciding-black choices.
- `node --check bot/server.js`: passed.

These are automated code checks. Two-device online gameplay, real-account stake settlement, real phone GPU performance and deployed assets were not verified by this audit. Camera/rules/AI verification is recorded with the corresponding branch tests and PR results.

## Portrait phone smoke checklist

Run the actual game in a portrait browser and Telegram WebView on Android and iOS, using both a new profile and an existing profile.

1. Open the lobby, enter AI mode, finish loading, and confirm the table/balls/textures and controls are visible with no failed asset requests or WebGL errors.
2. Aim at targets near every cushion. Drag visually up to stand and visually down to lower the view. Pull/release power and confirm the shot stays centered along the cue from the player's location, without a side-follow camera or a jump beneath the cloth. Test manual overhead view and replay separately.
3. Pot a red, choose a colour, pot it, and verify points, colour respot and continuing break. Repeat after the final red, then clear yellow through black.
4. Test wrong first contact, no contact, cue-ball scratch, accidental colours, free ball, foul-and-miss choices, an occupied colour spot, tied final black and final-black foul. Confirm each choice is reflected in both score and ball positions.
5. Let the AI play complete frames, including obstructed pots, safety positions, cue-ball in hand and the final colours. Watch for illegal first contacts, freezes, repeated scratches and excessive thinking time.
6. With two phones, confirm seats A/B show their own scores first, only the active player can shoot, live aim/balls animate remotely, timeout fouls synchronize, and a foul-choice return correctly transfers control back.
7. Background/reopen each phone, interrupt the connection during aiming/rolling/settlement, then restart the server in a staging environment. Verify recovery and receipts before claiming online launch readiness.
8. Run a sustained match with sound on/off, rotate away from and back to portrait, cancel power drags, open/close settings, leave/reenter, and check memory, input responsiveness and thermal/FPS behaviour.
