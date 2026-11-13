// @vitest-environment node
import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createRestoredSeatedHumanActor } from '../pages/Games/shared/seatedHumanActors';
import { SNAKE_SCENE_DIMENSIONS as D } from '../components/SnakeBoard3D';
import { resolveSeatedPlayerEyePosition, SEATED_PLAYER_VIEW, updateSeatedPlayerLook } from './seatedPlayerView';
import { createSnakeCameraDirector } from './snakeCameraDirector';
let template: THREE.Object3D;
beforeAll(async () => {
  const loader = new GLTFLoader();
  loader.register(() => ({name:'CameraTestTextures',loadTexture:()=>Promise.resolve(null)}));
  const bytes = await readFile('public/assets/pool-royale/readyplayer.me.glb');
  template = (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
});
function seatedPlayer() {
  const chair=new THREE.Group();
  chair.position.set(0,D.chairBaseHeight,D.chairRadius+D.seatClearance);
  chair.rotation.y=Math.PI;
  const actor=createRestoredSeatedHumanActor(template,chair,{
    targetHeight:D.humanHeight,seatHeight:0,visualScaleMultiplier:D.humanScale,seatedZOffset:D.humanSeatOffset
  })!;
  return {chair,...actor};
}
it.each([390/844,320/740,844/390])('anchors the camera outside the real local human face at aspect %f',aspect=>{
  const {rig,chair}=seatedPlayer();
  const target=new THREE.Vector3(0,D.tableHeight,0),position=new THREE.Vector3();
  expect(resolveSeatedPlayerEyePosition(rig.head,target,position)).toBe(true);
  const head=rig.head.getWorldPosition(new THREE.Vector3());
  expect(position.y).toBeGreaterThan(D.tableHeight);
  expect(position.z).toBeLessThan(head.z);
  expect(position.distanceTo(head)).toBeLessThan(0.2);
  const camera=new THREE.PerspectiveCamera(SEATED_PLAYER_VIEW.fov,aspect,0.1,5000);
  camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld(true);
  const projected=target.clone().project(camera);
  expect(Math.abs(projected.x)).toBeLessThan(1e-7);
  expect(Math.abs(projected.y)).toBeLessThan(1e-7);
  expect(projected.z).toBeGreaterThan(-1);expect(projected.z).toBeLessThan(1);
  // The local eye remains the anchor while looking at an opponent's die.
  const director=createSnakeCameraDirector(camera,target.clone());
  director.start({id:'opponent',priority:1,points:()=>[new THREE.Vector3(1,D.tableHeight,-1)]},0,position,target);
  director.update(300,position,target);
  expect(camera.position.distanceTo(position)).toBeLessThan(1e-10);
  expect(camera.fov).toBe(78);
  // Moving the seated human must move the eye by the same translation.
  const before=position.clone();chair.position.x+=0.25;target.x+=0.25;
  resolveSeatedPlayerEyePosition(rig.head,target,position);
  expect(position.x-before.x).toBeCloseTo(0.25,8);
});
it('hiding the local head does not move the eye or scale the body',()=>{
  const {rig,actor}=seatedPlayer();const target=new THREE.Vector3(0,D.tableHeight,0);
  const before=new THREE.Vector3(),after=new THREE.Vector3(),bodyScale=actor.scale.clone();
  resolveSeatedPlayerEyePosition(rig.head,target,before);rig.head.scale.multiplyScalar(0.001);
  resolveSeatedPlayerEyePosition(rig.head,target,after);
  expect(after.distanceTo(before)).toBeLessThan(1e-10);expect(actor.scale.equals(bodyScale)).toBe(true);
});
it('maps upward and rightward phone drags to upward and rightward look, with Ludo limits',()=>{
  const look={yaw:0,pitch:0};updateSeatedPlayerLook(look,40,-40);
  expect(look.yaw).toBeGreaterThan(0);expect(look.pitch).toBeGreaterThan(0);
  updateSeatedPlayerLook(look,-10000,10000);
  expect(look.yaw).toBeCloseTo(-Math.PI*26/180);expect(look.pitch).toBeCloseTo(-Math.PI*6/180);
});
it('leaves the existing eye unchanged when the human is still loading',()=>{
  const position=new THREE.Vector3(1,2,3);
  expect(resolveSeatedPlayerEyePosition(null,new THREE.Vector3(),position)).toBe(false);
  expect(position.toArray()).toEqual([1,2,3]);
});
