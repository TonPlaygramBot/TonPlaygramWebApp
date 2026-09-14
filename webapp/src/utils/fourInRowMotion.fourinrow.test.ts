import { expect, it } from 'vitest';
import { advanceHumanPlacement, RELEASE_TIME } from '../games/fourinrow/humanPresentation';
import { Group, Vector3 } from 'three';
import { advanceFourInRowDrop, consumeFourInRowFrame, getFourInRowDropDuration, type FourInRowDrop } from './fourInRowMotion';

it.each([30, 60, 90, 120, 144, 240])('finishes a drop on a %i Hz screen without snapping or duplicate impacts', (refreshRate) => {
  const entry: FourInRowDrop = {
    mesh: new Group(), columnTop: new Vector3(0, 6, 0), target: new Vector3(0, 0, 0),
    elapsed: 0, phase: 'preview', previewDuration: 0.04,
    dropDuration: getFourInRowDropDuration(6), bounceHeight: 0.2
  };
  const clock = { pending: 0 };
  let impacts = 0, finished = false, intermediate = false, updates = 0;
  for (let frame = 0; frame < refreshRate * 2; frame++) {
    const delta = consumeFourInRowFrame(clock, 1 / refreshRate, 60);
    if (!delta) continue;
    updates++;
    const result = advanceFourInRowDrop(entry, delta);
    impacts += Number(result.landed);
    if (entry.mesh.position.y > 0.1 && entry.mesh.position.y < 5.9) intermediate = true;
    expect(entry.mesh.position.y).toBeGreaterThanOrEqual(0);
    if (result.finished) { finished = true; break; }
  }
  expect(updates).toBeGreaterThan(10);
  expect(intermediate).toBe(true);
  expect(finished).toBe(true);
  expect(impacts).toBe(1);
  expect(entry.mesh.position.equals(entry.target)).toBe(true);
  expect(entry.mesh.scale.toArray()).toEqual([1, 1, 1]);
});
it('gives lower slots a longer fall and absorbs a suspended-tab delta', () => {
  expect(getFourInRowDropDuration(6)).toBeGreaterThan(getFourInRowDropDuration(1));
  expect(consumeFourInRowFrame({ pending: 0 }, 100, 60)).toBe(0.1);
});

it.each([1, 2])('keeps chips above their targets and serializes a queue of %i moves in the actual scene loop', async (queueLength) => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync('src/pages/Games/FourInRowRoyal.jsx', 'utf8');
  const start = source.indexOf('    const animate = () => {');
  const loop = source.slice(start, source.indexOf('\n    animate();', start));
  const mesh = new Group();
  mesh.position.y = 6; mesh.userData = { isFalling: true, baseY: 0 };
  const drops = { current: [{ mesh, columnTop: new Vector3(0, 6, 0), target: new Vector3(), elapsed: 0, phase: 'preview', previewDuration: 0.04, dropDuration: 0.45, bounceHeight: 0.2, token: 'player', from: new Vector3(0, 6, 0), motionTime: RELEASE_TIME, released: true, chipRadius: 0.2, chipThickness: 0.1 }] };
  const queued = { ...drops.current[0], mesh: new Group(), motionTime: 0, released: false };
  if (queueLength === 2) drops.current.push(queued);
  let released = 0, impacts = 0, humanInstalls = 0;
  const deps = {
    requestAnimationFrame: () => 1, frameClock: { pending: 0 },
    consumeFourInRowFrame, advanceHumanPlacement, pendingHumansRef: { current: () => { humanInstalls++; } },
    animationClockRef: { current: { getDelta: () => 1 / 120, elapsedTime: 0 } },
    graphicsPresetRef: { current: { fps: 60 } }, fallingPiecesRef: drops,
    playChipDropFx: () => { impacts++; }, setPresentationBusy: () => { released++; },
    winningCellsRef: { current: [] }, piecesMapRef: { current: new Map([['5-0', mesh]]) },
    controls: { update() {} }, applyCameraLookTarget() {}, markerRef: { current: null },
    renderer: { render() {} }, scene: {}, perspective: {}
  };
  const animate = new Function(...Object.keys(deps), `let raf; ${loop}; return animate;`)(...Object.values(deps));
  for (let frame = 0; frame < 20; frame++) animate();
  expect(mesh.position.y).toBeGreaterThan(0);
  expect(mesh.position.y).toBeLessThan(6);
  expect(released).toBe(0);
  expect(queued.motionTime).toBe(0);
  expect(humanInstalls).toBe(0);
  for (let frame = 0; frame < 120; frame++) animate();
  expect(mesh.position.y).toBe(0);
  expect(impacts).toBe(1);
  expect(released).toBe(queueLength === 1 ? 1 : 0);
  for (let frame = 0; frame < 400; frame++) animate();
  expect(impacts).toBe(queueLength);
  expect(released).toBe(1);
  expect(humanInstalls).toBe(1);
});
