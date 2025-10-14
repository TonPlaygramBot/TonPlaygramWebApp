import { FrameState, ShotContext, ShotEvent } from '../types';
import { PoolRoyaleRules } from './PoolRoyaleRules';

type PoolVariantKey = 'american' | 'uk' | '9ball';

class PoolVariantAdapter {
  protected readonly rules: PoolRoyaleRules;
  readonly variant: PoolVariantKey;

  constructor(variant: PoolVariantKey) {
    this.variant = variant;
    this.rules = new PoolRoyaleRules(variant);
  }

  getInitialFrame(playerA: string, playerB: string): FrameState {
    return this.rules.getInitialFrame(playerA, playerB);
  }

  applyShot(state: FrameState, events: ShotEvent[], context?: ShotContext): FrameState {
    return this.rules.applyShot(state, events, context);
  }
}

export class AmericanBilliardsRules extends PoolVariantAdapter {
  constructor() {
    super('american');
  }
}

export class NineBallRules extends PoolVariantAdapter {
  constructor() {
    super('9ball');
  }
}

export class UkEightBallRules extends PoolVariantAdapter {
  constructor() {
    super('uk');
  }
}

export type { PoolVariantKey };
export default PoolVariantAdapter;
