import { describe, expect, it } from 'vitest';
import { Group, Object3D, PerspectiveCamera, Vector3 } from 'three';
import { createSnakeCameraDirector, frameSnakeAction, SnakeCameraShot } from './snakeCameraDirector';

const home = new Vector3(0, 3, 6);
const homeTarget = new Vector3(0, 0.8, 0);
function setup(aspect = 390 / 844) {
  const camera = new PerspectiveCamera(52, aspect, 0.1, 100);
  camera.position.copy(home);
  const target = homeTarget.clone();
  return { camera, target, director: createSnakeCameraDirector(camera, target) };
}
function visible(camera: PerspectiveCamera, points: Vector3[]) {
  camera.updateMatrixWorld(true);
  for (const point of points) {
    const ndc = point.clone().project(camera);
    expect(Math.abs(ndc.x)).toBeLessThanOrEqual(0.721);
    expect(Math.abs(ndc.y)).toBeLessThanOrEqual(0.551);
    expect(ndc.z).toBeGreaterThan(-1);
    expect(ndc.z).toBeLessThan(1);
  }
}
const makeShot = (id: string, points: () => Vector3[], priority = 2): SnakeCameraShot => ({
  id, points, priority, radius: 0.16, minDistance: 1.5
});

describe('portrait action camera', () => {
  it.each([30, 60, 90])('keeps dice, entry, steps, ladders and capture visible at %i Hz', fps => {
    const { camera, director } = setup();
    // Translated, scaled and rotated board: local coordinates are not camera targets.
    const board = new Group();
    board.position.set(0, 0.8, 0); board.scale.set(1.8, 1.5, 1.8); board.rotation.y = 0.7;
    const subject = new Object3D(); board.add(subject);
    const world = new Vector3(), end = new Vector3();
    const routes = [
      [new Vector3(-1.5,0.1,1.5), new Vector3(-1,0.1,0.7)], // die
      [new Vector3(-1.4,0,0.8), new Vector3(-0.6,0,-0.6)], // entry
      [new Vector3(-0.6,0,-0.6), new Vector3(0.6,0,-0.6)], // far row
      [new Vector3(0.6,0,-0.6), new Vector3(-0.2,0.7,0.2)], // ladder
      [new Vector3(-0.2,0.7,0.2), new Vector3(0.6,0,-0.6)], // snake
      [new Vector3(-1.2,0.5,0.6), new Vector3(0.3,1.5,-0.4)] // capture
    ];
    let clock = 0;
    routes.forEach(([from, to], index) => {
      subject.position.copy(from);
      const points = () => [subject.getWorldPosition(world), board.localToWorld(end.copy(to))];
      director.start(makeShot(String(index), points), clock, home, homeTarget);
      for (let elapsed = 0; elapsed <= 1100; elapsed += 1000 / fps) {
        const t = elapsed / 1100;
        subject.position.lerpVectors(from, to, t); subject.position.y += Math.sin(t * Math.PI) * 0.2;
        director.update(clock + elapsed, home, homeTarget);
        visible(camera, points());
      }
      clock += 1100;
      director.finish(String(index), clock);
    });
    expect(camera.position.distanceTo(home)).toBeGreaterThan(1);
  });

  it('fits tall and wide actions after portrait/landscape resize, including mesh extents', () => {
    const { camera, director } = setup();
    const points = [new Vector3(-2,0.8,1), new Vector3(2,3,-1)];
    director.start(makeShot('flight', () => points), 0, home, homeTarget);
    [320/932, 430/740, 932/430].forEach((aspect, index) => {
      camera.aspect = aspect; camera.updateProjectionMatrix();
      director.update(100 + index * 200, home, homeTarget);
      visible(camera, points.flatMap(p => [-1,1].flatMap(x => [-1,1].flatMap(y => [-1,1].map(z =>
        p.clone().add(new Vector3(x,y,z).multiplyScalar(0.08)))))));
    });
  });

  it('does not let dice, stale completions or duplicate events interrupt a capture', () => {
    const { camera, director } = setup();
    const point = new Vector3(2,2,0);
    expect(director.start(makeShot('capture', () => [point], 3), 0, home, homeTarget)).toBe(true);
    expect(director.start(makeShot('dice', () => [homeTarget], 1), 100, home, homeTarget)).toBe(false);
    expect(director.start(makeShot('capture', () => [homeTarget], 3), 100, home, homeTarget)).toBe(false);
    director.finish('old-capture', 100, 0);
    director.update(3000, home, homeTarget); visible(camera, [point]);
    director.finish('capture', 3000, 450);
    director.update(3300, home, homeTarget); visible(camera, [point]);
    for (let t = 3500; t <= 6500; t += 50) director.update(t, home, homeTarget);
    expect(camera.position.distanceTo(home)).toBeLessThan(0.001);
    expect(director.update(6600, home, homeTarget)).toBe(false);
  });

  it('holds the result, then transfers directly to the next token step', () => {
    const { camera, director } = setup();
    const point = new Vector3(1,1,0);
    director.start({ ...makeShot('dice', () => [point], 1), until: 1300 }, 0, home, homeTarget);
    director.update(1250, home, homeTarget); visible(camera, [point]);
    director.start(makeShot('step:1', () => [point]), 1300, home, homeTarget);
    director.update(1500, home, homeTarget);
    director.finish('step:1', 1500, 900);
    const before = camera.position.clone();
    director.start(makeShot('step:2', () => [point]), 1580, home, homeTarget);
    director.update(1590, home, homeTarget);
    expect(camera.position.distanceTo(before)).toBeLessThan(0.1);
  });

  it('uses a steady full-route shot for reduced motion and releases for manual/2D view', () => {
    const { camera, director } = setup();
    const point = new Vector3(-1,1,0), destination = new Vector3(1,2,0);
    director.start({ ...makeShot('ladder', () => [point]), overview: () => [point, destination] }, 0, home, homeTarget);
    director.update(0, home, homeTarget, true);
    const steady = camera.position.clone();
    point.copy(destination);
    director.update(500, home, homeTarget, true);
    expect(camera.position.distanceTo(steady)).toBeLessThan(1e-10);
    director.cancel();
    camera.position.set(0,10,0.001);
    expect(director.update(600, home, homeTarget)).toBe(false);
    expect(camera.position.y).toBe(10);
  });

  it('converges consistently across refresh rates', () => {
    const poses = [30,60,90].map(fps => {
      const { camera, director } = setup();
      director.start(makeShot('token', () => [new Vector3(0,1,0)]), 0, home, homeTarget);
      for (let t = 0; t < 500; t += 1000/fps) director.update(t, home, homeTarget);
      director.update(500, home, homeTarget);
      return camera.position;
    });
    expect(poses[0].distanceTo(poses[2])).toBeLessThan(0.03);
  });

  it('frames a near-plane subject from above without clipping', () => {
    const { camera } = setup();
    const point = new Vector3(0,1,0), direction = new Vector3(0,2,1).normalize();
    const frame = frameSnakeAction(camera, [point], direction, 0.2, 0.1);
    camera.position.copy(frame.position); camera.lookAt(frame.target);
    visible(camera, [point]);
  });
});
