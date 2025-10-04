// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - nine ball rule implementation is legacy JS
import { NineBall } from '../../../../../lib/nineBall.js';

export class NineBallRulesAdapter {
  private readonly game: any;

  constructor() {
    this.game = new NineBall();
  }

  takeShot(shot: any) {
    return this.game.shotTaken(shot);
  }

  getState() {
    return this.game.state;
  }
}

export function createNineBallRules() {
  return new NineBallRulesAdapter();
}
