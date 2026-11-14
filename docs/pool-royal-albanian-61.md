# Pool Royal: break fixes and Albanian 61

## Break resolution

The random-breaker and rematch flows now change both `FrameState.activePlayer`
and the serialized rules engine's `currentPlayer`. Every rules adapter also
uses the active shooter when resolving a shot, including older saved frames
whose two turn fields disagree. Legal break pots therefore retain the actual
breaker's visit; fouls transfer the visit to the other seat.

UK pool already declared `blackOnBreak: 're-rack'`, but did not enforce it.
Potting the black on the break now restores the complete open rack for the
same breaker, including when the cue ball also goes in. Physical balls,
shadows, animations, and pocketed-ball displays reset with the rules state.
Ordinary UK single-colour/mixed-colour break conventions are unchanged.

US eight-ball and nine-ball keep their existing distinct break rules. US
eight-ball does not assign groups on the break and re-spots the eight;
nine-ball can win on a legal nine. These are covered for both player seats.

## Albanian 61 (61 pikë)

The new `albanian61` variant is selectable in the lobby, career matches and
tournaments. Training drills retain their existing rules. Online matchmaking
keeps this mode separate from other variants and older clients that omit a
variant. The existing online model remains client-adjudicated.

This is a **Rotation 61 house-rules implementation**, not a claim of an
official Albanian federation ruleset. Local Albanian versions may differ.
The exact convention appears in lobby help and game information:

- Use all fifteen numbered balls. Each legal pot scores its face value.
- Hit the lowest remaining number first; legal combinations score too.
- First to at least 61 points wins. The eight is an ordinary eight-point ball.
- A legal pot, including a break pot, keeps the visit. A miss ends it.
- A dry break needs four distinct object balls to a cushion.
- A foul scores nothing, restores all balls potted or driven off on that shot,
  and gives the opponent cue-ball placement behind the head string.
- A 60–60 finish awards the last legal potter one deciding point. This is an
  explicit house convention so a tied rack cannot leave play stuck.
- Rack the one at the apex, fifteen at center, and two/three at the back
  corners. A fixed permutation of the other balls keeps online clients aligned.

The points HUD, final result, saved competition state and AI target selection
use the same rules state. Foul pots do not appear as scored balls.

## Research

Retrieved on 2026-11-14:

- [Tilt Billiard Club: Rotación / Chicago / 61](https://tiltbilliardclub.com/wp-content/uploads/2018/07/reglas-de-billar-61.pdf)
  supports lowest-first contact, face-value scoring, the 61 target, rack
  anchors, behind-head-string foul placement and re-spotting. This is a club
  source, not an Albanian national rulebook.
- [WPA Rules of Play, effective 2025-09-15](https://wpapool.com/wp-content/uploads/2025/09/2025.09.15-WPA-Rules.pdf),
  section 4.3, is the reference checked for US eight-ball breaks. The UK mode
  preserves its separately configured house rules.

## Verification

Rule-engine, adapter and physical-restoration regressions cover both breakers,
legal/mixed pots, scratches, black-on-break re-racks, legal special-ball pots,
61 scoring/combinations, foul re-spots, winning/tied finishes, numeric AI
targets, aliases, online queue isolation and saved competition progress.

TypeScript and Vite production compilation pass. Live WebGL playtesting and
two-client networking were not verified in this workspace: the local browser
could not start under its socket restrictions, and the separate cloud browser
could not reach the local preview server.

The broader online-flow Jest suite also stops at the pre-existing missing
declaration for `webapp/src/utils/backNavigation.js`, imported by
`nativeBridge.ts`. The server-backed matchmaking test did not reach server
readiness in this environment. The pure matchmaking compatibility tests pass;
these are not a substitute for a deployed two-client smoke test.
