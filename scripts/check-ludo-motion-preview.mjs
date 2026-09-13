import { readFile, writeFile } from 'node:fs/promises';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
const dir = new URL('../webapp/src/previews/ludo/generated/', import.meta.url);
const source = await readFile(new URL('../webapp/src/previews/ludo/LudoMotionPreview.tsx', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('const metal ='), source.indexOf('async function modelJson'));
const setup = source.slice(source.indexOf('      const scene='), source.indexOf('      const resize='));
const frame = source.slice(source.indexOf('      const saved='), source.indexOf('      raf=requestAnimationFrame(frame);'));
const check = `import * as THREE from 'three';
import { V, smooth, world, makeActor, pose, palmOrientation, solveArm, heldPose, type Weapon } from '../motion';
import { createLudoBlenderModel } from '../../../utils/ludoBlenderMeshes';
import { createCaliberProjectileFx, createCaliberShellCasingFx, getLudoFirearmBallistics } from '../../../utils/ludoFirearmPresentation';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const json=JSON.parse(await readFile(new URL('./avatar.json',import.meta.url),'utf8'));
const controls={current:null},setBusy=()=>{},setStatus=()=>{},setView=()=>{};
let dead=false,raf=0;const requestAnimationFrame=()=>0,renderer={render(){}};
${functions}
${setup}
${frame}
const initial=actor.position.clone();
let assertions=0;
function check(value,message){assert(value,message);assertions++;}
async function exportScene(name){
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);camera.aspect=360/470;camera.updateProjectionMatrix();
  const meshes=[];
  scene.traverse(o=>{if(!o.isMesh||!o.visible)return;for(let p=o.parent;p;p=p.parent)if(!p.visible)return;
    if(o.isSkinnedMesh)o.skeleton.update();
    const pos=o.geometry.attributes.position;if(!pos)return;
    const points=[];for(let i=0;i<pos.count;i++)points.push(o.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(o.matrixWorld).toArray());
    meshes.push({points,indices:o.geometry.index?Array.from(o.geometry.index.array):Array.from({length:pos.count},(_,i)=>i),color:o.material.color.toArray()});
  });
  await writeFile(new URL(name+'.json',import.meta.url),JSON.stringify({meshes,cameraWorld:camera.matrixWorld.elements,fov:camera.fov,camera:camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements}));
}
await exportScene('idle');
for(const id of ['rifle','smg','pistol']){
  controls.current.weapon(id);startAction('fire');
  for(let i=0;i<=164;i++){
    frame(start+i*20);
    if(i===65){
      const muzzle=weapon.root.localToWorld(weapon.muzzle.clone()),direction=V(0,0,1).applyQuaternion(weapon.root.quaternion);
      check(target.clone().sub(muzzle).cross(direction).length()<.0001,id+' muzzle ray');
      const grip=weapon.root.localToWorld(weapon.grip.clone());
      check(world(rightPalm).distanceTo(grip)<.008,id+' palm grip: '+world(rightPalm).distanceTo(grip));
      check(world(rig.rightForeArm).y<world(rig.rightUpperArm).y-.02,id+' tucked elbow');
      if(id==='rifle')await exportScene('aim');
    }
  }
}
for(let round=0;round<2;round++){
  const before=die.position.clone();startAction('dice');
  check(die.position.distanceTo(before)<1e-9,'die must stay at actual position on pickup');
  for(let i=0;i<=130;i++){
    frame(start+i*20);
    if(i===28)check(world(rightPalm).distanceTo(pickup)<.009,'reach actual die: '+world(rightPalm).distanceTo(pickup));
    if(i===50)check(die.position.distanceTo(world(rightPalm))<1e-9,'attached die');
    if(i===65&&round===0)await exportScene('throw');
  }
  check(die.position.distanceTo(landing)<1e-9,'die lands on tabletop');
  check(actor.position.distanceTo(initial)<1e-9,'seated root stays fixed');
}
for(const id of ['truck','drone','missile','ammo','player']){controls.current.view(id);await exportScene(id);}
console.log(assertions+' motion checks passed');
`;
await writeFile(new URL('runtime-check.ts', dir), check);
await build({entryPoints:[new URL('runtime-check.ts', dir).pathname],bundle:true,platform:'node',format:'esm',outfile:new URL('runtime-check.mjs',dir).pathname});
await import(new URL('runtime-check.mjs',dir).href);
