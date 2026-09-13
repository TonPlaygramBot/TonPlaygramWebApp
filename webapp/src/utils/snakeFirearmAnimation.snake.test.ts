import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createSnakeFirearmAnimation, createSnakeFirearmFallback } from './snakeFirearmAnimation';
import { getLudoFirearmTiming, getLudoFirearmBallistics, sampleLudoFirearmVolley } from './ludoFirearmPresentation';

it.each([
  ['ak47VolleyAttack',30,1,116.48], ['uziSprayAttack',32,1,116.48],
  ['glockSidearmAttack',17,1,116.48], ['shotgunBlastAttack',1,14,191.36],
  ['sniperShotAttack',1,1,322.4]
])('uses Ludo timing and ammunition for %s', (id, shots, pellets, cadence) => {
  const timing = getLudoFirearmTiming(String(id));
  expect(timing.shots).toBe(shots); expect(timing.pelletsPerShot).toBe(pellets);
  expect(timing.cadenceMs).toBeCloseTo(Number(cadence),4);
  expect(timing.preFireLeadMs).toBe(1020);
  expect(sampleLudoFirearmVolley(1019,timing).firing).toBe(false);
  expect(sampleLudoFirearmVolley(1019,timing).recoil).toBe(0);
  expect(sampleLudoFirearmVolley(1020,timing).firing).toBe(true);
  expect(getLudoFirearmBallistics(String(id)).bulletRadius).toBeGreaterThan(0);
});

it.each([30,60,90])('plays the complete gun sequence exactly once at %i Hz', fps => {
  const scene=new THREE.Scene(); const victim=new THREE.Object3D(); scene.add(victim);
  const onShot=vi.fn(), onImpact=vi.fn();
  const animation=createSnakeFirearmAnimation({scene,weaponId:'ak47VolleyAttack',origin:new THREE.Vector3(-1,1,0),target:new THREE.Vector3(1,1,0),victims:[victim],startedAt:0,onShot,onImpact});
  const timing=getLudoFirearmTiming('ak47VolleyAttack');
  for(let time=0;time<animation.duration;time+=1000/fps) {
    animation.update(time);
    if(time<timing.preFireLeadMs) {
      expect(onShot).not.toHaveBeenCalled();
      expect(scene.getObjectByName('caliber-projectile-rifle-round')?.visible).toBe(false);
    }
    expect(Number.isFinite(animation.focus.x+animation.focus.y+animation.focus.z)).toBe(true);
  }
  expect(animation.update(animation.duration)).toBe(true);
  expect(onShot).toHaveBeenCalledTimes(30);
  expect(onImpact).toHaveBeenCalledTimes(1);
  expect(victim.visible).toBe(false);
  animation.update(animation.duration+300); expect(onImpact).toHaveBeenCalledTimes(1);
  animation.dispose(); animation.dispose();
  expect(victim.visible).toBe(true);
  expect(scene.getObjectByName('snake-firearm-effects')).toBeUndefined();
});

it('fires a 14-pellet shotgun spread and hits before completion', () => {
  const scene=new THREE.Scene(), impact=vi.fn();
  const animation=createSnakeFirearmAnimation({scene,weaponId:'shotgunBlastAttack',origin:new THREE.Vector3(-1,1,0),target:new THREE.Vector3(1,1,0),startedAt:0,onImpact:impact});
  const pellets: THREE.Object3D[]=[];
  scene.traverse(object=>{if(object.name==='caliber-projectile-buckshot-pellet')pellets.push(object);});
  expect(pellets).toHaveLength(14);
  animation.update(1250);
  expect(pellets.every(p=>p.visible)).toBe(true);
  expect(new Set(pellets.map(p=>p.position.toArray().join(','))).size).toBe(14);
  animation.update(1800);
  expect(impact).toHaveBeenCalledTimes(1);
  expect(1800).toBeLessThan(animation.duration);
  animation.dispose();
});

it('does not dispose the live rack model when a capture is cancelled', () => {
  const scene=new THREE.Scene(), rack=createSnakeFirearmFallback(); scene.add(rack);
  const mesh=rack.children[0] as THREE.Mesh;
  const geometryDispose=vi.spyOn(mesh.geometry,'dispose');
  const materialDispose=vi.spyOn(mesh.material as THREE.Material,'dispose');
  const animation=createSnakeFirearmAnimation({scene,weaponId:'glockSidearmAttack',parkedWeapon:rack,origin:new THREE.Vector3(),target:new THREE.Vector3(1,1,1),startedAt:0});
  animation.update(500); animation.dispose();
  expect(rack.visible).toBe(true); expect(rack.parent).toBe(scene);
  expect(geometryDispose).not.toHaveBeenCalled(); expect(materialDispose).not.toHaveBeenCalled();
  expect(animation.update(2000)).toBe(true);
});

it('survives skipped frames and reduced motion without duplicate audio or flashes', () => {
  const scene=new THREE.Scene(), shot=vi.fn(), impact=vi.fn();
  const animation=createSnakeFirearmAnimation({scene,weaponId:'uziSprayAttack',origin:new THREE.Vector3(),target:new THREE.Vector3(1,1,1),startedAt:0,reducedMotion:true,onShot:shot,onImpact:impact});
  animation.update(1700); animation.update(1700);
  expect(shot).toHaveBeenCalledTimes(1);
  expect(animation.update(20000)).toBe(true);
  expect(shot).toHaveBeenCalledTimes(2); expect(impact).toHaveBeenCalledTimes(1);
  animation.dispose();
});
