import { consumeSnookerPhysicsTime } from '../webapp/src/games/snooker/physicsClock';
test.each([30, 60, 90, 120, 144])(
  'identical simulation at %i render FPS',
  (fps) => {
    const clock = { remainderMs: 0 };
    let steps = 0,
      x = 0,
      v = 10;
    for (let frame = 0; frame < fps * 2; frame++) {
      const tick = consumeSnookerPhysicsTime(clock, 1000 / fps);
      steps += tick.steps;
      for (let i = 0; i < tick.steps; i++) {
        v *= Math.pow(0.98, tick.stepScale);
        x += v * tick.stepScale;
      }
    }
    expect(steps).toBe(240);
    // Same reference integration for every render rate.
    let expected = 0,
      speed = 10;
    for (let i = 0; i < 240; i++) {
      speed *= Math.sqrt(0.98);
      expected += speed * 0.5;
    }
    expect(x).toBeCloseTo(expected, 8);
    expect(v).toBeCloseTo(speed, 8);
  }
);
test('background pauses have a bounded catch-up and bad timestamps never advance', () => {
  const clock = { remainderMs: 0 };
  expect(consumeSnookerPhysicsTime(clock, 60000).steps).toBe(12);
  expect(consumeSnookerPhysicsTime(clock, NaN).steps).toBe(0);
  expect(consumeSnookerPhysicsTime(clock, -10).steps).toBe(0);
});
