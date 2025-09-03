# Tournament utilities

`tournament-utils.js` centralizes logic shared by tournament game pages.

## Exports
- `handleTournamentResult(winner, options)` – updates bracket state and performs payouts.
- `simulateRoundAI(state, round)` – advances non-player matches for a round.
- `simulateRemaining(state, startRound)` – simulates the rest of the bracket.

## Basic use
```html
<script type="module">
import { handleTournamentResult } from './tournament-utils.js';

if (window.tournamentMode) {
  window.handleTournamentResult = (winner) =>
    handleTournamentResult(winner, {
      stateKey: STATE_KEY,
      oppKey: OPP_KEY,
      bracketPage: '/pool-royale-bracket.html',
      stake: window.stake,
      players: window.tournamentPlayers,
      accountId: window.accountId,
      awardPrize: async (total) => {
        // game specific payout logic
      }
    });
}
</script>
```

`awardPrize` receives the total pot (`stake * players`) and should deposit
winnings and developer shares as required by the game. Import the other
utilities directly if bracket pages need to simulate matches.
