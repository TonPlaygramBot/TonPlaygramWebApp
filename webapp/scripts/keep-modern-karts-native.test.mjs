import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {generateGamePackManifests,GAME_PACK_DEFINITIONS} from './generate-game-pack-manifests.mjs';
import {pruneNativeGamePacks} from './prune-native-game-packs.mjs';
import {keepModernKartBundled} from './keep-modern-karts-native.mjs';

const dir='assets/kart-royale/karts/';
const manifest=JSON.parse(await readFile(new URL('../public/assets/kart-royale/karts/modern-manifest.json',import.meta.url),'utf8'));
const models=manifest.assets.map(({file,bytes})=>[dir+file,bytes]);
const extra='assets/kart-royale/legacy-racer.glb';
const sha=content=>createHash('sha256').update(content).digest('hex');
const cdn='https://test.invalid';
const racing=GAME_PACK_DEFINITIONS.find(def=>def.id==='racing-royal');
const readJSON=async p=>JSON.parse(await readFile(p,'utf8'));

async function stage(t, mirrored=false){
 const distDir=await mkdtemp(path.join(os.tmpdir(),'kart-native-retain-'));
 t.after(()=>rm(distDir,{recursive:true,force:true}));
 for(const [rel,len] of [...models,[extra,128]]){
  await mkdir(path.dirname(path.join(distDir,rel)),{recursive:true});
  await writeFile(path.join(distDir,rel),Buffer.alloc(len,0x41));
 }
 const outputDir=path.join(distDir,'pwa/game-packs');
 const definitions=mirrored?[racing,{...racing,id:'racing-other'}]:[racing];
 await generateGamePackManifests({publicDir:distDir,outputDir,definitions,cdnBaseUrl:cdn});
 return {distDir,outputDir};
}

test('native allowlist matches exact authored eight full/LOD pairs only',()=>{
 assert.equal(new Set(models.map(([rel])=>rel)).size,16);
 assert.equal(models.reduce((n,[,bytes])=>n+bytes,0),6_526_632);
 for(const [rel] of models)assert.equal(keepModernKartBundled(rel),true,rel);
 for(const rel of [extra,dir+'apex.glb?x=1',dir+'apex2.glb',dir+'apex.glb.bak','foo/'+dir+'apex.glb',dir+'APEX.glb',dir+'apex.glb\n'])assert.equal(keepModernKartBundled(rel),false,rel);
});

test('generation keeps all 16 local, including duplicate pack rows and exact local hashes',async t=>{
 const {distDir,outputDir}=await stage(t,true);
 for(const id of ['racing-royal','racing-other']){
  const {assets}=await readJSON(path.join(outputDir,id+'.json'));
  for(const [rel,bytes] of models){
   const found=assets.filter(a=>a.url==='/'+rel);
   assert.deepEqual(found,[{url:'/'+rel,sourceUrl:'/'+rel,size:bytes,sha256:sha(await readFile(path.join(distDir,rel))),nativeRemovable:false}]);
  }
  const ordinary=assets.find(({url})=>url==='/'+extra);
  assert.equal(ordinary.nativeRemovable,true);
  assert.equal(ordinary.sourceUrl,cdn+'/'+extra);
 }
});

test('pruning leaves all 16 unchanged with stale query/flag rows and still prunes the old unrelated model',async t=>{
 const {distDir,outputDir}=await stage(t,true);
 const racingOther=path.join(outputDir,'racing-other.json');
 const stale=await readJSON(racingOther);
 for(const asset of stale.assets){
  if(!asset.url.startsWith('/'+dir))continue;
  asset.url+='?v=city-driver-v2';
  if(asset.url.includes('-lod'))delete asset.nativeRemovable;
  else asset.nativeRemovable=true;
  asset.sourceUrl=cdn+asset.url;
 }
 await writeFile(racingOther,JSON.stringify(stale));
 const report=await pruneNativeGamePacks({distDir});
 assert.equal(report.removedFiles,1);
 assert.equal(report.removedBytes,128);
 for(const [rel,len] of models)assert.deepEqual(await readFile(path.join(distDir,rel)),Buffer.alloc(len,0x41),rel);
 await assert.rejects(readFile(path.join(distDir,extra)),{code:'ENOENT'});
});
