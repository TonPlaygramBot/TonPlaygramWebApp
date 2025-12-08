import { PowerSlider } from './power-slider.js';

export class PoolRoyalePowerSlider extends PowerSlider {
  constructor(opts = {}) {
    super({ ...opts, theme: 'pool-royale' });
  }
}
