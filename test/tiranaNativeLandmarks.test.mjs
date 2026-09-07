import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNativeModel,NATIVE_MODEL_IDS,MATERIALS} from '../webapp/src/games/tirana-landmarks/nativeModels.mjs';
import {resolveNativeLandmarks,translateNativeLandmarks,projectLocation,triangleInReplacement,nativeReplacementIds} from '../webapp/src/games/tirana-landmarks/nativeLocations.mjs';
import {encodeLandmarkGLB} from '../webapp/scripts/export-tirana-landmarks.mjs';

for(const id of NATIVE_MODEL_IDS)for(const lod of ['near','far']){
  test(`${id} ${lod}: finite, nondegenerate outward-consistent triangles and unit normals`,()=>{
    const model=buildNativeModel(id,lod);
    assert.ok(model.triangles>100&&model.triangles<6500);
    assert.ok(model.meshes.length<=5);
    assert.ok(model.bounds.min[1]>=0&&model.bounds.min[1]<=.15);
    for(const mesh of model.meshes){
      assert.ok(MATERIALS[mesh.material]);
      assert.equal(mesh.positions.length,mesh.normals.length);
      assert.equal(mesh.positions.length%9,0);
      for(let i=0;i<mesh.positions.length;i+=9){
        const a=mesh.positions.slice(i,i+3),b=mesh.positions.slice(i+3,i+6),c=mesh.positions.slice(i+6,i+9);
        assert.ok([...a,...b,...c].every(Number.isFinite));
        const u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);
        const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
        assert.ok(Math.hypot(...n)>1e-9);
        for(let j=0;j<3;j++){
          const vertexNormal=mesh.normals.slice(i+j*3,i+j*3+3);
          assert.ok(vertexNormal.every(Number.isFinite));
          assert.ok(Math.abs(Math.hypot(...vertexNormal)-1)<1e-6);
          assert.ok(n.reduce((s,v,k)=>s+v*vertexNormal[k],0)>0);
        }
      }
    }
  });
  test(`${id} ${lod}: GLB loads with aligned embedded accessors, no remote dependencies`,()=>{
    const bytes=encodeLandmarkGLB(buildNativeModel(id,lod));
    assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
    const binOffset=20+jsonLength,binLength=bytes.readUInt32LE(binOffset);
    assert.equal(json.asset.version,'2.0');assert.equal(json.buffers[0].byteLength,binLength);
    assert.equal(json.images,undefined);assert.equal(json.buffers[0].uri,undefined);
    for(const view of json.bufferViews){assert.equal(view.byteOffset%4,0);assert.ok(view.byteOffset+view.byteLength<=binLength);}
    for(const accessor of json.accessors){
      assert.equal(accessor.componentType,5126);assert.equal(accessor.type,'VEC3');
      assert.equal(accessor.count*12,json.bufferViews[accessor.bufferView].byteLength);
    }
    for(const primitive of json.meshes[0].primitives){
      assert.equal(primitive.mode,4);
      assert.equal(json.accessors[primitive.attributes.POSITION].count,json.accessors[primitive.attributes.NORMAL].count);
      const position=json.accessors[primitive.attributes.POSITION],view=json.bufferViews[position.bufferView];
      const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<position.count*3;i++){const k=i%3,value=bytes.readFloatLE(binOffset+8+view.byteOffset+i*4);mins[k]=Math.min(mins[k],value);maxs[k]=Math.max(maxs[k],value);}
      assert.deepEqual(position.min,mins);assert.deepEqual(position.max,maxs);
    }
  });
}
test('six different original recreations; deterministic builds and smaller distant LODs',()=>{
  assert.equal(new Set(NATIVE_MODEL_IDS).size,6);
  for(const id of NATIVE_MODEL_IDS){
    const near=buildNativeModel(id),far=buildNativeModel(id,'far');
    assert.deepEqual(buildNativeModel(id),near);
    assert.ok(far.triangles<near.triangles*.65);
    assert.ok(Math.abs(far.bounds.max[1]-near.bounds.max[1])<.1);
  }
  assert.throws(()=>buildNativeModel('unlicensed-download'));
  assert.throws(()=>buildNativeModel('clock','bad'));
});
test('tower frustum sides face outside, not into the building',()=>{
  const glass=buildNativeModel('eyes','far').meshes.find(m=>m.material==='glass');
  for(let i=0;i<glass.positions.length;i+=3){
    const [x,y,z]=glass.positions.slice(i,i+3),[nx,ny,nz]=glass.normals.slice(i,i+3);
    if(y>=24&&Math.abs(ny)<.99)assert.ok(x*nx+z*nz>0);
  }
});
// Fixtures are deliberately NOT presented as real surveyed landmark anchors.
const world={origin:[41.3275,19.8188],bounds:[-805,-380,660,1150],
  landmarks:[{id:'clock',x:100,z:55},{id:'mosque',x:78,z:60},{id:'pyramid',x:180,z:670}],
  buildings:[{id:'233519333',name:'Clock',p:[[97,52],[103,52],[103,58],[97,58]]},{id:'175108083',name:'Mosque',p:[[70,52],[86,52],[86,68],[70,68]]},{id:'174510408',name:'Pyramid',p:[[150,640],[210,640],[210,700],[150,700]]}]};
