import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {WEAPON_BY_ID,ensureStarterWeapons} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import {POLICE_STATION} from '../webapp/src/games/tiranastreets/street-career/ArrestSimulation.mjs';
import {clearStreetPoint,clearRoadSegment} from '../webapp/src/games/tiranastreets/shared/streetSafety.mjs';
import {CANOPY_TREES,CANOPY_SOURCE_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import {RAILINGS} from '../webapp/src/games/tiranastreets/shared/landscape.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
const original=createState([{id:'local',name:'Tester'}],'free-roam','solo');
function setup(solids=[]){const state=structuredClone(original);state.traffic=[];state.cars=[];state.units=[];state.npcs=[];state.nextDispatch=1e9;const sim=new StreetSimulation(state,new StreetWorld(solids,false));return sim;}
const officer=(sim,x=0,z=-6)=>({id:'officer',kind:'police',forceCharacter:'patrol_officer',x:sim.player.x+x,z:sim.player.z+z,y:sim.body.y,heading:0,speed:0,health:100,weapon:'ak47VolleyAttack',motion:'walk',downUntil:0,nextShot:0});
function tick(sim,seconds){for(let i=0;i<seconds*60;i++)sim.step(1/60);}
function throwAt(sim,kind,n){sim.state.npcs.push(n);sim.player.weapon=kind;sim.body.yaw=0;sim.body.pitch=0;sim.throwables.throw(WEAPON_BY_ID.get(kind));for(let i=0;i<60&&sim.throwables.items.length;i++){sim.state.elapsed+=1/60;sim.throwables.step(1/60);}}
test('new and saved pockets have finite ammunition without refilling used stock',()=>{
 const p={inventory:{egg:{ammo:2,reserve:0}}};ensureStarterWeapons(p);ensureStarterWeapons(p);
 assert.deepEqual(p.inventory.egg,{ammo:2,reserve:0});assert.equal(p.inventory.tomato.ammo,12);assert.equal(p.inventory.punch.ammo,1);
});
test('eggs and tomatoes must physically hit an officer before pursuit; misses do not count',()=>{
 for(const kind of ['egg','tomato']){const sim=setup(),n=officer(sim);throwAt(sim,kind,n);assert.equal(sim.player.arrest?.phase,'pursuit',kind);assert.equal(n.health,100);assert.equal(sim.player.inventory[kind].ammo,11);assert.equal(n.splatter,kind);}
 const sim=setup();throwAt(sim,'egg',officer(sim,3));assert.equal(sim.player.arrest,undefined);
});
test('walls stop food before it reaches an officer',()=>{
 const sim=setup(),p=sim.player;sim.world=new StreetWorld([{id:'wall',p:[[p.x-2,p.z-3],[p.x+2,p.z-3],[p.x+2,p.z-2],[p.x-2,p.z-2]],h:sim.body.y+4,minY:sim.body.y}],false);
 throwAt(sim,'tomato',officer(sim));assert.equal(sim.player.arrest,undefined);assert.ok(sim.state.effects.some(e=>e.kind==='tomato-splat'));
});
test('spray requires proximity, sight and being on foot; pausing freezes custody',()=>{
 const sim=setup(),n=officer(sim,1,0);sim.state.npcs.push(n);sim.arrest.provoke(n,'egg');
 const env={clear:()=>false,along(){},collide(){}};sim.arrest.officer(n,sim.player,1/60,env);assert.equal(sim.player.arrest.phase,'pursuit');
 sim.player.carId='test';sim.arrest.officer(n,sim.player,1/60,{...env,clear:()=>true});assert.equal(sim.player.arrest.phase,'pursuit');sim.player.carId=null;
 sim.arrest.officer(n,sim.player,1/60,{...env,clear:()=>true});assert.equal(sim.player.arrest.phase,'spray');const elapsed=sim.state.elapsed;
 sim.pause();tick(sim,3);assert.equal(sim.state.elapsed,elapsed);assert.equal(sim.player.arrest.phase,'spray');
});
test('custody goes through backup and escort before arrival at the mapped police directorate',()=>{
 const sim=setup(),n=officer(sim,1.5,0);sim.world=new StreetWorld();sim.state.npcs.push(n);sim.arrest.provoke(n,'tomato');
 let sawBackup=false,sawCrew=false,sawEscort=false,sawTransport=false;
 for(let i=0;i<7200&&sim.player.arrest;i++){sim.step(1/60);sawBackup||=!!sim.arrest.van;sawCrew||=sim.state.npcs.some(n=>n.custody);sawEscort||=sim.player.arrest?.phase==='escort';sawTransport||=sim.player.arrest?.phase==='transport';}
 assert.ok(sawBackup&&sawCrew&&sawEscort&&sawTransport,sim.body.notice);const completion=sim.events.find(e=>e.kind==='arrest-complete');assert.ok(completion,sim.body.notice);
 assert.equal(completion.x,POLICE_STATION.x);assert.equal(completion.z,POLICE_STATION.z);assert.ok(clearStreetPoint(POLICE_STATION,.5));assert.equal(sim.player.health,100);assert.equal(sim.arrest.van,null);
});
test('paired foot patrols, every corrected trunk and every collision railing stay clear of driving lanes',()=>{
 const patrols=original.npcs.filter(n=>n.patrol);assert.equal(patrols.length,32);
 for(const n of patrols){assert.ok(clearStreetPoint(n,.45));assert.ok(clearRoadSegment([n.path[0].x,n.path[0].z],[n.path[1].x,n.path[1].z],.45));assert.ok(WEAPON_BY_ID.has(n.weapon));}
 assert.equal(CANOPY_TREES.length,CANOPY_SOURCE_TREES.length);
 for(const t of CANOPY_TREES)assert.ok(clearStreetPoint(t,Math.max(.45,Math.min(.8,t.crown*.08))),t.id);
 for(const r of RAILINGS)assert.ok(clearRoadSegment(r.a,r.b,.32),r.id);
 assert.equal(WORLD.buildings.find(b=>String(b.id)==='1255594721').h,140);
});
