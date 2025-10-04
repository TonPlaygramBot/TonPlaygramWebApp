// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - legacy rule set ships as JS without type defs
import { UkPool, DEFAULT_RULES as DEFAULT_UK_RULES } from '../../../../../lib/poolUk8Ball.js';

export class PoolUk8RulesAdapter {
  private readonly game: any;

  constructor(rules = {}) {
    this.game = new UkPool({ ...DEFAULT_UK_RULES, ...rules });
  }

  startBreak() {
    this.game.startBreak();
  }

  takeShot(shot: any) {
    return this.game.shotTaken(shot);
  }

  getState() {
    return this.game.state;
  }
}

export function createPoolUk8Rules(rules = {}) {
  return new PoolUk8RulesAdapter(rules);
}
