# Checkers Battle Royal launch review

Base: `main` at `105f65e8e03423c4898606f6b6d28911b96b6573`.
Reviewed: 2026-09-13. Status: code improvements verified; live launch approval remains pending.

## Rules

The movement specification is English/American checkers: forward-only men, short-range kings, compulsory captures, free choice between available captures, continuation with the same piece, and promotion ending the turn. Winning includes blocking every opponent move. See [WCDF rules 1.15–1.20, 1.30 and 1.32](https://wcdf.net/rules/rules_of_checkers_english.pdf).

Battle Royal retains its existing **light opens** convention, now disclosed in the rules panel. It automatically adjudicates threefold repetition and the 40-move-per-player no-progress rule; these do not require a player claim. This is not an assertion of full tournament-procedure compliance. The separate legacy numeric-player adapter retains its existing player-zero opening convention.

## Defects addressed

| Problem found | Change |
| --- | --- |
| Solo players could select another piece during a jump chain | Required origin is retained and enforced by shared move validation and highlights. |
| A newly crowned man could continue capturing as a king | Promotion ends that turn for both colours, including capture promotions. |
| AI search ignored opponent chains, could switch capturing pieces, and scored some terminal wins as losses | Search uses the shared rules and retains the required origin until the turn completes. Depth is bounded at four full turns. |
| Replay temporarily replaced the live board and turn | A cancellable display-only replay owns neither. New moves and teardown cancel it. |
| Touch-down could commit a move before a camera drag | Move selection occurs on release after tap validation. Jitter, multi-touch, right-clicks and cancellation are handled. |
| Destination pieces appeared while their animated duplicates moved; chained jumps ran together | Destination meshes are hidden until landing and jumps run sequentially. Crowns appear on landing. The result dialog waits for movement to finish. |
| Rule/status messages were set but not displayed | Added a live status strip, rules panel, labelled controls and 44px main action buttons. |
| Decorative downloads delayed the board | A playable procedural board is created immediately; decorations load afterwards. Stale asynchronous results are discarded. |
| Online colour indicators and results assumed the user was light | Authoritative rosters restore the actual side on join/sync; labels and outcomes use that side. |
| Cosmetic changes could resubscribe and leave an online table | Network subscriptions use stable renderer references and depend on session identity. |
| Multiple submissions and disconnected input could use stale state | Pending moves lock input until a snapshot; timeouts request synchronization; disconnects disable play. |
| Reconnection could animate only the last jump of a missed sequence | Only consecutive snapshots animate; larger gaps restore the authoritative position directly. |
| Finished games accepted more moves; draws were missing | Terminal input is rejected. Repetition and no-progress history are tracked by the shared engine and online store. |
| Draws had no settlement path and payout deduplication existed only in process memory | Draws return each stake. Credits and transaction receipts are written atomically per account with receipt-based retry guards. Success requires both receipts. |
| The legacy checkers adapter lacked captures and turn validation | It delegates move legality and completion to the same engine. |
| Default rendering was heavy for phones and WebGL failure could leave a blank mount | Default quality is the balanced 60 FPS cap; optional storage failures are tolerated and WebGL startup failure has a recovery screen. |

## Verification performed

Run from repository root:

```sh
npm run test:checkers
node --check bot/server.js
```

- 29 Node tests passed, including both-colour promotions, compulsory chains, king restrictions, blocked wins, malformed input, terminal locking, both draw rules, replay cancellation, gesture discrimination, animation ordering, legacy moves and settlement-plan retries.
- Twelve complete AI-versus-AI matches, with varied openings and 154 captures, reached a win or draw. Display-adapter and authoritative-server results were compared after each move. This is rules simulation, not twelve browser-played matches.
- Production Vite build passed (2,810 modules). Existing large-chunk warnings remain. The build was invoked directly without running unrelated asset-generation prebuild scripts.
- The page and its local dependency graph also bundled successfully with esbuild; server syntax and whitespace checks passed.
- Existing Jest-only suites were not executed because the available root dependency directory has no Jest installation. The existing three Node realtime-store tests were included in the 29 passing tests.
- No live wallet transaction or real-stake game was performed. The settlement test exercises generated atomic operations against an in-memory account model; it is not a MongoDB integration test.

## Remaining launch gates

1. **Visual and device playthrough:** the live `/games/checkersbattleroyal?mode=ai` page showed only its background and an empty DOM in the cloud browser. The local preview URL was rejected by browser URL policy. The cause of the live blank page is unconfirmed; it cannot be attributed to a specific game defect from that evidence. Capture a complete portrait match on iOS Safari, Android Chrome and Telegram's WebView, including menus, top-down/3D switching, promotion, final capture, replay, background/resume and memory/performance measurements. No phone FPS claim is made here.
2. **Online staging integration:** deploy the frontend and backend together because snapshots now include roster and draw state. Run two accounts through both colours, mandatory chains, delayed/duplicate messages, reconnect, draw and win settlement. Confirm real database receipts, partial-write retry and duplicate requests with test balances.
3. **Server restart and abandoned matches:** `checkersRealtimeStore` and `checkersMatchSessions` remain process-memory maps. This change protects individual credits against duplication but does not add durable match recovery, a settlement retry worker, a move clock, or disconnect forfeiture/refund adjudication. Those flows need implementation and staging verification before launching real-stake online play.
4. **Fresh deployment check:** verify the deployed asset URLs and the initially blank app entry after release. A successful local build does not establish that the current public deployment loads correctly.

These are release gates, not completed checks. Keep the change in review until they are resolved.
