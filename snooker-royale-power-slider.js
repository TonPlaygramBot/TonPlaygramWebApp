import { PowerSlider } from './power-slider.js';

export class SnookerRoyalPowerSlider extends PowerSlider {
  constructor(opts = {}) {
    super({ ...opts, theme: 'snooker-royale' });
  }
}
