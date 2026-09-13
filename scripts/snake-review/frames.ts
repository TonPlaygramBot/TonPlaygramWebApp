import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createSnakeInteractionScene} from '../../webapp/src/previews/snake/interactionScene';
import {getSnakePortraitCameraState} from '../../webapp/src/components/SnakeBoard3D';
import {readSnakeWeaponContacts} from '../../webapp/src/utils/snakeWeaponGrip';
import { SNAKE_DICE_PRESENTATION_MS, SNAKE_DICE_READ_MS } from '../../webapp/src/utils/snakeDiceInteraction';
import {worldPoint} from '../../webapp/src/utils/snakeHumanInteraction';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
let canvas;
try { canvas=require('@napi-rs/canvas'); }
catch { canvas=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/@napi-rs/canvas'); }
const {createCanvas}=canvas;
globalThis.document={createElement:()=>createCanvas(64,64)} as any;
const assets=JSON.parse(await readFile('webapp/src/previews/snake/generated/assets.json','utf8'));
async function save(name,review) {
 const {scene,camera}=review;scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
 const meshes=[];
 scene.traverse(o=>{
  if(!o.isMesh)return;
  for(let p=o;p;p=p.parent)if(!p.visible)return;
  if(o.isSkinnedMesh)o.skeleton.update();
  const pos=o.geometry.attributes.position;if(!pos)return;
  const points=[];for(let i=0;i<pos.count;i++)points.push(o.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(o.matrixWorld).toArray());
  const mat=Array.isArray(o.material)?o.material[0]:o.material;
  meshes.push({points,indices:o.geometry.index?Array.from(o.geometry.index.array):Array.from({length:pos.count},(_,i)=>i),color:mat.color.toArray(),opacity:mat.opacity,depthWrite:mat.depthWrite});
 });
 await writeFile('scripts/snake-review/'+name+'.json',JSON.stringify({meshes,camera:camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements}));
}
for(const id of ['polyAssaultRifle01Attack','polyPistol01Attack','polyShotgun01Attack']) {
 const review=createSnakeInteractionScene(assets,0,id);
 await save(id+'-idle',review);
 review.start('dice');review.update(630);await save(id+'-pickup',review);
 const dieGap=worldPoint(review.human.arms.right.palm).distanceTo(worldPoint(review.die));
 if(dieGap>0.003)throw new Error('Die contact gap: '+dieGap);
 const half=review.die.userData.gripHalfExtent;
 const tips=['Thumb','Index','Middle','Ring','Pinky'].map(name=>{const p=review.die.worldToLocal(review.human.fingertip('right',name));return {name,local:p.toArray(),half};});
 console.log('Pickup surface contacts',id,tips);
 review.update(900);await save(id+'-lift',review);
 review.update(SNAKE_DICE_PRESENTATION_MS);await save(id+'-result',review);
 review.update(SNAKE_DICE_PRESENTATION_MS + SNAKE_DICE_READ_MS + 630);await save(id+'-receiver',review);
 const receiverGap=worldPoint(review.receiver.arms.right.palm).distanceTo(worldPoint(review.die));
 if(receiverGap>0.003)throw new Error('Receiver contact gap: '+receiverGap);
 review.start('fire');review.update(1040);await save(id+'-aim',review);
 const contacts=readSnakeWeaponContacts(review.scene.getObjectByName('snake-held-firearm'));
 const rightGap=worldPoint(review.human.arms.right.palm).distanceTo(contacts.grip),leftGap=worldPoint(review.human.arms.left.palm).distanceTo(contacts.support);
 if(Math.max(rightGap,leftGap)>0.003)throw new Error(id+' grip gap: '+rightGap+', '+leftGap);
 console.log(id, {dieGap,receiverGap,rightGap,leftGap});
 review.dispose();
}

for (const seat of [0,1,2,3]) {
 const review=createSnakeInteractionScene(assets,seat);
 review.start('dice'); review.update(review.duration());
 const state=getSnakePortraitCameraState(); review.camera.position.copy(state.position); review.camera.fov=state.fov; review.camera.lookAt(worldPoint(review.die));
 review.scene.updateMatrixWorld(true);
 const meshes=[]; review.scene.traverse(o=>{ if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;if(o.isSkinnedMesh)o.computeBoundingSphere();meshes.push(o); });
 const target=worldPoint(review.die); const direction=target.clone().sub(state.position);
 const ray=new THREE.Raycaster(state.position,direction.clone().normalize(),0,direction.length()-0.04);
 const blockers=ray.intersectObjects(meshes,false).filter(h=>{for(let p=h.object;p;p=p.parent)if(p===review.die)return false;const m=Array.isArray(h.object.material)?h.object.material[0]:h.object.material;return m.opacity>0.15;}).map(h=>({name:h.object.name,distance:h.distance})).slice(0,2);
 if(blockers.length)throw new Error('Opaque result obstruction at seat '+seat+': '+JSON.stringify(blockers));
 console.log('Portrait result visibility',seat,'clear');
 await save('result-seat-'+seat,review);review.dispose();
}
