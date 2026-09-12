import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {environmentAt} from '../webapp/src/games/tirana-environment/weatherCore.mjs';
import {facadeModules} from '../webapp/src/games/tirana-city-completion/facadeCore.mjs';
const temporary=await mkdtemp(join(tmpdir(),'tirana-environment-'));
let api;
try{
 const file=join(temporary,'runtime.mjs');
 await build({stdin:{contents:"export {UrbanLighting} from './src/games/tirana-environment/UrbanLighting';export {PavementAprons} from './src/games/tirana-environment/PavementAprons';export * as T from 'three';export {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';export * from './src/games/tirana-environment/riverGeometry';export {LandscapeVisuals} from './src/games/tiranastreets/landscapeVisuals';export {CinematicAtmosphere} from './src/games/tirana-environment/CinematicAtmosphere';export {MappedBuildingCells} from './src/games/tirana-neighbourhood/MappedBuildingCells';export {WORLD} from './src/games/tiranastreets/shared/world.mjs';",resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},outfile:file,bundle:true,platform:'node',format:'esm'});
 api=await import(pathToFileURL(file));
}finally{await rm(temporary,{recursive:true,force:true});}
const {T}=api;
test('random start time and weather are deterministic and continuous across slot boundaries',()=>{
 const hours=new Set(),weather=new Set();
 for(let seed=0;seed<1000;seed++){
  hours.add(Math.floor(environmentAt(seed).hour));
  for(let t=0;t<1800;t+=91){const p=environmentAt(seed,t);weather.add(p.name);assert.deepEqual(p,environmentAt(seed,t));for(const key of ['cloud','rain','wetness','daylight','night'])assert.ok(p[key]>=0&&p[key]<=1);assert.ok(p.hour>=0&&p.hour<24);}
  for(const t of [300,600,900]){const a=environmentAt(seed,t-1e-4),b=environmentAt(seed,t+1e-4);for(const key of ['cloud','rain','fog','wetness'])assert.ok(Math.abs(a[key]-b[key])<1e-5,key);}
 }
 assert.equal(hours.size,24);assert.equal(weather.size,5);
});
test('both embankments face upwards, including bends and reversed source ways',()=>{
 for(const line of [[[0,0],[10,0]],[[0,0],[10,3],[18,-4]],[[10,0],[0,0]]])for(const side of [-1,1]){
  const g=api.bankGeometry({id:'sample',width:8,line},side*4,-3,side*10,0),p=g.getAttribute('position'),n=g.getAttribute('normal');
  for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i)));assert.ok(n.getY(i)>.2,`down-facing bank: ${n.getY(i)}`);}g.dispose();
 }
});
test('actual terrain opens the sourced Lana instead of hiding it under a ground plane',()=>{
 const layer=new api.LandscapeVisuals(false),ground=layer.group.getObjectByName('Terrain with open watercourses');layer.group.updateMatrixWorld(true);
 const ray=new T.Raycaster();let samples=0;
 for(const path of api.WATER_PATHS.filter(p=>p.lana))for(let i=1;i<path.line.length;i+=5){const [x,z]=path.line[i],b=api.WORLD.bounds;if(x<b[0]+50||x>b[2]-50||z<b[1]+50||z>b[3]-50)continue;
  ray.set(new T.Vector3(x,20,z),new T.Vector3(0,-1,0));assert.equal(ray.intersectObject(ground,false).length,0,`${path.id}:${i}`);samples++;
 }
 assert.ok(samples>60);assert.ok(api.WATER_LEVEL < -2.5);assert.ok(api.BED_LEVEL<api.WATER_LEVEL);
 layer.update({x:0,z:430},0,false);assert.equal(layer.infrastructure.group.userData.bridgeSegments,api.WORLD.roads.filter(r=>r.bridge&&!r.tunnel&&Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])>.2).length);
 for(const p of [{x:1200,z:250},{x:-3700,z:-3000},{x:4000,z:3000}]){layer.update(p,10+Math.abs(p.x),true);layer.group.traverse(o=>{if(o.isInstancedMesh){assert.ok(o.count<=o.instanceMatrix.count);for(let i=0;i<o.count*16;i++)assert.ok(Number.isFinite(o.instanceMatrix.array[i]));}});}
 layer.dispose();layer.dispose();assert.equal(layer.group.children.length,0);layer.update({x:0,z:0},100,false);assert.equal(layer.group.children.length,0);
});
test('weather changes the real Three scene, wet surfaces and bounded rain, then retires cleanly',()=>{
 const scene=new T.Scene(),renderer={toneMappingExposure:1},camera=new T.PerspectiveCamera(65,.5,.1,1200);
 const material=new T.MeshStandardMaterial({roughness:.95,color:0xaaaaaa});material.userData.environmentSurface=true;scene.add(new T.Mesh(new T.PlaneGeometry(20,20),material));
 const atmosphere=new api.CinematicAtmosphere(scene,renderer,17);let rainy;
 for(let t=0;t<10000;t+=150){atmosphere.update(t,camera,false);if(atmosphere.current.rain>.9){rainy=t;break;}}
 assert.ok(rainy!==undefined);assert.ok(material.roughness<.5);assert.ok(scene.fog.density>.001);assert.equal(atmosphere.group.getObjectByName('Local rain').geometry.drawRange.count,1440);
 atmosphere.update(rainy,camera,true);assert.equal(atmosphere.group.getObjectByName('Local rain').geometry.drawRange.count,360);
 atmosphere.dispose();atmosphere.dispose();assert.equal(material.roughness,.95);assert.equal(atmosphere.group.children.length,0);
});
test('all new Poly Haven maps match recorded hashes and the shipped GLB decodes',async()=>{
 const base=new URL('../webapp/public/assets/tirana-streets/environment/',import.meta.url),sources=JSON.parse(await readFile(new URL('sources.json',base),'utf8'));
 assert.equal(sources.length,12);for(const source of sources){const bytes=await readFile(new URL(source.file,base));assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);assert.equal(source.license,'CC0-1.0');assert.deepEqual(source.size,[1024,1024]);assert.ok(bytes.length<600000);}
 const data=await readFile(new URL('roadside-rail.glb',base)),gltf=await new api.GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 const mesh=gltf.scene.getObjectByName('roadside-rail');assert.ok(mesh?.isMesh);mesh.geometry.computeBoundingBox();assert.ok(mesh.geometry.boundingBox.max.y>1);assert.ok(mesh.geometry.boundingBox.max.x<1.4);
});
test('estimated-height buildings gain a finished shell without changing their source heights',()=>{
 T.TextureLoader.prototype.load=function(_url,onLoad){const texture=new T.Texture();queueMicrotask(()=>onLoad?.(texture));return texture;};
 const building={id:'estimate',p:[[0,0],[20,0],[20,15],[0,15]],h:12,levels:null,heightSource:'unknown',tags:{building:'apartments'}},before=JSON.stringify(building);
 const layer=new api.MappedBuildingCells([building],new T.MeshStandardMaterial({vertexColors:true}),new T.MeshStandardMaterial(),false),root=layer.build([building]);
 assert.equal(root.children.length,3);assert.ok(root.children.some(m=>m.userData.windows));assert.ok(facadeModules(building,{allowEstimatedHeight:true}).some(p=>p.model==='entrance_bay'));assert.equal(JSON.stringify(building),before);layer.dispose();
});

