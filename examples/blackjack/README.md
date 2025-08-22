# Multiplayer Blackjack example

This directory shows how to implement a simple multiplayer Blackjack variant
with betting rounds and community cards. Players join a room, post a fixed
stake and receive two private cards. The game then proceeds through the
following stages:

1. **Initial bet** – each player posts the stake into the pot.
2. **Deal** – every player gets two private cards from a shuffled deck.
3. **Betting round** – players may call, raise or fold.
4. **Hit / Stand** – active players choose to draw additional private cards or
   keep their current hand. Once a player stands or busts they cannot act
   again in this phase.
5. **Community cards** – cards are revealed to the center one at a time. A new
   betting round follows each reveal. Up to five community cards may appear.
6. **Showdown** – private and community cards are evaluated using Blackjack
   rules. Whoever has 21 or the highest value below it wins the pot. Ties split
   the pot.

The core game logic lives in `gameLogic.js`. It manages the deck, betting
state, community cards and winner calculation.

This example focuses on the game mechanics and is intentionally minimal. It can
be paired with a Socket.IO server and React client similar to the other
examples in this repository.
