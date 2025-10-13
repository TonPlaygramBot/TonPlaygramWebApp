import { computeRFit, rad } from '../webapp/src/pages/Games/simpleOrbitCamera';

describe('computeRFit', () => {
  it('fits standard portrait viewport with default theta', () => {
    const result = computeRFit(1600, 720, 3.6, 7.2, rad(35));
    expect(result).toBeCloseTo(9.7559309963, 6);
  });

  it('fits larger viewport with steeper pitch', () => {
    const result = computeRFit(1920, 1080, 3.6, 7.2, rad(45));
    expect(result).toBeCloseTo(11.301816122, 6);
  });
});
