import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi } from 'vitest';
const harness = vi.hoisted(() => ({ frame: null, world: null, mounts: 0 }));
vi.mock('./Scene', () => ({
  default: function Scene(props) {
    harness.frame = props.onFrame;
    harness.world = props.world;
    React.useEffect(() => {
      harness.mounts++;
      props.onReady?.();
    }, []);
    return <div data-testid="scene" />;
  }
}));
vi.mock('./audio', () => ({
  JetskiAudio: class {
    unlock() {
      return Promise.resolve();
    }
    setEnabled() {}
    update() {}
    cue() {}
    close() {}
  }
}));
import JetskiGame from './Game';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const click = async (host, text) => {
  const b = [...host.querySelectorAll('button')].find((x) =>
    x.textContent.includes(text)
  );
  expect(b).toBeTruthy();
  await act(async () => b.click());
};
it('launches, counts down, pauses and restarts the exact same game without stuck loading', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<JetskiGame preview />));
    expect(host.querySelector('.jsr-lobby')).toBeTruthy();
    await click(host, 'Race the coast');
    expect(host.querySelector('.jsr-countdown')).toBeTruthy();
    for (let i = 0; i < 35; i++) await act(async () => harness.frame(0.1));
    expect(host.querySelector('[aria-label="Throttle"]')).toBeTruthy();
    const camera = host.querySelector('[aria-label="Rider eye camera"]');
    await act(async () => camera.click());
    expect(camera.getAttribute('aria-pressed')).toBe('true');
    expect(harness.world.current.camera).toBe('eyes');
    await act(async () => camera.click());
    expect(harness.world.current.camera).toBe('chase');
    await act(async () =>
      host.querySelector('[aria-label="Pause and settings"]').click()
    );
    expect(host.querySelector('.jsr-modal').textContent).toContain('Paused');
    const elapsed = harness.world.current.elapsed;
    await act(async () => harness.frame(0.1));
    expect(harness.world.current.elapsed).toBe(elapsed);
    await click(host, 'Continue racing');
    harness.world.current.racers[0].finished = true;
    harness.world.current.racers[0].finishTime = 63;
    await act(async () => harness.frame(0.1));
    expect(host.querySelector('.jsr-results')).toBeTruthy();
    await click(host, 'Race again');
    expect(host.querySelector('.jsr-countdown')).toBeTruthy();
    expect(harness.world.current.racers[0].finished).toBe(false);
    expect(harness.mounts).toBe(3);
    for (let i = 0; i < 35; i++) await act(async () => harness.frame(0.1));
    await act(async () =>
      host
        .querySelector('[aria-label="Throttle"]')
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
        )
    );
    await act(async () => harness.frame(0.1));
    expect(harness.world.current.racers[0].input.throttle).toBe(true);
    await act(async () => window.dispatchEvent(new Event('blur')));
    await act(async () => harness.frame(0.1));
    expect(harness.world.current.racers[0].input.throttle).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
it('preview makes the deployment requirement explicit and does not simulate online opponents', async () => {
  const host = document.createElement('div'),
    root = createRoot(host);
  document.body.append(host);
  try {
    await act(async () => root.render(<JetskiGame preview />));
    await click(host, 'Online');
    expect(host.textContent).toContain('after deployment');
    await click(host, 'Create room');
    expect(host.querySelector('[role="alert"]').textContent).toContain(
      'Online rooms are available inside TonPlayGram'
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it('saves and replays the best time trial without adding the ghost to the race', async () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  document.body.append(host);
  const storageKey = 'jetski.ghost.v1.karaburun.pulse';
  localStorage.removeItem(storageKey);
  try {
    await act(async () => root.render(<JetskiGame preview />));
    await click(host, 'Karaburun Headland');
    await click(host, 'Time trial');
    await click(host, 'Start time trial');
    for (let i = 0; i < 39; i++) await act(async () => harness.frame(0.1));
    expect(harness.world.current.ghost).toBeNull();

    const player = harness.world.current.racers[0];
    player.finished = true;
    player.finishTime = 42;
    await act(async () => harness.frame(0.1));
    const saved = JSON.parse(localStorage.getItem(storageKey));
    expect(saved.time).toBe(42);

    await click(host, 'Race again');
    const [x, z] = saved.frames[0];
    expect(harness.world.current.ghost).toMatchObject({ x, z });
    expect(harness.world.current.racers).toHaveLength(1);
    for (let i = 0; i < 39; i++) await act(async () => harness.frame(0.1));
    const nextPlayer = harness.world.current.racers[0];
    nextPlayer.finished = true;
    nextPlayer.finishTime = 50;
    await act(async () => harness.frame(0.1));
    expect(JSON.parse(localStorage.getItem(storageKey)).time).toBe(42);
  } finally {
    await act(async () => root.unmount());
    localStorage.removeItem(storageKey);
    localStorage.removeItem('jetski.best.karaburun');
    host.remove();
  }
});
