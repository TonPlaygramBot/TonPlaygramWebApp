import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {buildMobility,initialState,stepRoam,vehicleAction} from '../webapp/src/games/tirana-standalone/walkDrive.mjs';
const js=path=>readFileSync(new URL('../webapp/'+path,import.meta.url),'utf8');
const asset=path=>new URL('../webapp/public/assets/tirana-city-game/'+path,import.meta.url);
const city=JSON.parse(readFileSync(asset('central-city.json')));
const m=buildMobility(city);
const center=state=>[state.x,state.z];
const idle={x:0,y:0},forward={x:0,y:1};
const run=(state,world,inputs,n)=>{for(let i=0;i<n;i++)stepRoam(state,world,inputs,1/60);};
const flat={bounds:[-40,-45,40,45],buildings:[],markings:[],landmarks:[{id:'square',x:0,z:0}],roads:[{a:[0,-41],b:[0,41],w:12}],water:[]};
test('published map starts on foot, can enter parked city car, drive, and must brake before exiting',()=>{
  const s=initialState(m);
  assert.equal(s.mode,'walk');assert.equal(m.obstructed(...center(s),.33),false);
  assert.notDeepEqual(center(s),[s.car.x,s.car.z]);assert.equal(vehicleAction(s,m),'');
  assert.equal(s.mode,'drive');
  const before=center(s);run(s,m,forward,28);
  assert.ok(Math.hypot(s.x-before[0],s.z-before[1])>.18);
  assert.match(vehicleAction(s,m),/Ndal/);
  run(s,m,{...idle,brake:true},80);
  assert.equal(s.car.speed,0);assert.equal(vehicleAction(s,m),'');assert.equal(s.mode,'walk');
  assert.equal(m.obstructed(...center(s),.33),false);
});
test('walk can move away but cannot enter a remote parked car; idle never drifts',()=>{
  const s=initialState(m),start=center(s);
  run(s,m,{x:0,y:-1},85);
  assert.ok(Math.hypot(s.x-start[0],s.z-start[1])>2);
  assert.match(vehicleAction(s,m),/Afrohu/);
  const end=center(s);run(s,m,idle,120);
  assert.deepEqual(center(s),end);
});
test('car requires mapped roads: private foot route, footprint walls, and river require no map bypass',()=>{
  const m=buildMobility({...flat,roads:[...flat.roads,{a:[0,11],b:[39,11],w:8,walk:true}],buildings:[{p:[[4,20],[12,20],[12,25],[4,25]]}],water:[{a:[-35,4],b:[35,4],w:3}]});
  assert.equal(m.validCar(19,11,Math.PI/2),false);
  assert.equal(m.obstructed(4.1,22,.33),true);
  assert.equal(m.obstructed(40,0,.33),true);
  assert.equal(m.validCar(0,4,0),false);
  const bridge=buildMobility({...flat,roads:[...flat.roads,{a:[0,-1],b:[0,9],w:8,bridge:true}],water:[{a:[-35,4],b:[35,4],w:3}]});
  assert.equal(bridge.validCar(0,4,0),true);
  assert.equal(bridge.obstructed(11,4,.33),true);
});
test('walk only exits when a legal standing spot exists; reverse and stop preserve shared position',()=>{
  const m=buildMobility(flat),s=initialState(m);assert.equal(vehicleAction(s,m),'');
  assert.match(vehicleAction(s,{...m,obstructed:()=>true}),/hapësirë/);assert.equal(s.mode,'drive');
  const start=s.z;run(s,m,{x:0,y:-1},65);assert.ok(s.z<start-1);
  assert.equal(s.z,s.car.z);run(s,m,{...idle,brake:true},75);assert.equal(s.car.speed,0);
  assert.equal(vehicleAction(s,m),'');
});
test('startup is staged and identically named assets are namespaced away from Racing and Optika',()=>{
  const code=js('src/games/tirana-standalone/CityRoamView.js'),app=js('src/App.jsx'),ui=js('src/pages/Games/TiranaStreets.jsx'),catalog=js('src/config/gamesCatalog.js');
  assert.match(app,/React\.lazy\(\(\) => import\('\.\/pages\/Games\/TiranaStreets\.jsx'\)\)/);
  for(const route of ['/games/tiranastreets','/games/tiranastreets/lobby'])assert.ok(app.includes('path="'+route+'" element={<TiranaStreets />}'));
  assert.ok(app.includes('path="/games/kartroyale" element={<KartRoyale />}'));
  assert.match(catalog,/name: 'Tirana Streets',\s+route: '\/games\/tiranastreets\/lobby'/);
  assert.match(ui,/import\('\.\.\/\.\.\/games\/tirana-standalone\/CityRoamView\.js'\)/);
  assert.match(code,/this\.renderer\.render\(this\.scene,this\.camera\);\s+if\(!this\.firstFrame\)\{this\.firstFrame=true;this\.emit\(\);this\.loadDetail\(\);\}/);
  for(const banned of [/WP\b|socket\.io|websocket|localStorage|document\.cookie/i,/wallet|\/api\/|blackwater|optika|kartroyale|ExploreGame|TiranaCityScene/i])assert.doesNotMatch(code+ui,banned);
  assert.match(ui,/rel="noreferrer">© OpenStreetMap contributors/);
});
const gltf=(filename,source=asset)=>{const b=readFileSync(source(filename));assert.equal(b.subarray(0,4).toString(),'glTF');return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));};
test('first-run asset budget and provenance: scoped map, safe exterior mesh allowlist, no additional remote requests',()=>{
  assert.ok(statSync(asset('central-city.json')).size<180_000);
  assert.ok(statSync(asset('public-landmarks.glb')).size<900_000);
  const monuments=gltf('public-landmarks.glb');
  assert.deepEqual(monuments.nodes.map(n=>n.name).sort(),['clock','mosque']);
  assert.ok(!(monuments.images||[]).some(i=>i.uri));
  assert.deepEqual(gltf('sedan.glb').images.map(i=>i.uri),['Textures/colormap.png']);
  assert.ok(statSync(asset('Textures/colormap.png')).isFile());
  assert.deepEqual(readdirSync(asset('')).filter(name=>name!=='historic').sort(),['ATTRIBUTION.md','KENNEY-CARS-LICENSE.txt','Textures','asphalt-color.webp','asphalt-normal.webp','central-city.json','cover.svg','districts','mobility','public-landmarks.glb','sedan.glb','wall-plaster-512.webp'].sort());
});

