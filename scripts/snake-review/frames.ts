import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createSnakeInteractionScene} from '../../webapp/src/previews/snake/interactionScene';
import {readSnakeWeaponContacts} from '../../webapp/src/utils/snakeWeaponGrip';
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
  meshes.push({points,indices:o.geometry.index?Array.from(o.geometry.index.array):Array.from({length:pos.count},(_,i)=>i),color:mat.color.toArray()});
 });
 await writeFile('scripts/snake-review/'+name+'.json',JSON.stringify({meshes,camera:camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements}));
}
for(const id of ['polyAssaultRifle01Attack','polyPistol01Attack','polyShotgun01Attack']) {
 const review=createSnakeInteractionScene(assets,0,id);
 await save(id+'-idle',review);
 review.start('dice');review.update(630);await save(id+'-pickup',review);
 const dieGap=worldPoint(review.human.arms.right.palm).distanceTo(worldPoint(review.die));
 if(dieGap>0.003)throw new Error('Die contact gap: '+dieGap);
 review.update(900);await save(id+'-lift',review);
 review.update(3050);await save(id+'-receiver',review);
 const receiverGap=worldPoint(review.receiver.arms.right.palm).distanceTo(worldPoint(review.die));
 if(receiverGap>0.003)throw new Error('Receiver contact gap: '+receiverGap);
 review.start('fire');review.update(1040);await save(id+'-aim',review);
 const contacts=readSnakeWeaponContacts(review.scene.getObjectByName('snake-held-firearm'));
 const rightGap=worldPoint(review.human.arms.right.palm).distanceTo(contacts.grip),leftGap=worldPoint(review.human.arms.left.palm).distanceTo(contacts.support);
 if(Math.max(rightGap,leftGap)>0.003)throw new Error(id+' grip gap: '+rightGap+', '+leftGap);
 console.log(id, {dieGap,receiverGap,rightGap,leftGap});
 review.dispose();
}
