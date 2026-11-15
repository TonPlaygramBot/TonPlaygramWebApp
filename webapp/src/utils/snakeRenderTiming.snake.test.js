import { describe, expect, it, vi } from 'vitest';
import { Texture } from 'three';
import { createSnakeFrameClock, updateSnakeHdriZoom } from './snakeRenderTiming';

describe('Snake render timing', () => {
  it.each([[60, 90], [120, 50], [90, 60], [60, 30]])('keeps animation time at real speed on a %i Hz display with a %i FPS limit', (displayHz, limit) => {
    const clock = createSnakeFrameClock();
    let elapsed = 0;
    let rendered = 0;
    for (let frame = 0; frame <= displayHz * 10; frame += 1) {
      const delta = clock.next(frame * 1000 / displayHz, limit);
      if (delta !== null) { elapsed += delta; rendered += 1; }
    }
    expect(elapsed).toBeCloseTo(10, 1);
    expect(rendered).toBeLessThanOrEqual(Math.min(displayHz, limit) * 10 + 2);
  });

  it('caps background gaps and restarts without carrying stale time', () => {
    const clock = createSnakeFrameClock();
    expect(clock.next(0, 60)).toBe(0);
    expect(clock.next(60_000, 60)).toBe(0.2);
    clock.reset();
    expect(clock.next(120_000, 60)).toBe(0);
    expect(clock.next(NaN, 60)).toBeNull();
  });
});

describe('Snake HDRI transforms', () => {
  it('updates zoom without reuploading HDR image data or changing texture version', () => {
    const texture = new Texture();
    const repeat = vi.spyOn(texture.repeat, 'set');
    const state = { texture, baseDistance: null };
    updateSnakeHdriZoom(state, 10);
    updateSnakeHdriZoom(state, 12);
    expect(texture.repeat.x).toBeCloseTo(1 / 1.2);
    expect(texture.offset.x).toBeCloseTo((1 - 1 / 1.2) / 2);
    const updates = repeat.mock.calls.length;
    for (let frame = 0; frame < 120; frame += 1) updateSnakeHdriZoom(state, 12);
    expect(repeat).toHaveBeenCalledTimes(updates);
    expect(texture.version).toBe(0);
    texture.dispose();
  });
});
