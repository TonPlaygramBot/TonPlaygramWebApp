import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../webapp/package.json',import.meta.url));
const ts=require('typescript');
const source=await readFile(new URL('../webapp/src/games/tiranastreets/citylife/CityLifeCore.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText;
const {CityLifeCore,BUDGETS}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const p={x:0,z:0};
function nav({wall=false,pop=false,blocked=false}={}){return {
 sample:(c,seed,min,max)=>{if(!pop&&min<40)return null;const a=(seed%997)/997*Math.PI*2,d=(min+max)/2;return{x:c.x+Math.cos(a)*d,z:c.z+Math.sin(a)*d};},
 route:(a,b)=>blocked?[]:[{...a},{...b}],move:(a,b)=>blocked?{...a}:{...b},clear:()=>!wall
};}
const run=(g,seconds,player=p)=>{for(let i=0;i<seconds*30;i++)g.update(1/30,player);};
test('unprovoked armed civilians never attack',()=>{let shots=0;const g=new CityLifeCore(nav(),e=>{if(e.type==='shot')shots++});g.addNPC({x:2,z:0},{armed:true});run(g,20);assert.equal(shots,0);assert.equal(g.health,100);});
test('armed victim telegraphs before firing and uses finite ammunition',()=>{let shots=0;const g=new CityLifeCore(nav(),e=>{if(e.type==='shot')shots++});const n=g.addNPC({x:1.8,z:0},{armed:true});assert(g.attack(n.id));run(g,.7);assert.equal(shots,0);assert.equal(n.state,'draw');run(g,10);assert.equal(shots,6);assert.equal(n.ammo,0);assert.equal(g.health,34);assert.equal(n.state,'flee');});
test('wall blocks player attack',()=>{const g=new CityLifeCore(nav({wall:true}));const n=g.addNPC({x:1,z:0},{armed:true});assert.equal(g.attack(n.id),false);assert.equal(n.hp,100);});
test('wall blocks retaliatory bullets',()=>{let shots=0;const g=new CityLifeCore(nav({wall:true}),e=>{if(e.type==='shot')shots++});const n=g.addNPC({x:2,z:0},{armed:true});g.hitNPC(n.id,20,true);run(g,5);assert.equal(shots,0);assert.equal(g.health,100);});
test('attack cooldown prevents frame-rate damage spam',()=>{const g=new CityLifeCore(nav());const n=g.addNPC({x:1,z:0},{armed:false});g.attack(n.id);for(let i=0;i<100;i++)g.attack(n.id);assert.equal(n.hp,76);});
test('attack cone rejects targets behind the player',()=>{const g=new CityLifeCore(nav());const n=g.addNPC({x:0,z:1},{armed:false});assert(!g.attack(n.id,{x:0,z:-1}));});
test('unarmed victim fights or flees; never gets an invented gun',()=>{const g=new CityLifeCore(nav());const n=g.addNPC({x:1,z:0},{armed:false});g.hitNPC(n.id,5,true);assert(['chase','flee'].includes(n.state));assert.equal(n.armed,false);});
test('melee range and cooldown are bounded',()=>{const g=new CityLifeCore(nav());const n=g.addNPC({x:1,z:0},{armed:false});n.state='chase';n.threatAt=0;run(g,1);assert.equal(g.health,86);});
test('pause freezes AI, damage, missions and simulation clock',()=>{const g=new CityLifeCore(nav());const n=g.addNPC({x:1.8,z:0},{armed:true});g.attack(n.id);g.setPaused(true);run(g,100);assert.equal(g.time,0);assert.equal(g.health,100);assert(!g.attack(n.id));});
test('invalid frame and damage inputs are ignored',()=>{const g=new CityLifeCore(nav());g.update(NaN,p);g.update(1,{x:Infinity,z:0});g.damagePlayer(-20);g.damagePlayer(NaN);assert.equal(g.time,0);assert.equal(g.health,100);});
test('large resumed frames do not advance a whole minute',()=>{const g=new CityLifeCore(nav());g.update(60,p);assert(g.time<=.201);});
test('population budgets are reached without unbounded spawning',()=>{const g=new CityLifeCore(nav({pop:true}),()=>{},'low');run(g,20);assert.equal(g.npcs.size,BUDGETS.low.population);run(g,20);assert.equal(g.npcs.size,36);});
test('seeded crowd creation is reproducible',()=>{const a=new CityLifeCore(nav({pop:true}),()=>{},'low',4),b=new CityLifeCore(nav({pop:true}),()=>{},'low',4);run(a,5);run(b,5);assert.deepEqual([...a.npcs.values()],[...b.npcs.values()]);});
test('downed NPC creates exactly one medical incident',()=>{const g=new CityLifeCore(nav());const n=g.addNPC({x:1,z:0});g.hitNPC(n.id,100,true);g.hitNPC(n.id,100,true);assert.equal(g.incidents.size,1);assert.equal(n.state,'down');});
test('medical mission responds, treats, returns and resolves once',()=>{const events=[];const g=new CityLifeCore(nav(),e=>events.push(e));assert(g.beginMission('medical',{x:2,z:0},'medical-1'));assert(!g.beginMission('medical',{x:2,z:0},'medical-1'));run(g,60);const resolved=events.filter(e=>e.type==='resolved');assert.equal(resolved.length,1);assert.equal(resolved[0].eligible,true);assert.equal(g.units.size,0);assert.equal([...g.npcs.values()][0].hp,65);});
test('fire mission reduces intensity then returns',()=>{const g=new CityLifeCore(nav());assert(g.beginMission('fire',{x:2,z:0},'fire-1'));run(g,60);assert.equal([...g.incidents.values()][0].intensity,0);assert.equal([...g.incidents.values()][0].status,'resolved');});
test('self-caused injury is never reward-eligible',()=>{const events=[];const g=new CityLifeCore(nav(),e=>events.push(e));const n=g.addNPC({x:2,z:0},{mission:'fake-rescue'});g.hitNPC(n.id,100,true);run(g,60);assert.equal(events.find(e=>e.type==='resolved')?.eligible,false);});
test('unreachable dispatch blocks with bounded retries, not teleportation',()=>{const g=new CityLifeCore(nav({blocked:true}));g.request('fire',{x:2,z:0});run(g,70);const i=[...g.incidents.values()][0];assert.equal(i.status,'blocked');assert.equal(i.attempts,3);assert.equal(g.units.size,0);assert.equal(i.intensity,1);});
test('mission start requires proximity and line of sight',()=>{const g=new CityLifeCore(nav());assert(!g.beginMission('fire',{x:20,z:0},'remote'));assert(!g.beginMission('medical',{x:NaN,z:0},'bad'));assert.equal(g.incidents.size,0);});
test('disposal releases simulation collections',()=>{const g=new CityLifeCore(nav({pop:true}));run(g,1);g.request('fire',p);g.dispose();assert.equal(g.npcs.size+g.incidents.size+g.units.size,0);});

test('render pause synchronization preserves substep accumulation',()=>{const g=new CityLifeCore(nav());for(let i=0;i<120;i++){g.update(1/60,p);g.setPaused(false);}assert(Math.abs(g.time-2)<.04);});
