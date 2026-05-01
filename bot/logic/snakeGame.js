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
    const provided = Number(diceValue);
    const dice = Number.isFinite(provided)
      ? Math.max(1, Math.min(6, Math.floor(provided)))
      : rand();

    let target = player.position;
    let extraTurn = false;

    if (player.position === 0) {
      if (dice === 6) {
        player.isActive = true;
        target = 1;
      }
    } else if (player.position < FINAL_TILE) {
      if (player.position + dice <= FINAL_TILE) {
        target = player.position + dice;
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
    } else if (dice === 6) {
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
      dice: [dice],
      path,
      position: player.position,
      extraTurn,
      finished: this.finished,
      bonus,
      bonusCell,
    };
  }

}
