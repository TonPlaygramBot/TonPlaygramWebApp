const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const web=require('node:module').createRequire(path.resolve(__dirname,'../webapp/package.json'));
const ts=web('typescript'), T=web('three');
const games=path.resolve(__dirname,'../webapp/src/games');

let landmark,road,source,ground,neighbourhood,merge;
test.before(async()=>{
 [landmark,road,source,ground,neighbourhood,merge]=await Promise.all([
  import('../webapp/src/games/tirana-landmarks/junctionLandmarks.mjs'),
  import('../webapp/src/games/tirana-street-detail/roadDetailCore.mjs'),
  import('../webapp/src/games/tirana-city-source/sourceCore.mjs'),
  import('../webapp/src/games/tirana-east/terrainCore.mjs'),
  import('../webapp/src/games/tirana-neighbourhood/data.mjs'),
  import(pathToFileURL(web.resolve('three/examples/jsm/utils/BufferGeometryUtils.js')).href)
 ]);
});
function layer(track){
 const module={exports:{}};
 const deps={three:T,'three/examples/jsm/utils/BufferGeometryUtils.js':merge,
  '../tirana-neighbourhood/data.mjs':neighbourhood,'../tirana-city-source/sourceCore.mjs':source,
  '../tirana-east/terrainCore.mjs':ground,'../tirana-street-detail/roadDetailCore.mjs':road,'./junctionLandmarks.mjs':landmark};
 const js=ts.transpileModule(fs.readFileSync(path.join(games,'tirana-landmarks/UrbanJunctionDetails.ts'),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText;
 vm.runInNewContext(js,{module,exports:module.exports,require:id=>deps[id]});
 return new module.exports.UrbanJunctionDetails(track);
}
test('Karl Topia center is inside the complete mapped loop and leaves the roads clear',()=>{
 const {x,z,radius,poolRadius,roadWays}=landmark.ZOGU_I_ZI;
 const ring=neighbourhood.NEIGHBOURHOOD.roads.filter(r=>roadWays.includes(r.way));
 assert.deepEqual(new Set(ring.map(r=>r.way)),new Set(roadWays));
 const distances=ring.map(r=>source.segmentDistance(x,z,r.a,r.b)-r.w/2);
 assert.ok(Math.min(...distances)-radius>7,'island leaves >7 m of mapped carriageway clearance');
 assert.ok(poolRadius<radius);
});
test('shared detail meshes are staged once, compact, culled and released',()=>{
 const city=layer();
 assert.equal(city.group.children.length,2);
 const [fountain,garden]=city.group.children;
 assert.equal(fountain.children.length+garden.children.length,0,'no geometry allocated before approaching');
 city.update(landmark.ZOGU_I_ZI,true);
 assert.equal(fountain.children.length,4);
 city.update(landmark.GARDEN_BUILDING,false);
 assert.equal(garden.children.length,3);
 const tri=child=>child.children.reduce((total,o)=>total+(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*(o.count??1),0);
 assert.ok(tri(fountain)<4000);assert.ok(tri(garden)<40000);
 for(const object of [fountain,garden])for(const mesh of object.children){
  assert.ok(mesh.geometry.boundingSphere.radius>0);
  assert.ok(mesh.geometry.getAttribute('normal').count>0);
 }
 city.update({x:3000,z:3000},true);assert.equal(fountain.visible,false);assert.equal(garden.visible,false);
 let disposed=0;
 city.group.traverse(o=>o.geometry?.addEventListener('dispose',()=>disposed++));
 city.dispose();assert.equal(disposed,7);assert.equal(city.group.children.length,0);
});
test('tracks crossing the proposed island suppress the entire overlay',()=>{
 const {x,z}=landmark.ZOGU_I_ZI;
 const track={width:8,points:[[x-40,z],[x+40,z],[x+40,z-40],[x-40,z-40]]};
 const city=layer(track);
 assert.ok(!city.group.children.some(g=>g.name.includes('landscaped fountain')));
 city.dispose();
});
test('Garden Building detail targets the existing podium and separate tower parts',()=>{
 const parts=neighbourhood.NEIGHBOURHOOD.buildings.filter(b=>landmark.GARDEN_BUILDING.levels[b.id]);
 assert.deepEqual(parts.map(b=>b.levels).sort((a,b)=>a-b),[4,4,16,24]);
 assert.ok(parts.every(b=>b.part&&b.h>0));
 assert.equal(landmark.GARDEN_BUILDING.levels['889954218'],undefined);
 assert.equal(new Set(parts.map(b=>b.h)).size,3);
});
