# Multiplayer Blackjack example

This directory shows how to implement a simple multiplayer Blackjack variant
with betting rounds and community cards. Players join a room, post a fixed
stake and receive two private cards. The game then proceeds through the
following stages:

1. **Initial bet** – each player posts the stake into the pot.
2. **Deal** – every player gets two private cards from a shuffled deck.
3. **Betting round** – players may call, raise or fold. When a player raises, all
   remaining players must either call the new bet, re-raise or fold before the
   round can end.
4. **Hit / Stand** – active players choose to draw additional private cards or
   keep their current hand. Once a player stands or busts they cannot act
   again in this phase.
5. **Community cards** – cards are revealed to the center one at a time. A new
   betting round follows each reveal. Up to five community cards may appear.
6. **Showdown** – private and community cards are evaluated using Blackjack
   rules. Whoever has 21 or the highest value below it wins the pot. Ties split
   the pot. After revealing the winners, call `finishRound()` to move the pot to
   the winning player(s), clear all cards and immediately deal a new round.

The core game logic lives in `gameLogic.js`. It manages the deck, betting
state, community cards and winner calculation. It exposes helper methods for
classic betting actions (`call`, `raise` and `fold`) as well as `allPlayersCalled()`
to check whether everyone has matched the current bet, and `finishRound()` for
settling the pot and starting the next game.

This example focuses on the game mechanics and is intentionally minimal. It can
be paired with a Socket.IO server and React client similar to the other
examples in this repository.

## Running a multiplayer room server

`server.js` shows a lightweight Socket.IO host that mirrors the Murlan Royale
3D flow: rooms spin up automatically, hands are dealt once at least two players
join, and the round advances from betting → hits → showdown without any extra
UI scripting. To try it locally:

```bash
node examples/blackjack/server.js
```

From a client you can connect with Socket.IO and emit the following events:

- `joinRoom`: `{ roomId, name? }` – join or create a room and trigger dealing
  when the minimum player count is reached.
- `bet`: `{ roomId, amount }` – convenience wrapper for `raise`.
- `call`, `raise`, `fold`: `{ roomId, amount? }` – standard betting actions.
- `hit`, `stand`: `{ roomId }` – act during the hit phase.

The server emits `gameStateUpdate` after every action and a `showdown` payload
when the hand resolves. `getState()` now includes `lastShowdown` so clients can
render the winning line-up alongside the new deal.
