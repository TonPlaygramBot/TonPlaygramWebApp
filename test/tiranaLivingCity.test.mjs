// CPU geometry, asset and scheduling checks. No browser/GPU is implied.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {CellWorkQueue} from '../webapp/src/games/tirana-neighbourhood/cellWorkQueue.mjs';
import {buildStreetModel} from '../webapp/src/games/tirana-street-life/streetModels.mjs';
import {signReferenceFor} from '../webapp/src/games/tirana-street-life/signReferences.mjs';
import {drivingScale,cornerSpeed} from '../webapp/src/games/tiranastreets/shared/drivingScale.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
const webapp=fileURLToPath(new URL('../webapp/',import.meta.url)),dir=mkdtempSync(webapp+'.living-test-');
test.after(()=>rmSync(dir,{recursive:true,force:true}));
const outfile=dir+'/runtime.mjs';
await build({stdin:{contents:`export {RainPuddles} from './src/games/tirana-environment/RainPuddles';export {MappedParkLife} from './src/games/tirana-environment/MappedParkLife';`,resolveDir:webapp,loader:'ts'},bundle:true,platform:'node',format:'esm',external:['three','three/*'],outfile,logLevel:'silent'});
const {RainPuddles,MappedParkLife}=await import(pathToFileURL(outfile));

test('streaming retains progress when the viewer requests the same cell again',()=>{
  let started=0,steps=0,closed=0;
  function* work(){started++;try{for(let i=0;i<8;i++){steps++;yield;}}finally{closed++;}}
  const q=new CellWorkQueue(),task={key:'same-cell',create:work};
  q.sync([task]);q.run(3,2,()=>0);q.sync([task]);q.run(3,2,()=>0);
  assert.equal(started,1);assert.equal(steps,4);assert.equal(closed,0);
  q.sync([]);assert.equal(closed,1);q.dispose();assert.equal(closed,1);
});
test('cell queue respects time and step budgets and releases discarded jobs',()=>{
  let n=0;function* work(){while(true){n++;yield;}}
  const q=new CellWorkQueue();q.sync([{key:'a',create:work}]);let clock=0;q.run(3,100,()=>clock++);assert.ok(n<=2);
  const previous=n;q.run(100,3,()=>0);assert.equal(n-previous,3);q.dispose();assert.equal(q.length,0);
});
test('new trade details provide bounded geometry without duplicate walls or invented brand copy',()=>{
  for(const kind of ['hairdresser','bakery','cafe','fast_food']){
    const model=buildStreetModel({id:kind,kind,name:'Mapped shop',width:3.2,x:0,z:0,yaw:0},'store-detail');
    assert.ok(model.parts.length>0&&model.parts.length<20);assert.equal(model.signs.length,0);
    for(const p of model.parts)assert.ok([...p.p,...p.s].every(Number.isFinite));
  }
});
test('published brand assets match their recorded checksums and specific mapped names',()=>{
  const rows=JSON.parse(readFileSync(new URL('../docs/tirana-local-logo-assets.json',import.meta.url)));
  assert.equal(rows.length,10);
  for(const row of rows){const bytes=readFileSync(webapp+'public/assets/tirana-streets/signs/'+row.id+'-logo.png');assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(bytes.readUInt32BE(12),0x49484452);}
  for(const [name,id] of [['Gega Oil','gega-oil'],['Eida','eida'],['Kastrati','kastrati'],["Heb’s",'hebs'],['MonoMia','mono-mia'],['Mr. Chicken','mr-chicken'],['Crepa Crepa','crepa-crepa']])assert.equal(signReferenceFor(name)?.id,id);
  assert.notEqual(signReferenceFor('Mon Cheri')?.id,'mono-mia');assert.equal(signReferenceFor('Unknown barber'),undefined);
});
test('real-scale speed ceilings and corner braking remain in metres per second',()=>{
  assert.equal(drivingScale({model:'sedan'}).maximum*3.6,55);
  assert.equal(drivingScale({model:'tirana-bus'}).maximum*3.6,45);
  assert.equal(drivingScale({model:'sedan-sports'}).maximum*3.6,70);
  assert.ok(cornerSpeed(Math.PI/2,12)<3);assert.equal(cornerSpeed(0,12),12);
});
test('knife is a compact CC0 asset with a 30 cm blade-and-handle extent',()=>{
  const bytes=readFileSync(webapp+'public/assets/tirana-streets/living/combat-knife.glb'),j=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.match(j.asset.copyright,/Vinrax.*CC0/);assert.ok(bytes.length<180000);
  const pos=j.accessors[j.meshes[0].primitives[0].attributes.POSITION];assert.equal(pos.count/3,1176);assert.ok(Math.abs(pos.max[2]-pos.min[2]-.30)<1e-5);
});
test('rain puddles use one bounded instance pool and disappear when dry',()=>{
  const layer=new RainPuddles(),r=WORLD.roads.find(r=>!r.walk&&!r.bridge&&!r.tunnel&&r.w>=4&&Math.hypot(r.a[0]-r.b[0],r.a[1]-r.b[1])>30),viewer={x:r.a[0],z:r.a[1]};
  layer.update(0,viewer,1,1,false);const mesh=layer.group.children[0];assert.ok(mesh.isInstancedMesh&&mesh.count>0&&mesh.count<=180);
  layer.update(1,viewer,1,1,true);assert.ok(mesh.count<=60);
  layer.update(2,viewer,0,0,true);assert.equal(layer.group.visible,false);layer.dispose();assert.equal(layer.group.children.length,0);
});
test('mapped furnishings build gradually, cull far sites and dispose their geometry',()=>{
  const layer=new MappedParkLife(),site=layer.sites.find(s=>s.category==='playground');
  layer.update(0,site,false);assert.ok(layer.group.children.length>0&&layer.group.children.length<=2);
  const meshes=[];layer.group.traverse(o=>{if(o.isMesh)meshes.push(o);});let disposed=0;meshes.forEach(o=>o.geometry.addEventListener('dispose',()=>disposed++));
  layer.update(1,{x:1e6,z:1e6},false);assert.ok(layer.group.children.every(o=>!o.visible));layer.dispose();layer.dispose();assert.equal(disposed,meshes.length);
});
