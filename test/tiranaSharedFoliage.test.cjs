const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const web = require('node:module').createRequire(path.resolve(__dirname,'../webapp/package.json'));
const ts = web('typescript'), T = web('three');
const root = path.resolve(__dirname,'../webapp/src/games');
const get = name => fs.readFileSync(path.join(root,name),'utf8');
const mod = {exports:{}};
vm.runInNewContext(ts.transpileModule(get('tirana-street-life/DistantBroadleafLayer.ts'),{
 compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText, {module:mod,exports:mod.exports,require:web});
const {acquireDistanceTreeTexture, distanceTreeProfiles, updateActiveTreeInstances} = mod.exports;

test('active foliage owners share one texture and only final release disposes it', async () => {
 let reads=0, disposals=0;
 const texture=new T.Texture();
 texture.addEventListener('dispose',()=>disposals++);
 const loader=async()=>{reads++;return texture;};
 const street=acquireDistanceTreeTexture('same',loader);
 const completion=acquireDistanceTreeTexture('same',loader);
 assert.equal(await street.ready,await completion.ready);
 assert.equal(reads,1);
 street.release();street.release();assert.equal(disposals,0);
 completion.release();assert.equal(disposals,1);
});

test('release during decode does not dispose a replacement or cache failed traffic', async () => {
 const spent=new T.Texture(), replacement=new T.Texture();
 let disposed=0, remaining=0, finish;
 spent.addEventListener('dispose',()=>disposed++);
 replacement.addEventListener('dispose',()=>remaining++);
 const old=acquireDistanceTreeTexture('early',()=>new Promise(resolve=>{finish=resolve}));
 await Promise.resolve();
 old.release();
 const newone=acquireDistanceTreeTexture('early',async()=>replacement);
 finish(spent);
 assert.equal(await old.ready,spent);
 assert.equal(await newone.ready,replacement);
 assert.equal(disposed,1);assert.equal(remaining,0);
 newone.release();assert.equal(remaining,1);
 const failure=acquireDistanceTreeTexture('failure',async()=>{throw Error('missing texture')});
 await assert.rejects(failure.ready);
 failure.release();
 const recovered=acquireDistanceTreeTexture('failure',async()=>new T.Texture());
 assert.ok(await recovered.ready);recovered.release();
});

test('only eligible profile buffers are allocated and Racing explicitly enables existing shared rendering path', () => {
 const profiles=distanceTreeProfiles([{shape:'column'},{shape:'garden'},{shape:'column'}]);
 assert.deepEqual(Array.from(profiles,x=>[x.profileId,x.mesh.instanceMatrix.count]),[['broadleaf',1],['column',2]]);
 profiles.forEach(x=>x.dispose());
 assert.match(get('kartroyale/tiranaScenery.ts'),/new TiranaCityScene\(true, freeRoam\?undefined:track, true\)/);
 assert.match(get('tiranastreets/TiranaCityScene.ts'),/matureTreeFoliage: {[\s\S]{0,140}cullFarTrees:true[\s\S]{0,140}sourceDistantBroadleaf:true/);
 assert.match(get('tiranastreets-november/renderer.ts'),/sourceDistantBroadleaf:true/);
});

test('fallback matrix upload prefix matches active tree count', () => {
 assert.match(get('tirana-street-life/MatureTreeLayer.ts'), /updateActiveTreeInstances\(wood\);updateActiveTreeInstances\(leaves\)/);
 const mesh=(count)=>({count,instanceMatrix:new T.InstancedBufferAttribute(new Float32Array(64*16),16),instanceColor:new T.InstancedBufferAttribute(new Float32Array(64*3),3)});
 const wood=mesh(17),leaves=mesh(17),empty=mesh(0);
 [wood,leaves,empty].forEach(updateActiveTreeInstances);
 for(const m of [wood,leaves]) {
  assert.deepEqual(m.instanceMatrix.updateRanges,[{start:0,count:272}]);
  assert.deepEqual(m.instanceColor.updateRanges,[{start:0,count:51}]);
 }
 assert.deepEqual(empty.instanceMatrix.updateRanges,[]);
});

test('racing foliage options reach mature trees only; completion keeps its original caller camera and options', () => {
 const source=get('tirana-expansion/WorldEnhancements.ts');
 assert.match(source,/this.cullFarTrees=!!options.cullFarTrees/);
 assert.match(source,/this.cityCompletion=new CityCompletionLayer\(options, undefined, options.soloSignals, options.mapTree\)/);
 assert.match(source,/this.cityCompletion.update\(seconds,viewer,battery,this.cullFarTrees\?camera:undefined\)/);
 assert.match(source,/new MatureTreeLayer\([\s\S]{0,130}options.matureTreeFoliage\?{\.\.\.options,\.\.\.options.matureTreeFoliage}:options/);
 const racing=get('tiranastreets/TiranaCityScene.ts');
 assert.doesNotMatch(racing,/profile: 'fps', track,\s*cullFarTrees:/);
});