const square=(p,r)=>[[p.x-r,p.z-r],[p.x+r,p.z-r],[p.x+r,p.z+r],[p.x-r,p.z+r]];
test('all six source anchors resolve within the current district without map mutation',()=>{
  const copy=structuredClone(world),{landmarks}=resolveNativeLandmarks(world);
  assert.equal(landmarks.length,6);assert.deepEqual(world,copy);
  assert.equal(landmarks.find(l=>l.id==='clock').x,100);
  const statue=landmarks.find(l=>l.id==='skanderbeg'),p=projectLocation(world,41.32777,19.81855);
  assert.equal(statue.x,p.x);assert.equal(statue.z,p.z);
  assert.equal(statue.buildingId,null);
});
test('no zero-coordinate fallback for an absent or ambiguous special anchor',()=>{
  const {landmarks,issues}=resolveNativeLandmarks({...world,landmarks:[]});
  assert.equal(landmarks.length,3);assert.ok(issues.some(s=>s.startsWith('clock:')));
  assert.ok(!landmarks.some(l=>l.id==='clock'));
  const dup=resolveNativeLandmarks({...world,landmarks:[...world.landmarks,world.landmarks[0]]});
  assert.ok(!dup.landmarks.some(l=>l.id==='clock'));
});
test('BlackWater is exactly the same map translated once, not rotated/scaled',()=>{
  const a=resolveNativeLandmarks(world).landmarks,b=translateNativeLandmarks(a,{x:-220,z:600});
  for(let i=0;i<a.length;i++){
    assert.equal(b[i].x,a[i].x+220);assert.equal(b[i].z,a[i].z-600);assert.equal(b[i].yaw,a[i].yaw);
    if(a[i].footprint)assert.deepEqual(b[i].footprint,a[i].footprint.map(p=>[p[0]+220,p[1]-600]));
  }
  assert.throws(()=>translateNativeLandmarks(a,{x:NaN,z:0}));
});
test('museum footprint matching requires identity and geographic proximity',()=>{
  const p=projectLocation(world,41.32944,19.8174),building={id:'museum-fixture',name:'Muzeu Historik Kombëtar',p:square(p,48)};
  const a=resolveNativeLandmarks({...world,buildings:[...world.buildings,building]});
  assert.equal(a.landmarks.find(l=>l.id==='museum').buildingId,'museum-fixture');
  const moved={...building,p:building.p.map(v=>[v[0]+500,v[1]])};
  assert.equal(resolveNativeLandmarks({...world,buildings:[...world.buildings,moved]}).landmarks.find(l=>l.id==='museum').buildingId,null);
});
test('a differently named neighbour is never replaced at a mapped site',()=>{
  const p=projectLocation(world,41.32864,19.81558),building={id:'office',name:'Different office',p:square(p,25)};
  assert.equal(resolveNativeLandmarks({...world,buildings:[...world.buildings,building]}).landmarks.find(l=>l.id==='eyes').buildingId,null);
  assert.deepEqual([...nativeReplacementIds(world)].sort(),['174510408','175108083','233519333'].sort());
});
test('out-of-map anchors are not relocated into the playable district',()=>{
  const a=resolveNativeLandmarks({...world,bounds:[-2,-2,2,2]});
  assert.equal(a.landmarks.length,0);assert.ok(a.issues.every(s=>s.includes('outside')));
});
test('replacement removes only triangles entirely inside one verified footprint',()=>{
  const poly=[[0,0],[10,0],[10,10],[0,10]],other=[[20,0],[30,0],[30,10],[20,10]];
  assert.equal(triangleInReplacement([[1,0,1],[9,8,1],[1,8,9]],[poly]),true);
  assert.equal(triangleInReplacement([[0,0,0],[30,0,0],[0,0,30]],[poly]),false);
  assert.equal(triangleInReplacement([[1,0,1],[22,0,1],[1,8,9]],[poly,other]),false);
  assert.equal(triangleInReplacement([[1,0,1],[9,0,1],[1,0,9]],[]),false);
});
