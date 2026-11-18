# Chess startup recovery

Live Games-page smoke on 2026-11-18:
- 4 in a Row: lobby, local AI start, visible Canvas/DOM fallback board, red column-4 move, blue AI column-3 response, and return to lobby worked. WebGL did not work; this is not a 3D pass.
- Checkers: lobby and offline start reached a clear 3D startup failure alert; Lobby recovery worked. No gameplay verified.
- Chess: lobby and offline start reached an empty board area with “White to move”; console confirmed WebGL renderer creation failure. No explanatory error or obvious recovery was displayed.

Minimal Chess fix: expose a startup failure alert above the HUD, with Reload game and Lobby actions. The existing setup catch updates React state only while mounted. It does not fabricate a playable board, force graphics settings, alter rules, or touch balances.

Validation: actual catch callback executed with rejected setup promises (mounted/unmounted); alert DOM/actions tested in React/jsdom; both changed JSX files compile; root TypeScript build passes. No physical phone, post-fix live deployment, real 3D gameplay or WebGL enablement is claimed.
