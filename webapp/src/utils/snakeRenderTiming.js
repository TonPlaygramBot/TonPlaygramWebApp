// Keep FPS throttling separate from animation time. Throttle carry is scheduling
// credit, not elapsed time: adding it to animation delta speeds up low-FPS phones.
export function createSnakeFrameClock() {
  let lastTick = null;
  let lastRender = null;
  let carry = 0;

  return {
    reset() {
      lastTick = null;
      lastRender = null;
      carry = 0;
    },
    next(now, frameRate) {
      if (!Number.isFinite(now)) return null;
      const fps = Number.isFinite(frameRate) ? Math.max(30, frameRate) : 60;
      const interval = 1000 / fps;
      if (lastTick === null) {
        lastTick = lastRender = now;
        return 0;
      }
      carry = Math.min(carry + Math.max(0, now - lastTick), interval * 2);
      lastTick = now;
      if (carry + 0.0001 < interval) return null;
      carry = Math.max(0, carry - interval * Math.floor((carry + 0.0001) / interval));
      const delta = Math.min(0.2, Math.max(0, now - lastRender) / 1000);
      lastRender = now;
      return delta;
    }
  };
}

export function updateSnakeHdriZoom(state, distance) {
  const texture = state.texture;
  if (!texture || !Number.isFinite(distance) || distance <= 0) return;
  if (!state.baseDistance) state.baseDistance = distance;
  const zoom = 1 / Math.max(0.7, Math.min(1.4, distance / state.baseDistance));
  if (Math.abs(texture.repeat.x - zoom) < 0.0001) return;
  texture.repeat.set(zoom, zoom);
  texture.offset.set((1 - zoom) / 2, (1 - zoom) / 2);
  // UV transforms update through the texture matrix. Setting needsUpdate here
  // reuploads the HDRI and invalidates Three's environment cache every frame.
}
