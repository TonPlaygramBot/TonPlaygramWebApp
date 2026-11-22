import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPublicTrail,advancePublicTrail} from './publicTrail.mjs';
import {makeWalkability,approachLandmark} from './publicMapGeometry.mjs';
const readAsset=file=>readFile(new URL(file,import.meta.url));
const data=JSON.parse(await readAsset('../../webapp/public/assets/optika-tirana-v1/assets/public-tirana-center.json'));
const walkable=makeWalkability(data);
const trail=createPublicTrail(data.landmarks.map(m=>approachLandmark(m,walkable)));
function readGLB(data){
  assert.equal(data.readUInt32LE(0),0x46546c67);assert.equal(data.readUInt32LE(4),2);assert.equal(data.readUInt32LE(8),data.length);
  assert.equal(data.readUInt32LE(16),0x4e4f534a);
  return JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));
}
test('route approaches are outside walls, are near public landmark anchors, and remain sequential',()=>{
  assert.deepEqual(trail.map(x=>x.id),['square','clock','pyramid']);
  for(const [i,p] of trail.entries()){
    const l=data.landmarks.find(x=>x.id===p.id);
    assert.ok(Math.hypot(p.x-l.x,p.z-l.z)<=30);
    assert.ok(walkable(p.x,p.z,.9),p.id); 
    assert.equal(advancePublicTrail(trail,i,p,false).index,i);
    assert.equal(advancePublicTrail(trail,i,p,true).index,i+1);
  }
});
test('all three approaches lie on the same contiguous walkable tile',()=>{
  const [x0,z0,x1,z1]=data.bounds,res=2;
  const w=Math.floor((x1-x0)/res),h=Math.floor((z1-z0)/res);
  const locate=l=>[Math.round((l.x-x0)/res),Math.round((l.z-z0)/res)];
  const [sx,sz]=locate(trail[0]),todo=[[sx,sz]],seen=new Uint8Array(w*h);
  const targets=trail.map(l=>locate(l)).map(([x,z])=>z*w+x);
  seen[sz*w+sx]=1;
  for(let i=0;i<todo.length&&targets.some(k=>!seen[k]);i++){
    const [x,z]=todo[i];
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,nz=z+dz,key=nz*w+nx;
      if(nx<0||nx>=w||nz<0||nz>=h||seen[key]||!walkable(x0+res*nx,z0+res*nz))continue;
      seen[key]=1;todo.push([nx,nz]);
    }
  }
  for(const k of targets)assert.equal(seen[k],1);
});
test('clip-ready original Turi and four real glTF landmarks are present',async()=>{
  const landmark=readGLB(await readAsset('../../webapp/public/assets/optika-tirana-v1/assets/public-tirana-landmarks.glb'));
  assert.deepEqual(landmark.nodes.map(n=>n.name).sort(),['clock','mosque','pyramid','skanderbeg']);
  assert.ok(landmark.meshes.every(mesh=>mesh.primitives.every(p=>landmark.accessors[p.attributes.POSITION].count>0)));
  const original=await readAsset('../../webapp/public/assets/tirana-streets/players/turi.glb');
  assert.equal(createHash('sha256').update(original).digest('hex'),'15aa91bb5206589087df60e47911f3b64ec1d95b4e380a685b3b025f21446f02');
  assert.deepEqual(readGLB(original).animations.map(a=>a.name).sort(),['Idle','Run','Walk']);
});
test('center tile only carries allowlisted render geometry and civic stops',()=>{
  assert.deepEqual(Object.keys(data).sort(),['areas','bounds','buildings','landmarks','markings','parks','roads','water']);
  assert.ok(data.buildings.every(row=>Object.keys(row).sort().join()==='h,p'));
  assert.ok(data.roads.every(row=>Object.keys(row).sort().join()==='a,b,bridge,w,walk'));
  assert.ok(data.markings.every(row=>Object.keys(row).sort().join()==='footprint,groundY,id,x,yaw,z'));
  assert.ok(data.landmarks.every(row=>Object.keys(row).sort().join()==='id,x,z'));
});
