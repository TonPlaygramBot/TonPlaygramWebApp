// Append-only replay engine for funded snake-server-single-die-v1 journals.
// Do not edit semantics in place: add a new version and new offer acceptance.
const SNAKE_FINAL_TILE = 50;
function resolveSnakeRoll(position, dice, finalTile) {
  const values = (Array.isArray(dice) ? dice : [dice]).map(Number);
  const valid = values.length > 0 && values.every(value => Number.isInteger(value) && value >= 1 && value <= 6);
  const total = valid ? values.reduce((sum, value) => sum + value, 0) : 0;
  const enters = valid && values.includes(6); const extraTurn = valid && values.every(value => value === 6);
  const landing = position === 0 ? enters ? 1 : 0 : position < finalTile && position + total <= finalTile ? position + total : position;
  return { total, enters, extraTurn, landing, moved: landing !== position };
}

export const FINAL_TILE = SNAKE_FINAL_TILE;

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
    // A disconnected seat must not stall the remaining players. Bound the
    // search so an empty room (or one with no eligible seats) cannot loop.
    for (let step = 1; step <= this.players.length; step += 1) {
      const idx = (start + step) % this.players.length;
      const player = this.players[idx];
      if (!player.disconnected && player.position !== FINAL_TILE) return idx;
    }
    return start;
  }

  rollDice(diceValue) {
    if (this.finished) return null;
    const player = this.players[this.currentTurn];
    if (!player || player.disconnected) return null;

    const dice = Array.isArray(diceValue) ? diceValue : [diceValue];
    if (dice.length !== 1 || !Number.isInteger(dice[0]) || dice[0] < 1 || dice[0] > 6) throw new Error('invalid_v1_die');
    const resolution = resolveSnakeRoll(player.position, dice, FINAL_TILE);
    const target = resolution.landing;
    let extraTurn = resolution.extraTurn;
    if (player.position === 0 && resolution.moved) player.isActive = true;

    const path = [];
    for (let i = player.position + 1; i <= target; i++) path.push(i);

    player.position = target;
    const final = resolution.moved ? applySnakesAndLadders(target, this.snakes, this.ladders) : target;
    if (final !== target) path.push(final);
    player.position = final;

    for (const p of this.players) {
      if (resolution.moved && p !== player && p.position === player.position && p.position > 0) {
        p.position = 0;
        p.isActive = false;
      }
    }

    let bonus = null;
    let bonusCell = null;
    if (resolution.moved && this.diceCells[player.position]) {
      bonus = this.diceCells[player.position];
      bonusCell = player.position;
      player.bonus = bonus;
      delete this.diceCells[player.position];
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
      landing: target,
      position: player.position,
      extraTurn,
      finished: this.finished,
      bonus,
      bonusCell,
    };
  }

}
