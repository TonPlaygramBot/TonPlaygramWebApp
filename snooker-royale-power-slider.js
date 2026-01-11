import { PowerSlider } from './power-slider.js';

export class SnookerRoyalePowerSlider extends PowerSlider {
  constructor(opts = {}) {
    super({ ...opts, theme: 'snooker-royale' });
  }
}
