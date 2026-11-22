import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import catalog,{inviteGamesCatalog} from '../../webapp/src/config/gamesCatalog.js';
import {TURI_MODEL_URL} from '../../webapp/src/config/playerCharacter.js';
import {GAME_PACK_DEFINITIONS} from '../../webapp/src/pwa/gamePackDefinitions.js';
import {generateGamePackManifests} from '../../webapp/scripts/generate-game-pack-manifests.mjs';
const publicDir=fileURLToPath(new URL('../../webapp/public/',import.meta.url));
const old=catalog.find(g=>g.slug==='optika-3d'),card=catalog.find(g=>g.slug==='optika-tirana');
const root='/assets/optika-tirana-v1/';
test('Tirana is a distinct standalone Games entry, not an invite nor a redirect of Optika or Racing',()=>{
  assert.equal(card.name,'Optika: Tirana 3D');assert.equal(card.route,root+'index.html');assert.equal(card.standalone,true);assert.equal(card.multiplayer,false);
  assert.equal(old.route,'/assets/optika-3d-v1/index.html');assert.equal(catalog.find(x=>x.slug==='kartroyale').route,'/games/kartroyale/lobby');
  assert.equal(inviteGamesCatalog.some(x=>x===card),false);
});
test('download manifests include complete static entry and exactly one canonical Turi dependency',async()=>{
  const outputDir=await mkdtemp(join(tmpdir(),'tirana-optika-'));
  try{
    const defs=GAME_PACK_DEFINITIONS.filter(d=>['optika-tirana','optika-3d','shared-player-character'].includes(d.id));
    const {packs}=await generateGamePackManifests({definitions:defs,publicDir,outputDir,cdnBaseUrl:'https://cdn.invalid'});
    assert.deepEqual(defs.find(x=>x.id==='optika-3d').roots,['assets/optika-3d-v1']);
    assert.deepEqual(packs.find(p=>p.id==='optika-3d').dependencies,[]);
    const preview=JSON.parse(await readFile(join(outputDir,'optika-tirana.json')));
    const player=JSON.parse(await readFile(join(outputDir,'shared-player-character.json')));
    assert.deepEqual(preview.dependencies,['shared-player-character']);
    assert.ok(preview.assets.every(a=>a.url.startsWith(root)&&a.url===a.sourceUrl&&!a.nativeRemovable));
    const urls=new Set(preview.assets.map(a=>a.url));
    for(const asset of ['index.html','assets/public-tirana-center.json','assets/public-tirana-landmarks.glb','assets/civil-survey-drone.glb','assets/data-license.txt','assets/third-party-licenses.txt','assets/cover.svg'])assert.ok(urls.has(root+asset),asset);
    const entry=await readFile(join(publicDir,card.route.slice(1)),'utf8');
    for(const m of entry.matchAll(/(?:href|src)="\.\/(assets\/[^"]+)"/g))assert.ok(urls.has(root+m[1]),m[1]);
    const avatar=player.assets.filter(a=>a.url===TURI_MODEL_URL);
    assert.equal(avatar.length,1);assert.equal(avatar[0].sha256,'15aa91bb5206589087df60e47911f3b64ec1d95b4e380a685b3b025f21446f02');
    assert.equal(avatar[0].sourceUrl,TURI_MODEL_URL);assert.equal(avatar[0].nativeRemovable,false);
  }finally{await rm(outputDir,{recursive:true,force:true});}
});
