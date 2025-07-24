import { SnakeGame, applySnakesAndLadders, FINAL_TILE } from '../../../bot/logic/snakeGame.js';

export class SnakeEngine {
  constructor({ snakes = {}, ladders = {}, diceCells = {} } = {}) {
    this.game = new SnakeGame({ snakes, ladders, diceCells });
  }

  addPlayer(id, name) {
    this.game.addPlayer(id, name);
  }

  applyBoard(snakes = {}, ladders = {}, diceCells = {}) {
    this.game.snakes = snakes;
    this.game.ladders = ladders;
    this.game.diceCells = diceCells;
  }

  rollDice(values) {
    return this.game.rollDice(values);
  }

  takeTurn(playerId, diceValues) {
    const idx = this.game.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return null;
    this.game.currentTurn = idx;
    return this.rollDice(diceValues);
  }

  getState() {
    return {
      players: this.game.players,
      currentTurn: this.game.currentTurn,
      finished: this.game.finished,
      snakes: this.game.snakes,
      ladders: this.game.ladders,
      diceCells: this.game.diceCells,
    };
  }
}

export { applySnakesAndLadders, FINAL_TILE };
