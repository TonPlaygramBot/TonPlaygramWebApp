# Chess Battle Royal rules and physical grip review

Based on `main` at `105f65e8e03423c4898606f6b6d28911b96b6573`.

The browser, AI and authoritative Socket.IO server now use the same rules
module. Pawn attacks are separate from pawn moves; castling checks transit
squares with the king's old square vacated. En passant lasts one reply and is
rejected if removing both pawns exposes the king. All four promotion choices
are supported, and the king cannot be captured. FEN and network snapshots keep
castling rights, en passant, move counters and repetition history.

Draw handling includes stalemate, the standard insufficient-material cases,
claimable threefold/50-move draws, and automatic fivefold/75-move draws. Mate
takes precedence over the 75-move rule. Finished draws reject further moves.
The game retains a 60-second **per-turn** clock, now equal for both colors;
online deadlines and timeout settlement are owned by the server. Validated
moves reserve a bounded presentation allowance (1.6 seconds ordinarily,
3.2 seconds for castling, 15 seconds for capture effects).

Rule reference: [FIDE Laws of Chess, articles 3, 5, 6 and 9](https://handbook.fide.com/chapter/E012023).
This is a digital game implementation, not a certification of every
over-the-board tournament procedure or every possible dead position.

The character adapter now resolves the actual `RightHandIndex1`/Mixamo-style
finger names. Previously the finger arrays were empty. The new TypeScript
motion controller shares one timeline between the hand and piece: reach,
close, lift, carry, lower, open, withdraw. Its arm and finger solver converts
world rotations into each joint's parent frame. A common reachable grip
anchor accounts for the thumb being shorter than the other fingers. Piece
positions stay in the board parent's coordinates. Castling queues the rook
after the king; firearm captures queue the hand move after the effect.
Promotion replaces the pawn mesh after placement. Network acknowledgements
preserve an active matching animation, and remote legal moves use the same
motion path. Resync/unmount cancels pending movement callbacks.

## Validation

- `node --test test/chessRules.node.mjs test/chessPhysicalMove.node.mjs`:
  18 tests pass, including the repository's real chess-human skeleton.
- Opening perft: 20, 400, 8,902 and 197,281 nodes through depth four.
- Kiwipete: 48, 2,039 and 97,862 nodes through depth three.
- Rook/pawn en-passant endgame: 2,812 nodes at depth three.
- The complete ChessBattleRoyal component and its dependencies bundle with
  esbuild; the new TypeScript controller passes `tsc --noEmit`.
- The multiplayer matchmaking TypeScript package builds.
- The modified JSX passes an undefined-variable check; this also found and
  fixed four existing pointer-handler references outside their scope.

## Remaining release checks

The chat browser blocked the local development URL (`ERR_BLOCKED_BY_CLIENT`),
so full-game portrait rendering and every character/piece cosmetic combination
have **not** been visually verified. The chat's focused motion preview uses
the existing avatar geometry and the new controller, with simplified materials;
it is not the entire multiplayer application.

The full Socket.IO integration test could not start because `canvas@2.11.2`
lacks its native binary in this Node 24 environment; its attempted source
build failed while extracting Node headers. No fake canvas substitute was
introduced. Run `node --test test/chessOnlineMoveValidation.test.js` in the
normal server environment, then check two-client moves, reconnects, timeout
settlement, captures, castling and underpromotion before merging. The existing
full webapp build also requires the complete unrelated game-asset checkout.

Further coverage is needed for arbitrary blocked/dead positions, draw claims
made by announcing an intended move through the UI, and per-character
anatomical joint limits. The current solver bounds each correction but does
not contain a separately authored anatomical constraint profile for every rig.
Keep this change as a draft until those visual and integration release checks
are reviewed.
