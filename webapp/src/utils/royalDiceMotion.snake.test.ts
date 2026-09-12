import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createRoyalDiceMotion, ROYAL_DICE_ROLL_MS } from './royalDiceMotion';
import { createSnakePresentationQueue } from './snakePresentationQueue';

it.each([30, 60, 90])('lands on the requested face at %i Hz', fps => {
  const die = new THREE.Object3D();
  const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  const landing = new THREE.Vector3(1, .1, 0);
  const motion = createRoyalDiceMotion(die, new THREE.Vector3(0, .2, 2), landing, { startedAt: 0, target });
  for (let time = 0; time < ROYAL_DICE_ROLL_MS; time += 1000 / fps) motion.update(time);
  expect(motion.update(ROYAL_DICE_ROLL_MS)).toBe(true);
  expect(die.position.distanceTo(landing)).toBeLessThan(1e-10);
  expect(die.quaternion.angleTo(target)).toBeLessThan(1e-6);
});
it('has identical mid-throw motion at different refresh rates', () => {
  vi.spyOn(Math, 'random').mockReturnValue(.5);
  const poses = [30, 60, 90].map(fps => {
    const die = new THREE.Object3D();
    const motion = createRoyalDiceMotion(die, new THREE.Vector3(0,.2,1), new THREE.Vector3(1,.1,0), { startedAt: 0 });
    for (let time = 0; time < 500; time += 1000 / fps) motion.update(time);
    motion.update(500);
    return die;
  });
  expect(poses[0].position.distanceTo(poses[2].position)).toBe(0);
  expect(poses[0].quaternion.angleTo(poses[2].quaternion)).toBeLessThan(1e-6);
  vi.restoreAllMocks();
});
it('honors reduced motion and a late authoritative target', () => {
  const die = new THREE.Object3D();
  const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI,0,0));
  const motion = createRoyalDiceMotion(die,new THREE.Vector3(),new THREE.Vector3(1,0,0),{startedAt:0,reducedMotion:true});
  motion.update(400);
  expect(die.position.y).toBe(0);
  motion.setTarget(target);
  motion.update(980);
  expect(die.quaternion.angleTo(target)).toBeLessThan(1e-6);
});
it('queues movement and snapshots behind the die and cancels queued work on leave', async () => {
  const events: string[] = [];
  let land!: () => void;
  const queue = createSnakePresentationQueue();
  queue.enqueue(async () => { events.push('rolling'); await new Promise<void>(resolve => { land = resolve; }); events.push('landed'); });
  queue.enqueue(() => events.push('move'));
  const done = queue.enqueue(() => events.push('snapshot'));
  await Promise.resolve();
  expect(events).toEqual(['rolling']);
  land(); await done;
  expect(events).toEqual(['rolling','landed','move','snapshot']);
  queue.dispose();
  await queue.enqueue(() => events.push('stale'));
  expect(events).not.toContain('stale');
});
