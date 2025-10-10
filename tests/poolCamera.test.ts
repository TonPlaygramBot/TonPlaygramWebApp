import { computeRFit, degToRad } from '../webapp/src/lib/poolMath';

describe('pool camera helpers', () => {
  test('computeRFit keeps full table width visible on tall portrait screens', () => {
    const rFit = computeRFit(1600, 720, 2.84, 1.42, degToRad(35));
    expect(rFit).toBeGreaterThan(7.24);
    expect(rFit).toBeLessThan(7.25);
  });

  test('computeRFit shrinks for wider aspect while honoring height bound', () => {
    const tightTheta = degToRad(45);
    const rFit = computeRFit(1280, 720, 2.84, 1.42, tightTheta);
    expect(rFit).toBeGreaterThan(5.79);
    expect(rFit).toBeLessThan(5.8);
  });
});
