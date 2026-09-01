import { getSnookerShotPowerFeedback } from '../webapp/src/pages/Games/snookerShotCoach.js';

describe('Snooker Royal shot coach', () => {
  test.each([
    [-1, 'ready', 'Pull down'],
    [0.12, 'soft', 'Soft touch'],
    [0.5, 'control', 'Controlled'],
    [0.9, 'power', 'Power shot'],
    [2, 'power', 'Power shot']
  ])('maps %p power to clear feedback', (power, tone, label) => {
    expect(getSnookerShotPowerFeedback(power)).toMatchObject({ tone, label });
  });

  test('handles invalid power without exposing NaN', () => {
    expect(getSnookerShotPowerFeedback(Number.NaN)).toEqual({
      label: 'Pull down',
      detail: 'Release to shoot',
      tone: 'ready'
    });
  });
});
