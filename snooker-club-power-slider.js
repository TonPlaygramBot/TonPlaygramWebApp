import { PowerSlider } from './power-slider.js';

export class SnookerClubPowerSlider extends PowerSlider {
  constructor(opts = {}) {
    super({ ...opts, theme: 'snooker-club' });
  }
}
