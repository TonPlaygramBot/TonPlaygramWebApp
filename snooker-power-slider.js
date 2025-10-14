import { PowerSlider } from './power-slider.js';
import { SNOOKER_CUE_DATA_URI } from './snooker-cue-data-uri.js';

export class SnookerPowerSlider extends PowerSlider {
  constructor(opts = {}) {
    const { cueSrc = SNOOKER_CUE_DATA_URI, ...rest } = opts;
    super({ ...rest, cueSrc, theme: 'snooker' });
  }
}
