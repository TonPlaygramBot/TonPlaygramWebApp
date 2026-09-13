import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const webapp=fileURLToPath(new URL('../webapp/',import.meta.url)),require=createRequire(join(webapp,'package.json'));
const {build}=require('esbuild'),T=await import(pathToFileURL(join(webapp,'node_modules/three/build/three.module.js')));
const dir=mkdtempSync(join(webapp,'.cinematic-test-'));after(()=>rmSync(dir,{recursive:true,force:true}));
async function bundle(path,name){const file=join(dir,name+'.mjs');await build({entryPoints:[join(webapp,'src/games',path)],outfile:file,bundle:true,platform:'node',format:'esm',external:['three','three/*'],logLevel:'silent'});return import(pathToFileURL(file));}
const [{SceneSound},{CityAudio},{CombatEffects},{MissileVisuals},{rotorPivot},{buildingDetails,REGIONS,regionAt},{RegionalArchitecture}]=await Promise.all([
 bundle('tiranastreets/SceneSound.ts','sound'),bundle('tiranastreets/audio.ts','city-audio'),bundle('tiranastreets/CombatEffects.ts','effects'),bundle('tiranastreets/MissileVisuals.ts','missiles'),bundle('tiranastreets/AirMobilityVisuals.ts','air'),bundle('tirana-regional-detail/layout.ts','layout'),bundle('tirana-regional-detail/RegionalArchitecture.ts','architecture')]);
