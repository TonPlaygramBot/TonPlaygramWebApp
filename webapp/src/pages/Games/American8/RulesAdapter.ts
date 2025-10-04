// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - american billiards logic is provided as plain JS
import { AmericanBilliards } from '../../../../../lib/americanBilliards.js';

export class AmericanEightRulesAdapter {
  private readonly game: any;

  constructor() {
    this.game = new AmericanBilliards();
  }

  takeShot(shot: any) {
    return this.game.shotTaken(shot);
  }

  getState() {
    return this.game.state;
  }
}

export function createAmericanEightRules() {
  return new AmericanEightRulesAdapter();
}
