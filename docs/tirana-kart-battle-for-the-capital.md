# Tirana Racing: Battle for the Capital

This is an expansion of the existing Tirana Racing game under `webapp/src/games/kartroyale/`. No new game card, route, catalog identity, or save migration. Use the existing 3D karts, drivers, touch controls, collision engine, and Tirana roads. Career is all kart driving. Assets and names used for references are not bundled.

## Playable target and release gates

1. **Ali Demi captain pilot:** opt-in 1v1 against solo AI on a known course, readable rules and outcome, retry, no account effects. A complete race with touch, 12-player mode not claimed. 
2. **Neighborhood championship:** seven rival teams, eight events each ending with a captain, separate validated progression, XP and cosmetic unlocks. Each enabled mission must have its rules, event result and restart covered. Old Career and records remain readable and unchanged.
3. **Racing formats:** keep Classic (no ability pickups) separate from Arcade Combat; introduce a small set of timed kart effects, defensive counters, drift combos and transparent comeback rules. Use stylized, clearly fictional effects and no physical weapon simulation. Make boss styles distinguishable by driving decisions, not hidden speed or invulnerability.
4. **Dynamic circuits:** start with clearly signaled wet grip, boost zones and final-lap events; no silent changes to route or weather in ranked results. Reuse 20 existing courses and preserve their IDs and layouts. A revised route needs its own geometry identity and migrated selections without borrowing old leaderboards.
5. **Online:** only after synchronization and record-compatibility QA. Verify matching track/format IDs and physics, honest finish order, reconnect behavior and network recovery. Keep current matchmaking and leaderboards separate while new rules are validated. Online formats/capacities in the brief (up to 24) are design targets.

## Balance

Driving and speed 40%, kart battles 30%, boss events 15%, rivalry 10%, garage 5% are planning targets, not observed play metrics. Make Speed, Tank, Drift, Attack, Off-Road and Legendary classes lateral choices with explicit weaknesses; test combinations on different courses and difficulty levels before any unlock can affect online racing. Prove legibility at 360 × 800 and 390 × 844, including touch steering plus drift/boost; profile on a real Android device before making FPS or capacity claims.
