import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {KART_ASSETS,vehicleAssetUrl,normaliseVehicleDimensions} from '../webapp/src/games/kartroyale/vehicleAssetConfig.mjs';
import {TRACKS,makeTrack} from '../webapp/src/games/kartroyale/simulation.mjs';
import {tyreBarrierLayout,trackSurface} from '../webapp/src/games/kartroyale/tyreBarrierCore.mjs';
import {buildingClearance} from '../webapp/src/games/kartroyale/raceCourse.mjs';
import {KART_LENGTH} from '../webapp/src/games/kartroyale/racingDimensions.mjs';
import {TYRE_RADIUS,ROAD_SURFACE_Y} from '../webapp/src/games/kartroyale/roadFeel.mjs';
const base=new URL('../webapp/public/assets/kart-royale/karts/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('modern-manifest.json',base),'utf8'));
async function load(id,low=false){const b=readFileSync(new URL(id+(low?'-lod':'')+'.glb',base));return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'')).scene;}

test('all eight modern models have valid self-contained geometry and smaller mobile LODs',async()=>{
  assert.equal(manifest.assets.length,16);assert.equal(new Set(manifest.assets.map(m=>m.family)).size,8);
  for(const id of Object.keys(KART_ASSETS)){
    const pair=[];
    for(const low of [false,true]){
      const entry=manifest.assets.find(m=>m.id===id&&m.lod===low),bytes=readFileSync(new URL(entry.file,base));
      assert.equal(bytes.length,entry.bytes);assert.ok(entry.triangles<(low?11000:25000));assert.ok(entry.drawCalls<=40);
      const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
      assert.ok(!gltf.images?.length&&!gltf.buffers.some(b=>b.uri),'no external image/buffer requests');
      const scene=await load(id,low);let tris=0;
      scene.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position,n=o.geometry.attributes.normal;assert.ok([...p.array,...n.array].every(Number.isFinite));tris+=(o.geometry.index?.count||p.count)/3;assert.ok(!Array.isArray(o.material));}});
      assert.equal(tris,entry.triangles);
      pair.push(entry);
      assert.match(vehicleAssetUrl(id,low),/\?v=city-driver-v2$/);
    }
    assert.ok(pair[1].triangles<pair[0].triangles*.62);assert.ok(pair[1].bytes<pair[0].bytes*.65);
  }
});

test('front steering and wheel spin pivots stay aligned across high/low fits',async()=>{
  for(const id of Object.keys(KART_ASSETS)){
    const high=await load(id),low=await load(id,true),bounds=new T.Box3().setFromObject(high);
    const fit=normaliseVehicleDimensions({min:bounds.min.toArray(),max:bounds.max.toArray()});
    const sockets=[];
    for(const scene of [high,low]){
      scene.scale.setScalar(fit.scale);scene.position.set(...fit.offset);scene.updateMatrixWorld(true);
      const box=new T.Box3().setFromObject(scene);assert.ok(Math.abs(box.min.y)<.012,'ground contact');
      assert.ok(Math.abs(box.max.z-box.min.z-KART_LENGTH)<.01);
      const wheels=['fl','fr','rl','rr'].map(s=>scene.getObjectByName('wheel_'+s));assert.ok(wheels.every(Boolean));
      const wheelPositions=wheels.map(w=>w.getWorldPosition(new T.Vector3()));
      sockets.push(wheelPositions);
      wheels.forEach(w=>w.rotation.x=1.73);
      for(const s of ['fl','fr'])scene.getObjectByName('steer_'+s).rotation.y=.38;
      scene.updateMatrixWorld(true);
      wheels.forEach((w,i)=>assert.ok(w.getWorldPosition(new T.Vector3()).distanceTo(wheelPositions[i])<1e-7,'spinning/steering must not orbit the tyre centre'));
      assert.ok(Math.abs(scene.getObjectByName('steering_wheel').position.y-(id==='oopi'?.8:.7))<1e-7);
    }
    sockets[0].forEach((p,i)=>assert.ok(p.distanceTo(sockets[1][i])<1e-7,'LOD cannot shift wheel contacts'));
  }
});

test('fleet variants change construction, including actual electric drivetrains',()=>{
  const features=id=>new Set(manifest.assets.find(m=>m.id===id&&!m.lod).features);
  assert.ok(features('apex').has('Central fuel reservoir'));
  assert.ok(features('oobi').has('Tall radiator')&&features('oobi').has('Front brake disc'));
  assert.ok(features('oodi').has('Low rear diffuser'));
  assert.ok(features('ooli').has('Covered engine pod'));
  assert.ok(features('oopi').has('Coil spring')&&features('oopi').has('Terrain tread'));
  for(const id of ['photon','vortex','aegis']){assert.ok(features(id).has('Electric motor')&&features(id).has('Battery module'));assert.ok(!features(id).has('Exhaust silencer'));}
  assert.ok(features('aegis').has('Rounded roll hoop'));assert.ok(features('vortex').has('Low rear diffuser'));
});

