const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const web=require('node:module').createRequire(path.resolve(__dirname,'../webapp/package.json'));
const ts=web('typescript'),T=web('three');
const src=path.resolve(__dirname,'../webapp/src/games');
let landscape,world,safety,infrastructure,street,verified;
test.before(async()=>{
 [landscape,world,safety,infrastructure,street,verified]=await Promise.all([
  import('../webapp/src/games/tiranastreets/shared/landscape.mjs'),
  import('../webapp/src/games/tiranastreets/shared/world.mjs'),
  import('../webapp/src/games/tiranastreets/shared/streetSafety.mjs'),
  import('../webapp/src/games/tirana-environment/infrastructureCore.mjs'),
  import('../webapp/src/games/tiranastreets/shared/streetLayout.mjs'),
  import('../webapp/src/games/tiranastreets-november/shared/verifiedStreetDecorData.mjs')
 ]);
});
function infrastructureLayer(blocked){
 const module={exports:{}},dependencies={
  three:T,'../tiranastreets/shared/streetSafety.mjs':safety,
  '../tiranastreets/shared/world.mjs':world,'../tiranastreets/shared/landscape.mjs':landscape,
  '../tiranastreets/shared/streetLayout.mjs':street,'./infrastructureCore.mjs':infrastructure,
  './riverGeometry':{WATER_PATHS:[],BED_LEVEL:-1.6},'three/examples/jsm/loaders/GLTFLoader.js':{},
  './EnvironmentMaterials':{EnvironmentMaterials:class{create(){return new T.MeshStandardMaterial()}dispose(){}}}
 };
 const code=ts.transpileModule(fs.readFileSync(path.join(src,'tirana-environment/InfrastructureLayer.ts'),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>dependencies[id]});
 return new module.exports.InfrastructureLayer(false,blocked);
}
test('only physical river banks and the existing source guardrail inventory own ground barriers',()=>{
 const {RAILINGS,MAPPED_ROADSIDE_GUARD_RAILS,CITY_GROUND_RAILINGS,collideRailings}=landscape;
 assert.equal(RAILINGS.length,1692);
 assert.ok(RAILINGS.every(r=>r.river));
 assert.strictEqual(MAPPED_ROADSIDE_GUARD_RAILS,verified.VERIFIED_RAIL_PIECES);
 assert.equal(CITY_GROUND_RAILINGS.length,2185);
 assert.ok(MAPPED_ROADSIDE_GUARD_RAILS.every(r=>safety.clearRoadSegment(r.a,r.b,.32)));
 const rail=MAPPED_ROADSIDE_GUARD_RAILS.find(r=>r.id==='way/1349096664');
 assert.ok(rail&&collideRailings({x:rail.x,z:rail.z},.22),'real Serfain Fanku guardrail blocks the body');
 assert.equal(collideRailings({x:-720.226,z:855.155},.22),false,'unsupported Emin Duraku strip no longer blocks the sidewalk');
 for(const roadName of ['Rruga Sami Frashëri','Rruga Ibrahim Rugova']){
  const bridge=world.WORLD.roads.find(r=>r.name===roadName&&r.bridge&&!r.tunnel&&Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])>20);
  const rails=infrastructure.bridgeRailSections(bridge,safety.clearRoadSegment);
  assert.ok(rails.length>=32,roadName);
  assert.ok(rails.every(r=>safety.clearRoadSegment(r.a,r.b,.12)));
 }
});
test('common Three renderer separates verified low steel rails from bank pickets and obeys course exclusions',()=>{
 const rail=landscape.MAPPED_ROADSIDE_GUARD_RAILS.find(r=>r.id==='way/1349096664');
 const layer=infrastructureLayer(), guard=layer.group.getObjectByName('OSM mapped steel guardrails');
 assert.equal(guard.count,0);
 layer.update(rail,1,true);
 assert.ok(guard.count>0);
 guard.geometry.computeBoundingBox();
 assert.ok(guard.geometry.boundingBox.max.y<1,'the beam is distinct from head-high pedestrian fencing');
 assert.ok(guard.geometry.boundingBox.min.y<=.01,'support post is grounded');
 const blocked=infrastructureLayer((x,z,pad)=>Math.hypot(x-rail.x,z-rail.z)<100+pad);
 blocked.update(rail,1,true);
 assert.equal(blocked.group.getObjectByName(guard.name).count,0);
 const bank=layer.group.getObjectByName('Lana bank safety railings');
 layer.update(landscape.RAILINGS[0],2,true);assert.ok(bank.count>0);
 let destroyed=0;guard.addEventListener('dispose',()=>destroyed++);
 layer.dispose();blocked.dispose();assert.equal(destroyed,1);
});
