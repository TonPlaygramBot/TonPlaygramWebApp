import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MISSIONS,createState,advanceState} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {WEAPONS,STARTER_WEAPON} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {createCampaign} from '../webapp/src/games/tiranastreets/street-career/campaignCore.mjs';
import {HUMAN_ROSTER,humanFor} from '../webapp/src/games/tiranastreets/street-career/humanRoster.mjs';
const campaign=createCampaign(MISSIONS,WEAPONS,STARTER_WEAPON);
test('real chapter catalog produces engine states with shared weapon inventory',()=>{
 let p=campaign.fresh();
 for(const m of campaign.chapters){const run=campaign.begin(p,m.id),s=createState([{id:'local',name:'test'}],m.id,'solo',false,'normal');campaign.apply(s.players.local,run.active.checkpoint);advanceState(s,1/60);assert.equal(s.missionId,m.id);assert.ok(Number.isFinite(s.players.local.x));assert.ok(s.npcs.length);assert.ok(WEAPONS.some(w=>w.id===s.players.local.weapon));
 // Synthetic successful outcome validates settlement contract, not mission reachability.
 s.phase='finished';Object.assign(s.players.local,{finished:true,failed:false,health:100,finishTime:30});p=campaign.resolve(run,s,'local');assert.ok(p);}
 assert.equal(p.completed.length,campaign.chapters.length);
});
test('existing dispatch creates military NPCs assigned to the shared soldier',()=>{const s=createState([{id:'local',name:'test'}],'five-star-escape','solo');advanceState(s,2);advanceState(s,2);advanceState(s,2);advanceState(s,2);advanceState(s,.1);const soldiers=s.npcs.filter(n=>n.kind==='soldier');assert.ok(soldiers.length>0);for(const n of soldiers)assert.equal(humanFor(n).sourceId,'mixamo-soldier');});
test('all referenced local GLBs have valid container headers',()=>{for(const url of new Set(HUMAN_ROSTER.map(h=>h.url))){const bytes=readFileSync(new URL(`../webapp/public${url}`,import.meta.url));assert.equal(bytes.readUInt32LE(0),0x46546c67,url);assert.equal(bytes.readUInt32LE(8),bytes.length,url);const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert.ok(json.skins?.length,url);assert.ok(!(json.extensionsRequired||[]).includes('KHR_draco_mesh_compression'),`${url}: needs a configured Draco loader`);}});

test('roster IDs are actual existing Table Tennis and Chess selections',()=>{const tennis=readFileSync(new URL('../webapp/src/games/tabletennis/options.ts',import.meta.url),'utf8'),chess=readFileSync(new URL('../webapp/src/config/chessBattleInventoryConfig.js',import.meta.url),'utf8');for(const h of HUMAN_ROSTER){const source=h.id==='mixamo-soldier'?chess:tennis;assert.ok(source.includes(`'${h.id}'`),h.id);}});