test('street lights, shop lights and apartment windows follow the same day/night clock',()=>{
 const scene=new T.Scene(),renderer={toneMappingExposure:1},camera=new T.PerspectiveCamera(55,.5,.1,1200);
 const lighting=new api.UrbanLighting();scene.add(lighting.group);lighting.update({x:0,z:430},0,false);
 const glass=new T.MeshStandardMaterial({color:0x345663});glass.userData.environmentWindow=true;scene.add(new T.Mesh(new T.PlaneGeometry(2,2),glass));
 const sign=new T.MeshStandardMaterial({emissive:0xffffff});sign.userData.environmentLight='business';sign.userData.nightIntensity=1.4;scene.add(new T.Mesh(new T.PlaneGeometry(2,1),sign));
 const atmosphere=new api.CinematicAtmosphere(scene,renderer,17);
 let day,night;for(let t=0;t<5000;t+=10){const p=environmentAt(17,t);if(p.hour>12&&p.hour<14)day=t;if(p.hour>20&&p.hour<22)night=t;}
 assert.ok(day!==undefined&&night!==undefined);
 atmosphere.update(night,camera,false);const active=[];lighting.group.traverse(o=>{if(o.isPointLight&&o.intensity>0)active.push(o);});assert.ok(active.length>0&&active.length<=8);assert.ok(glass.emissiveIntensity>0);assert.ok(sign.emissiveIntensity>0);assert.ok(glass.userData.roomLighting);
 atmosphere.update(day,camera,false);lighting.group.traverse(o=>{if(o.isPointLight)assert.equal(o.intensity,0);});assert.equal(glass.emissiveIntensity,0);assert.equal(sign.emissiveIntensity,0);
 lighting.update({x:0,z:430},1,true);atmosphere.update(night,camera,true);const battery=[];lighting.group.traverse(o=>{if(o.isPointLight&&o.intensity>0)battery.push(o);});assert.ok(battery.length<=3);
 atmosphere.dispose();lighting.dispose();
});
test('large-building paving streams above grass, below asphalt, and releases geometry',()=>{
 const material=new T.MeshStandardMaterial();const world={buildings:[{id:'large',h:30,p:[[0,-200],[30,-200],[30,-170],[0,-170]]}]};
 const layer=new api.PavementAprons(world,material);assert.equal(layer.group.children.length,0);
 layer.update({x:15,z:-185},0,false);assert.ok(layer.group.children.length>0);layer.group.updateMatrixWorld(true);
 const ray=new T.Raycaster(new T.Vector3(-1,4,-185),new T.Vector3(0,-1,0));const hits=ray.intersectObject(layer.group,true);assert.ok(hits.length>0);assert.ok(hits[0].point.y>.061&&hits[0].point.y<.09);
 let disposed=0;layer.group.children[0].geometry.addEventListener('dispose',()=>disposed++);layer.dispose();layer.dispose();assert.equal(disposed,1);assert.equal(layer.group.children.length,0);material.dispose();
});
