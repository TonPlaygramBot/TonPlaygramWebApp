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

  rollDice(diceValue) {
    if (this.finished) return null;
    const player = this.players[this.currentTurn];
    if (!player) return null;

    const rand = () => Math.floor(Math.random() * 6) + 1;
    const normalizeDie = (value) => {
      const n = Number(value);
      return Number.isFinite(n)
        ? Math.max(1, Math.min(6, Math.floor(n)))
        : null;
    };

    const dice = Array.isArray(diceValue)
      ? diceValue.slice(0, 2).map(normalizeDie).map((v) => v ?? rand())
      : (() => {
          const parsed = normalizeDie(diceValue);
          if (parsed != null) return [parsed];
          return [rand(), rand()];
        })();

    const total = dice.reduce((sum, value) => sum + value, 0);
    let target = player.position;
    let extraTurn = false;

    if (player.position === 0) {
      if (dice.includes(6)) {
        player.isActive = true;
        target = 1;
      }
    } else if (player.position < FINAL_TILE) {
      if (player.position + total <= FINAL_TILE) {
        target = player.position + total;
      }
    }

    const path = [];
    for (let i = player.position + 1; i <= target; i++) path.push(i);

    player.position = target;
    const final = applySnakesAndLadders(target, this.snakes, this.ladders);
    if (final !== target) path.push(final);
    player.position = final;

    for (const p of this.players) {
      if (p !== player && p.position === player.position && p.position > 0) {
        p.position = 0;
        p.isActive = false;
      }
    }

    let bonus = null;
    let bonusCell = null;
    if (this.diceCells[player.position]) {
      bonus = this.diceCells[player.position];
      bonusCell = player.position;
      player.bonus = bonus;
      delete this.diceCells[player.position];
      extraTurn = true;
    } else if (dice.includes(6)) {
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
