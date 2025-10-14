import { PowerSlider } from './power-slider.js';

export class SnookerPowerSlider extends PowerSlider {
  constructor(opts = {}) {
    super({ ...opts, theme: 'snooker' });
  }
}
