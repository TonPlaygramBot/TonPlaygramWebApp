export const FINAL_TILE = 101;

export function applySnakesAndLadders(pos, snakes, ladders) {
  if (snakes[pos] != null) return Math.max(0, snakes[pos]);
  const ladder = ladders[pos];
  if (ladder != null) return typeof ladder === 'object' ? ladder.end : ladder;
  return pos;
}

export class SnakeGame {
  constructor({ snakes = {}, ladders = {}, diceCells = {} } = {}) {
    this.snakes = snakes;
    this.ladders = ladders;
    this.diceCells = diceCells;
    this.players = [];
    this.currentTurn = 0;
    this.finished = false;
  }

  addPlayer(id, name) {
    this.players.push({
      id,
      name,
      position: 0,
      diceCount: 2,
      isActive: false,
    });
  }

  nextPlayerIndex(start) {
    let idx = start;
    do {
      idx = (idx + 1) % this.players.length;
    } while (this.players[idx].position === FINAL_TILE);
    return idx;
  }

  rollDice(diceValues) {
    if (this.finished) return null;
    const player = this.players[this.currentTurn];
    if (!player) return null;

    const dice = Array.isArray(diceValues)
      ? diceValues.map((v) => Math.max(1, Math.min(6, Math.floor(v))))
      : [Math.floor(Math.random() * 6) + 1];
    const total = dice.reduce((a, b) => a + b, 0);
    const rolledSix = dice.includes(6);
    const doubleSix = dice.length === 2 && dice[0] === 6 && dice[1] === 6;

    let target = player.position;

    if (player.position === 0) {
      if (rolledSix) {
        player.isActive = true;
        target = 1;
      }
    } else if (player.position === 100) {
      if (player.diceCount === 2) {
        if (rolledSix) player.diceCount = 1;
      } else if (total === 1) {
        target = FINAL_TILE;
      }
    } else if (player.position < FINAL_TILE) {
      if (player.position + total <= FINAL_TILE) {
        target = player.position + total;
      }
    }

    const path = [];
    for (let i = player.position + 1; i <= target; i++) path.push(i);

    player.position = target;
    let final = applySnakesAndLadders(target, this.snakes, this.ladders);
    if (final !== target) path.push(final);
    player.position = final;

    // Capture opponents
    for (const p of this.players) {
      if (p !== player && p.position === player.position && p.position > 0) {
        p.position = 0;
        p.diceCount = 2;
        p.isActive = false;
      }
    }

    let extraTurn = false;
    let bonus = null;
    let bonusCell = null;
    if (this.diceCells[player.position]) {
      bonus = this.diceCells[player.position];
      bonusCell = player.position;
      player.bonus = bonus;
      delete this.diceCells[player.position];
      extraTurn = true;
    } else if (doubleSix) {
      extraTurn = true;
    }

    if (player.position === FINAL_TILE) {
      this.finished = true;
    }

    if (!extraTurn && !this.finished) {
      this.currentTurn = this.nextPlayerIndex(this.currentTurn);
    }

    return {
      player: player.id,
      dice,
      path,
      position: player.position,
      extraTurn,
      finished: this.finished,
      bonus,
      bonusCell,
    };
  }
}
