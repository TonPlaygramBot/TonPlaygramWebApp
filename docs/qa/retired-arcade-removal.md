# Retired arcade removal

The owner confirmed 2048 Royale, Hextris Battle and Underrun Arena must be removed, not polished. The earlier local-only Hextris fix is intentionally excluded.

- Removed game/lobby components and their exclusive header/socket hook.
- Existing URLs (including lobby and subpaths) redirect to Games instead of rendering a blank page or launching a retired game.
- Removed frontend online-readiness/icon registrations, unused icons, backend matchmaking policy and game-contract registrations.
- Old arcade socket messages return `game_retired`; they cannot create rooms or update scores.
- Games catalogue already excluded these three. Other catalogue entries and game handlers remain unchanged.
- No database records, user balances, transaction history, or user files are deleted or modified. Git retains removed source for recovery.

Validation: TypeScript root build, 28 existing online policy tests, 3 dedicated Node retirement tests and 9 React Router/jsdom legacy-link tests pass. Full Vite build is separately tracked in review; do not infer physical-phone/browser validation from these tests. No deployment performed.
