import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { createSnakeCameraDirector } from './snakeCameraDirector';
const home = new Vector3(0,3,6), homeTarget = new Vector3(0,0.8,0);
function setup() {
  const camera = new PerspectiveCamera(52,390/844,0.1,100);
  camera.position.copy(home); const target = homeTarget.clone();
  return { camera, target, director: createSnakeCameraDirector(camera,target) };
}
it.each([30,60,90])('never moves or zooms the camera during dice, entry, movement or captures at %i Hz', fps => {
  const { camera, target, director } = setup();
  const projection = camera.projectionMatrix.clone();
  const point = new Vector3();
  let clock = 0;
  for (const [index, end] of [new Vector3(-2,0.8,1),new Vector3(1,0.8,0),new Vector3(-0.6,1.4,-1),new Vector3(1.2,2,0)].entries()) {
    const from = point.clone();
    director.start({ id: String(index), priority: 2, points: () => [point] },clock,home,homeTarget);
    for (let age = 0; age <= 1100; age += 1000/fps) {
      point.lerpVectors(from,end,age/1100);
      director.update(clock+age,home,homeTarget);
      expect(camera.position.equals(home)).toBe(true);
      expect(camera.fov).toBe(52); expect(camera.zoom).toBe(1);
      expect(camera.projectionMatrix.equals(projection)).toBe(true);
      expect(camera.position.distanceTo(target)).toBeCloseTo(home.distanceTo(homeTarget),8);
    }
    clock+=1100; director.finish(String(index),clock);
  }
  expect(target.distanceTo(homeTarget)).toBeGreaterThan(0.5);
});
it('centers the live subject by looking, preserving the user lens and aspect ratio', () => {
  const { camera, director } = setup();
  camera.fov=61; camera.zoom=1.1;
  const point = new Vector3(-3,1.5,0);
  director.start({ id:'dice',priority:1,points:()=>[point] },0,home,homeTarget);
  [320/932,430/740,932/430].forEach((aspect,index)=>{
    camera.aspect=aspect; camera.updateProjectionMatrix(); const projection=camera.projectionMatrix.clone();
    director.update(1500+index*1500,home,homeTarget);
    const ndc=point.clone().project(camera);
    expect(Math.abs(ndc.x)).toBeLessThan(0.01); expect(Math.abs(ndc.y)).toBeLessThan(0.01);
    expect(camera.position.equals(home)).toBe(true); expect(camera.projectionMatrix.equals(projection)).toBe(true);
    expect(camera.fov).toBe(61); expect(camera.zoom).toBe(1.1);
  });
});
it('keeps capture priority, ignores stale events, and returns only its look direction', () => {
  const { camera,target,director }=setup(); const point=new Vector3(2,2,0);
  const shot={id:'capture',priority:3,points:()=>[point]};
  expect(director.start(shot,0,home,homeTarget)).toBe(true);
  expect(director.start(shot,100,home,homeTarget)).toBe(false);
  expect(director.start({...shot,id:'dice',priority:1},100,home,homeTarget)).toBe(false);
  director.finish('old',100,0); director.update(3000,home,homeTarget);
  expect(target.distanceTo(homeTarget)).toBeGreaterThan(1);
  director.finish('capture',3000,450);
  for(let t=3500;t<=6500;t+=50) director.update(t,home,homeTarget);
  expect(camera.position.equals(home)).toBe(true); expect(target.distanceTo(homeTarget)).toBeLessThan(0.001);
  expect(director.update(6600,home,homeTarget)).toBe(false);
});
it('holds results until the next action and respects manual/2D cancellation', () => {
  const { camera,director }=setup(); const point=new Vector3(2,1,0);
  director.start({id:'dice',priority:1,points:()=>[point],until:1300},0,home,homeTarget);
  expect(director.update(1250,home,homeTarget)).toBe(true);
  director.start({id:'entry',priority:2,points:()=>[point]},1300,home,homeTarget);
  director.cancel(); camera.position.set(0,10,0.001);
  expect(director.update(1400,home,homeTarget)).toBe(false); expect(camera.position.y).toBe(10);
});
it('uses a steady look for reduced motion without a close-up', () => {
  const { camera,director }=setup(); const point=new Vector3(-1,1,0),end=new Vector3(1,2,0);
  director.start({id:'ladder',priority:2,points:()=>[point],overview:()=>[point,end]},0,home,homeTarget);
  director.update(0,home,homeTarget,true); const pose=camera.quaternion.clone();
  point.copy(end); director.update(500,home,homeTarget,true);
  expect(camera.position.equals(home)).toBe(true); expect(camera.quaternion.angleTo(pose)).toBeLessThan(1e-7);
});