test('jump is grounded and does not allow walls, and drive cancels airborne state',()=>{
  const m=buildMobility(flat),s=initialState(m);
  stepRoam(s,m,{...idle,jump:true},1/60); assert.ok(s.walkY>0);
  run(s,m,idle,60);assert.equal(s.walkY,0);
  stepRoam(s,m,{...idle,jump:true},1/60);assert.equal(vehicleAction(s,m),'');
  assert.equal(s.walkY,0);assert.equal(s.walkVy,0);
});
test('all camera sequences retained; exact Turi attachment loaded only for player-selected walk camera',async()=>{
  const {nextView,useAvatar,mapSvg,waypoint}=await import('../webapp/src/games/tirana-standalone/roamPresentation.mjs');
  assert.deepEqual(['eyes','shoulder','wide'].map(view=>nextView('walk',view)),['shoulder','wide','eyes']);
  assert.deepEqual(['chase','wide','cockpit'].map(view=>nextView('drive',view)),['wide','cockpit','chase']);
  const s=initialState(m);assert.equal(useAvatar(s,'eyes'),false);assert.equal(useAvatar(s,'shoulder'),true);
  assert.ok(mapSvg(city).road.length>9800);assert.equal(mapSvg(city).points.length,3);
  assert.equal(waypoint(s,city.landmarks,'square').name,'Sheshi Skënderbej');
  assert.equal(waypoint(s,city.landmarks,'missing'),null);
  const code=js('src/games/tirana-standalone/CityRoamView.js');
  assert.match(code,/if\(this.walkView!=='eyes'\)void this.loadAvatar\(\)/);
  const {createHash}=await import('node:crypto');
  const turi=path=>new URL('../webapp/public/assets/tirana-streets/players/'+path,import.meta.url);
  const model=readFileSync(turi('turi.glb'));
  assert.equal(createHash('sha256').update(model).digest('hex'),'15aa91bb5206589087df60e47911f3b64ec1d95b4e380a685b3b025f21446f02');
  assert.deepEqual(gltf('turi.glb',turi).animations.map(a=>a.name),['Idle','Walk','Run']);
});

test('Lana extension does not need a startup request; late union opens its seam without opening blank corners',async()=>{
  const {approachLana,appendDistrict, districtPlacements}=await import('../webapp/src/games/tirana-standalone/district.mjs');
  const extension=JSON.parse(readFileSync(asset('districts/lana-blloku.json')));
  assert.equal(approachLana(initialState(m)),false);
  assert.equal(approachLana({x:-80,z:440}),true);
  const merged=appendDistrict(city,extension),updated=buildMobility(merged);
  assert.equal(m.obstructed(-145.3,415,.3),true);
  assert.ok(Array.from({length:350},(_,i)=>i+160).some(z=>!updated.obstructed(-145.3,z,.3)&&!updated.obstructed(-144.3,z,.3)));
  assert.ok(Array.from({length:350},(_,i)=>i+160).some(z=>[0,Math.PI/2,Math.PI/4,-Math.PI/4].some(yaw=>updated.validCar(-145.3,z,yaw)&&updated.validCar(-144.3,z,yaw))));
  assert.equal(updated.obstructed(-455,20,.3),true);
  assert.ok(extension.water.length>0);
  const places=districtPlacements(extension,updated);
  assert.ok(places.some(p=>p.kind==='tree'));
  assert.ok(places.some(p=>p.kind==='park-bench'));
  assert.ok(places.some(p=>p.kind==='water-tank'));
  assert.ok(places.filter(p=>p.kind==='tree').every(p=>!updated.obstructed(p.x,p.z,1.9)));
  assert.equal(statSync(asset('districts/lana-blloku.json')).size,86136);
  assert.equal(statSync(asset('districts/lana-tree.glb')).size,1639700);
  const tree=gltf('districts/lana-tree.glb');
  assert.ok(tree.images.length===9&&!tree.images.some(image=>image.uri));
  assert.equal(tree.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+(tree.accessors[p.indices]?.count||tree.accessors[p.attributes.POSITION].count)/3,0),17928);
});
