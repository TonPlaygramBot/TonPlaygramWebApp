import { getPowerFeedbackBand } from '../power-slider.js';

describe('portrait power slider feedback bands', () => {
  test.each([
    [0, 0],
    [24.9, 0],
    [25, 1],
    [50, 2],
    [75, 3],
    [90, 4],
    [150, 4]
  ])('maps %p power to tactile band %p', (power, expectedBand) => {
    expect(getPowerFeedbackBand(power)).toBe(expectedBand);
  });

  test('handles custom ranges and invalid input safely', () => {
    expect(getPowerFeedbackBand(15, 10, 30)).toBe(1);
    expect(getPowerFeedbackBand(Number.NaN)).toBe(0);
    expect(getPowerFeedbackBand(10, 10, 10)).toBe(0);
  });
});