class Param{value=0;setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}exponentialRampToValueAtTime(v){this.value=v;}cancelScheduledValues(){}}
class Node{gain=new Param();frequency=new Param();pan=new Param();threshold=new Param();ratio=new Param();connections=[];connect(n){this.connections.push(n);return n;}disconnect(){this.connections=[];}start(at){this.started=at;}stop(){this.stopped=true;}}
class Context{state='suspended';currentTime=1;sampleRate=1000;destination=new Node();sources=[];createGain(){return new Node();}createDynamicsCompressor(){return new Node();}createBiquadFilter(){return new Node();}createStereoPanner(){return new Node();}createOscillator(){const n=new Node();this.sources.push(n);return n;}createBufferSource(){const n=new Node();this.sources.push(n);return n;}createBuffer(_,count){return{getChannelData:()=>new Float32Array(count)};}async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}}
globalThis.AudioContext=Context;
test('sound voices are bounded, positional, delayed and cancelled on pause/dispose',async()=>{
 const sound=new SceneSound();await sound.unlock();sound.setListener({x:0,y:0,z:0},0);
 assert.ok(sound.spatial({x:100,z:0}).pan>.9);assert.ok(sound.spatial({x:100,z:0}).delay>.29);
 sound.setListener({x:0,z:0},Math.PI);assert.ok(sound.spatial({x:100,z:0}).pan<-.9);
 for(let i=0;i<50;i++)sound.event('blast',{x:100,z:0});assert.equal(sound.activeVoices,24);
 const ctx=sound.context;assert.ok(ctx.sources.every(s=>s.started>=1.29));
 sound.suspend();assert.equal(sound.activeVoices,0);assert.ok(ctx.sources.every(s=>s.stopped&&s.connections.length===0));
 await sound.unlock();sound.event('reload');assert.equal(sound.activeVoices,2);sound.setVolume(0);assert.equal(sound.activeVoices,0);
 sound.dispose();sound.dispose();await sound.unlock();assert.equal(ctx.state,'closed');assert.equal(sound.context,null);
});
test('city sound does not replay snapshot events or produce footsteps during flight',()=>{
 const audio=new CityAudio(),events=[];audio.sound.event=k=>events.push(k);audio.sound.loop=()=>{};
 const p={id:'local',x:0,z:0,speed:7,health:100,heading:0,aircraftId:'jet'};
 const state={elapsed:1,effectSeq:1,effects:[{id:1,kind:'launch',x:0,z:0}],units:[]};
 audio.city(state,p,1);audio.city({...state,elapsed:2},p,1);assert.deepEqual(events,['launch']);
 p.aircraftId=null;audio.city({...state,elapsed:3},p,1,0,false);assert.deepEqual(events,['launch']);
 audio.city({...state,elapsed:4},p,1);assert.deepEqual(events,['launch','step']);audio.destroy();
});
test('demolition has masonry and dust without a second blast; reset restores materials',()=>{
 const scene=new T.Scene(),fx=new CombatEffects(scene),camera=new T.PerspectiveCamera();
 fx.consume([{id:1,kind:'fracture',x:0,y:3,z:0,toX:0,toZ:0,radius:3}]);fx.update(.016,camera);
 assert.equal(fx.pools[0].items.length,0);assert.ok(fx.pools[2].items.length>0);assert.ok(fx.pools[5].items.length>0);
 const material=new T.MeshStandardMaterial(),original=material.onBeforeCompile,wall=new T.Mesh(new T.BoxGeometry(12,15,3),material);scene.add(wall);
 fx.fracture(scene,[{x:0,y:3,z:0,radius:3}]);assert.notEqual(material.onBeforeCompile,original);
 fx.reset();assert.equal(material.onBeforeCompile,original);assert.equal(fx.dustQueue.length,0);assert.ok(fx.lights.every(l=>l.intensity===0));fx.dispose();wall.geometry.dispose();material.dispose();
});
test('missile trails retain stable IDs when missiles disappear and all pools expire',()=>{
 const fx=new CombatEffects(new T.Scene()),camera=new T.PerspectiveCamera();
 fx.update(.016,camera,[],[{id:1,x:0,y:10,z:0},{id:2,x:100,y:10,z:0}]);
 fx.update(.016,camera,[],[{id:2,x:102,y:10,z:0}]);assert.equal(fx.trails.size,1);assert.ok(fx.pools[1].items.every(p=>p.p.x>=100));
 for(let i=0;i<500;i++){fx.explosion({x:0,y:1,z:0});fx.shot({x:0,y:1,z:0},{x:0,y:1,z:-20});}
 fx.update(.016,camera);assert.ok(fx.pools.every(p=>p.items.length<=p.capacity));assert.ok(fx.dustQueue.length<=12);
 fx.update(10,camera);assert.ok(fx.pools.every(p=>p.mesh.count===0));fx.dispose();
});
test('missile nose follows authoritative 3D direction with an eight-instance cap',()=>{
 const scene=new T.Scene(),v=new MissileVisuals(scene),direction=new T.Vector3(1,.4,-2).normalize();
 v.update(Array.from({length:20},()=>({x:4,y:8,z:9,direction})));assert.equal(v.mesh.count,8);
 const matrix=new T.Matrix4();v.mesh.getMatrixAt(0,matrix);assert.ok(new T.Vector3(0,1,0).transformDirection(matrix).distanceTo(direction)<1e-6);
 assert.deepEqual(new T.Vector3().setFromMatrixPosition(matrix).toArray(),[4,8,9]);v.update([{x:NaN,y:0,z:0,direction}]);assert.equal(v.mesh.count,0);v.dispose();assert.equal(scene.children.length,0);
});
test('rotor recentering preserves authored world geometry and spins about its center',()=>{
 const parent=new T.Group();parent.position.set(8,5,-3);parent.rotation.y=.5;parent.scale.setScalar(.02);
 const mesh=new T.Mesh(new T.BoxGeometry(12,.1,2).translate(15,8,0),new T.MeshBasicMaterial());mesh.rotation.z=.1;parent.add(mesh);parent.updateMatrixWorld(true);
 const before=new T.Box3().setFromObject(mesh),{pivot,axis}=rotorPivot(mesh),afterBox=new T.Box3().setFromObject(mesh);
 assert.ok(before.min.distanceTo(afterBox.min)<1e-8);assert.ok(before.max.distanceTo(afterBox.max)<1e-8);
 const center=before.getCenter(new T.Vector3());pivot.rotateOnAxis(axis,.8);parent.updateMatrixWorld(true);assert.ok(new T.Box3().setFromObject(mesh).getCenter(new T.Vector3()).distanceTo(center)<1e-8);mesh.geometry.dispose();mesh.material.dispose();
});
test('regional detail uses unchanged footprints, all requested areas, and no courtyard tanks',()=>{
 for(const r of REGIONS)assert.ok(regionAt(r.x,r.z));
 const b={id:'test',p:[[0,0],[16,0],[16,12],[0,12]],h:10,levels:3,roofShape:'flat',tags:{building:'apartments'},holes:[]},copy=JSON.stringify(b);
 const details=buildingDetails(b);assert.equal(JSON.stringify(b),copy);assert.ok(details.some(d=>d.model==='tank'));assert.ok(details.some(d=>d.model==='balcony'));
 b.holes=[[[4,4],[8,4],[8,8],[4,8]]];assert.ok(!buildingDetails(b).some(d=>d.model==='tank'));b.holes=[];b.roofShape='gabled';assert.ok(!buildingDetails(b).some(d=>d.model==='tank'));
});
test('Blender detail loads lazily, stays inside draw/triangle budgets, and releases resources',async()=>{
 const {KIT}=await bundle('tirana-regional-detail/kitData.ts','kit');let loads=0;
 const buildings=Array.from({length:30},(_,i)=>({id:'test-'+i,p:[[1300+i,890],[1316+i,890],[1316+i,902],[1300+i,902]],h:14,levels:4,roofShape:'flat',tags:{building:'apartments'},holes:[]}));
 const layer=new RegionalArchitecture(buildings,async()=>{loads++;return{KIT};});assert.equal(loads,0);
 layer.update(0,{x:1300,z:895});await new Promise(resolve=>setTimeout(resolve,0));layer.update(1,{x:1300,z:895});assert.equal(loads,1);assert.equal(layer.group.children.length,9);assert.ok(layer.group.userData.triangles<=48000&&layer.group.userData.triangles>0);
 layer.update(2,{x:1300,z:895},true);assert.ok(layer.group.userData.triangles<=24000);
 layer.update(3,{x:90000,z:90000});assert.ok(layer.group.children.every(m=>m.count===0));layer.dispose();assert.equal(layer.group.children.length,0);
});
test('packed Blender Grand decodes to metre dimensions without a decoder download',async()=>{
 const {GLTFLoader}=await import(pathToFileURL(join(webapp,'node_modules/three/examples/jsm/loaders/GLTFLoader.js')));
 const bytes=readFileSync(join(webapp,'public/assets/tirana-streets/neighbourhood/grand.glb')),len=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+len));
 assert.ok(doc.extensionsRequired.includes('KHR_mesh_quantization'));const binary=bytes.subarray(28+len);
 doc.buffers[0].uri='data:application/octet-stream;base64,'+binary.toString('base64');delete doc.images;delete doc.textures;doc.materials=doc.materials.map(m=>({name:m.name,pbrMetallicRoughness:{baseColorFactor:m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1]}}));
 globalThis.ProgressEvent ||= class ProgressEvent{constructor(type,args){Object.assign(this,{type,...args});}};
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');const size=new T.Box3().setFromObject(gltf.scene).getSize(new T.Vector3());assert.ok(size.x>90&&size.x<110);assert.ok(size.y>28&&size.y<33);assert.ok(size.z>30&&size.z<45);
 gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
});
