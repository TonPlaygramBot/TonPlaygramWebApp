# Texas Hold'em – Rrugëtimi i lojës

Ky projekt përfshin logjikë bazë Texas Hold'em (`lib/texasHoldem.js`) dhe një variant për web (`webapp/public/lib/texasHoldem.js`). Më poshtë përshkruhet se si rrjedh loja sipas standardit të pokrit, me theks te drejtimi i veprimeve rreth tavolinës.

## Drejtimi i lojës (dealer button)
- **Gjithmonë në drejtim clockwise**: butoni/dealer lëviz një vend djathtas pas çdo dueli.
- Shpërndarja e kartave, blind-et dhe rendi i veprimit në raundet e basteve ndjekin të njëjtin drejtim.

## Hapat bazë të një dueli
1. **Vendosja e blind-eve**: small blind dhe big blind vendosen nga dy lojtarët në të majtë të button-it (në rend clockwise).
2. **Shpërndarja e hole cards**: çdo lojtar merr 2 karta me radhë clockwise duke filluar nga lojtari në të majtë të button-it.
3. **Raundet e basteve**:
   - **Preflop**: nis te lojtari në të majtë të big blind-it dhe vazhdon clockwise.
   - **Flop, Turn, River**: pas çdo shpërndarjeje kartash komunitare, veprimi fillon te lojtari aktiv më afër në të majtë të button-it dhe vazhdon clockwise.
4. **Community cards**: tre (flop), një (turn), një (river) me një kartë burn përpara çdo seksioni, siç realizohet nga `dealCommunity()`.
5. **Showdown**: lojtarët krahasojnë kombinimet më të mira 5-kartëshe (`bestHand`) dhe shpallet fituesi (`evaluateWinner`).

## Këshilla përdorimi në kod
- Përdor `createDeck()` dhe `shuffle()` për të përgatitur duelin.
- `dealHoleCards(deck, players)` shpërndan dy karta për secilin lojtar në rend clockwise.
- `aiChooseAction(hand, community, toCall)` jep një veprim të thjeshtë AI bazuar në probabilitetin e fitores.
- `evaluateWinner(players, community)` llogarit fituesit pas mbylljes së basteve.

Këto hapa dhe rregulla sigurojnë që loja të pasqyrojë praktikën standarde të Texas Hold'em dhe të jetë e qartë për lojtarët dhe integrimin në UI.
