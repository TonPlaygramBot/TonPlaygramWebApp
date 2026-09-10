import {
  deliverOrQueueSnookerShot,
  drainQueuedSnookerShot
} from '../webapp/src/pages/Games/snookerShotRelease.js';

describe('Snooker Royal shot release', () => {
  test('fires immediately after the scene handler is ready', () => {
    const fire = jest.fn();
    const pendingRef = { current: null };

    expect(deliverOrQueueSnookerShot({ fire, power: 0.72, pendingRef })).toBe(true);
    expect(fire).toHaveBeenCalledWith(0.72);
    expect(pendingRef.current).toBeNull();
  });

  test('preserves a portrait touch release until scene setup finishes', () => {
    const pendingRef = { current: null };
    const fire = jest.fn();

    expect(deliverOrQueueSnookerShot({ fire: null, power: 0.64, pendingRef })).toBe(false);
    expect(pendingRef.current).toBe(0.64);
    expect(drainQueuedSnookerShot({ fire, pendingRef })).toBe(true);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(fire).toHaveBeenCalledWith(0.64);
    expect(pendingRef.current).toBeNull();
  });

  test('does not queue an empty release', () => {
    const pendingRef = { current: null };

    expect(deliverOrQueueSnookerShot({ fire: null, power: 0, pendingRef })).toBe(false);
    expect(pendingRef.current).toBeNull();
  });
});
