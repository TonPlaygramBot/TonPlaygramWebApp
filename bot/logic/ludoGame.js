export const PATH_LENGTH = 52;
export const HOME_LENGTH = 6;

const START_INDICES = [0, 13, 26, 39];
const HOME_ENTRY = [51, 12, 25, 38];

export class LudoGame {
  constructor(players = 4) {
    this.players = [];
    for (let i = 0; i < players; i++) {
      this.players.push({
        id: i,
        name: `Player${i + 1}`,
        tokens: Array(4).fill(-1),
        finished: 0
      });
    }
    this.currentTurn = 0;
    this.finished = false;
  }

  addPlayer(id, name) {
    const p = this.players[id];
    if (p) p.name = name;
  }

  nextPlayer() {
    do {
      this.currentTurn = (this.currentTurn + 1) % this.players.length;
    } while (this.players[this.currentTurn].finished === 4);
  }

  canMove(playerIdx, tokenIdx, dice) {
    const pos = this.players[playerIdx].tokens[tokenIdx];
    if (pos === HOME_LENGTH + PATH_LENGTH - 1) return false;
    if (pos === -1) return dice === 6;
    const target = pos + dice;
    if (pos < PATH_LENGTH && target > HOME_ENTRY[playerIdx] && target < PATH_LENGTH)
      return false;
    return target <= PATH_LENGTH + HOME_LENGTH - 1;
  }

  moveToken(playerIdx, tokenIdx, dice) {
    const player = this.players[playerIdx];
    let pos = player.tokens[tokenIdx];
    if (pos === -1) {
      pos = 0;
    } else {
      pos += dice;
    }
    player.tokens[tokenIdx] = pos;
    if (pos === PATH_LENGTH + HOME_LENGTH - 1) {
      player.finished += 1;
      if (player.finished === 4) this.finished = true;
    }
    return pos;
  }

  rollDice(diceValue) {
    if (this.finished) return null;
    const dice = diceValue || Math.floor(Math.random() * 6) + 1;
    const playerIdx = this.currentTurn;
    const player = this.players[playerIdx];
    const movable = [];
    for (let i = 0; i < player.tokens.length; i++) {
      if (this.canMove(playerIdx, i, dice)) movable.push(i);
    }
    let tokenIndex = movable.length ? movable[0] : -1;
    if (tokenIndex !== -1) {
      const pos = this.moveToken(playerIdx, tokenIndex, dice);
      if (dice !== 6) this.nextPlayer();
      return { player: playerIdx, token: tokenIndex, dice, position: pos, finished: this.finished };
    } else {
      this.nextPlayer();
      return { player: playerIdx, dice, token: -1, position: null, finished: this.finished };
    }
  }
}
