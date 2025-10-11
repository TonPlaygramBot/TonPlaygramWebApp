import { computeRFit, rad } from '../webapp/src/pages/Games/simpleOrbitCamera';

describe('computeRFit', () => {
  it('fits standard portrait viewport with default theta', () => {
    const result = computeRFit(1600, 720, 3.6, 7.2, rad(35));
    expect(result).toBeCloseTo(10.0938048563, 6);
  });

  it('fits larger viewport with steeper pitch', () => {
    const result = computeRFit(1920, 1080, 3.6, 7.2, rad(45));
    expect(result).toBeCloseTo(11.6932280989, 6);
  });
});