test('every complete circuit has non-overlapping tyres outside asphalt and building footprints',()=>{
  for(const {id} of TRACKS){
    const track=makeTrack(id),layout=tyreBarrierLayout(track,buildingClearance),surface=trackSurface(track),grid=new Map();
    assert.ok(layout.positions.length>track.length*1.3,'retain continuous coverage, not just delete the walls');
    for(const p of layout.positions){
      assert.ok(surface.clearance(p.x,p.z)>=TYRE_RADIUS+.039,id+' asphalt clearance');assert.ok(buildingClearance(p.x,p.z)>=TYRE_RADIUS+.039,id+' buildings');
      const ix=Math.floor(p.x/2),iz=Math.floor(p.z/2);
      for(let x=ix-1;x<=ix+1;x++)for(let z=iz-1;z<=iz+1;z++)for(const q of grid.get(`${x},${z}`)||[])assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>TYRE_RADIUS*2,id+' overlapping footprints');
      const key=`${ix},${iz}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p);
    }
  }
});

test('actual instanced tyre geometry uses validated centres, correct height and cull bounds',async()=>{
  const file=new URL('../webapp/src/games/kartroyale/TyreBarrierLayer.ts',import.meta.url);
  const code=await build({entryPoints:[file.pathname],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'three',setup(b){b.onResolve({filter:/^three$/},()=>({path:new URL('../webapp/node_modules/three/build/three.module.js',import.meta.url).href,external:true}));}}]});
  const {createTyreBarrierLayer}=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));
  const track=makeTrack('lana'),group=createTyreBarrierLayer(track,buildingClearance),surface=trackSurface(track),matrix=new T.Matrix4(),p=new T.Vector3();let baseTyres=0;
  for(const mesh of group.children){
    assert.ok(mesh.frustumCulled&&mesh.boundingSphere.radius>0&&mesh.boundingSphere.radius<70);
    mesh.geometry.computeBoundingBox();assert.ok(Math.abs(mesh.geometry.boundingBox.max.x-TYRE_RADIUS)<1e-6);
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);assert.ok(surface.clearance(p.x,p.z)>=TYRE_RADIUS+.03);
      const level=(p.y-ROAD_SURFACE_Y-.14)/.28;assert.ok(Math.abs(level-Math.round(level))<1e-5);if(Math.round(level)===0)baseTyres++;
    }
  }
  assert.equal(baseTyres,tyreBarrierLayout(track,buildingClearance).positions.length);
});

test('kerbs follow the asphalt union rather than leaving crossed spurs in corners',async()=>{
  const file=new URL('../webapp/src/games/kartroyale/KerbLayer.ts',import.meta.url);
  const code=await build({entryPoints:[file.pathname],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'three',setup(b){b.onResolve({filter:/^three$/},()=>({path:new URL('../webapp/node_modules/three/build/three.module.js',import.meta.url).href,external:true}));}}]});
  const {createKerbLayer}=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));
  const point=new T.Vector3(),matrix=new T.Matrix4();
  for(const {id} of TRACKS){
    const track=makeTrack(id),polygons=trackSurface(track).polygons,layer=createKerbLayer(track);
    assert.ok(layer.children.length>5&&layer.children.every(m=>m.frustumCulled&&m.boundingSphere.radius<70));
    for(const mesh of layer.children)for(let i=0;i<mesh.count;i+=19){
      mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);let nearest=Infinity;
      for(const poly of polygons)for(const ring of poly)for(let j=0;j<ring.length-1;j++){
        const a=ring[j],b=ring[j+1],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((point.x-a[0])*dx+(point.z-a[1])*dz)/(dx*dx+dz*dz)));
        nearest=Math.min(nearest,Math.hypot(point.x-a[0]-t*dx,point.z-a[1]-t*dz));
      }
      assert.ok(nearest<.081,id+' a kerb moved away from the true road edge');
    }
  }
});

test('rendered asphalt faces upwards on all six circuits, including folded joins',async()=>{
  const file=new URL('../webapp/src/games/kartroyale/RaceSurface.ts',import.meta.url);
  const code=await build({entryPoints:[file.pathname],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'three',setup(b){b.onResolve({filter:/^three$/},()=>({path:new URL('../webapp/node_modules/three/build/three.module.js',import.meta.url).href,external:true}));}}]});
  const {createRaceSurfaceGeometry}=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));
  for(const {id} of TRACKS){
    const track=makeTrack(id),geo=createRaceSurfaceGeometry(track),p=geo.attributes.position,indices=geo.index.array;
    assert.equal(indices.length,track.points.length*6);
    for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3),normal=(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a));assert.ok(normal>=-1e-4,id+' downward-facing asphalt triangle');}
    geo.dispose();
  }
});
