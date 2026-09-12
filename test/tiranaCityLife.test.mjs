import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createState, emptyInput, stepState, publicState, MISSIONS, SPAWN, advanceState, interact, control, WORLD, lineOfSight, upgradeState } from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import { equipStarter, lifeAction, updateCityLife, reportCrime, wantedStars } from '../webapp/src/games/tiranastreets/shared/cityLife.mjs';
import { WEAPONS, WEAPON_BY_ID, difficultyOf } from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import { makeRoom, applyRoom } from '../webapp/src/games/tiranastreets/shared/rooms.mjs';

const player=()=>{const p={id:'p',name:'P',x:0,z:0,heading:0,speed:0,carId:null,finished:false,failed:false,input:emptyInput(),inputAt:0};equipStarter(p);return p;};
const scene=()=>({elapsed:1,phase:'active',missionId:'free-roam',difficulty:'normal',mode:'solo',players:{p:player()},npcs:[],units:[],cars:[],effects:[],effectSeq:0,nextDispatch:100,shop:{x:0,z:0}});
const env={emptyInput,spawn:{x:0,z:0},collide:()=>false,clear:()=>true,nearestNode:()=>0,roadPoint:(x,z)=>({x,z}),route:()=>[],along:(a,b,speed,dt)=>{const d=Math.hypot(b.x-a.x,b.z-a.z)||1;a.x+=(b.x-a.x)/d*Math.min(d,speed*dt);a.z+=(b.z-a.z)/d*Math.min(d,speed*dt);a.speed=speed;return d<=speed*dt;}};
const tick=(s,seconds,custom=env)=>{for(let t=0;t<seconds;t+=1/60){s.elapsed+=1/60;updateCityLife(s,1/60,custom,{type:'free'});}};
const target=(kind='gang')=>({id:'target',kind,motion:'walk',health:100,x:0,z:-10,heading:0,speed:0,weapon:null,nextShot:Infinity,downUntil:0});

test('all Ludo firearm/ordnance entries are represented with unique balanced IDs',()=>{
 const source=readFileSync(new URL('../webapp/src/config/ludoBattleOptions.js',import.meta.url),'utf8').split('export const CAPTURE_ANIMATION_OPTIONS')[1].split('export const')[0];
 const ids=[...source.matchAll(/id: '([^']+)'/g)].map(m=>m[1]).filter(id=>!['missileJavelin','droneAttack','ukrainianDroneAttack','fighterJetAttack','helicopterAttack','polyTank01Attack'].includes(id));
 for(const id of ids)assert.ok(WEAPON_BY_ID.has(id),id);
 assert.equal(new Set(WEAPONS.map(w=>w.id)).size,WEAPONS.length);assert.equal(WEAPONS.length,35);
 for(const w of WEAPONS){assert.ok(w.interval>=.08);assert.ok(w.magazine>0);assert.ok(w.price>0);}
});
test('dealer enforces proximity, wanted status, funds and ammo capacity',()=>{
 const s=scene(),p=s.players.p,w=WEAPON_BY_ID.get('ak47VolleyAttack');p.x=99;
 lifeAction(s,p,'buy:'+w.id);assert.equal(p.cash,750);assert.equal(p.inventory[w.id],undefined);
 p.x=0;p.wanted=1;lifeAction(s,p,'buy:'+w.id);assert.equal(p.cash,750);
 p.wanted=0;p.cash=w.price-1;lifeAction(s,p,'buy:'+w.id);assert.equal(p.inventory[w.id],undefined);
 p.cash=1000;lifeAction(s,p,'buy:'+w.id);assert.equal(p.cash,1000-w.price);assert.equal(p.weapon,w.id);assert.equal(p.inventory[w.id].ammo,w.magazine);
 lifeAction(s,p,'equip:invented');assert.equal(p.weapon,w.id);
 p.inventory[w.id].reserve=w.magazine*8;const cash=p.cash;lifeAction(s,p,'buy:'+w.id);assert.equal(p.cash,cash);
 p.armor=0;lifeAction(s,p,'buy:armor');assert.equal(p.armor,100);
});
test('server firing consumes ammo, obeys cadence, stops stale controls and blocks walls',()=>{
 const s=scene(),p=s.players.p;s.npcs=[target()];p.input={...emptyInput(),fire:true};p.inputAt=s.elapsed;
 tick(s,.02);assert.equal(p.inventory[p.weapon].ammo,15);assert.equal(s.npcs[0].health,76);
 tick(s,.1);assert.equal(p.inventory[p.weapon].ammo,15);
 tick(s,.8);assert.equal(p.inventory[p.weapon].ammo,14);
 const s2=scene();s2.npcs=[target()];s2.players.p.input={...emptyInput(),fire:true};s2.players.p.inputAt=s2.elapsed;
 tick(s2,.02,{...env,clear:()=>false});assert.equal(s2.npcs[0].health,100);assert.equal(s2.players.p.inventory[s2.players.p.weapon].ammo,15);
});
test('reload transfers existing reserve only and switching cancels pending reload',()=>{
 const s=scene(),p=s.players.p,inv=p.inventory[p.weapon];inv.ammo=2;inv.reserve=4;
 lifeAction(s,p,'reload');assert.ok(p.reloadAt>s.elapsed);tick(s,2);assert.equal(inv.ammo,6);assert.equal(inv.reserve,0);assert.equal(p.reloadAt,0);
 inv.reserve=10;lifeAction(s,p,'reload');lifeAction(s,p,'holster');tick(s,2);assert.equal(inv.ammo,6);assert.equal(p.reloadAt,0);
});
test('innocent NPCs flee and five-star pursuit dispatches armed military with a bounded population',()=>{
 const s=scene(),p=s.players.p;s.npcs=[target('civilian')];p.input={...emptyInput(),fire:true};p.inputAt=s.elapsed;
 tick(s,.02);assert.ok(s.npcs[0].panicUntil>s.elapsed);assert.ok(p.wanted>0);assert.ok(s.npcs[0].z<-10);
 reportCrime(s,p,1000);assert.equal(wantedStars(p.wanted),5);s.nextDispatch=0;p.lastCrime=1000;
 tick(s,.1);assert.ok(s.units.some(u=>u.kind==='military'));assert.ok(s.npcs.some(n=>n.kind==='soldier'&&n.weapon));
 tick(s,60);assert.ok(s.units.length<=6);assert.ok(s.npcs.length<=21);
});
test('wanted levels decay out of sight and free roam recovers after defeat',()=>{
 const s=scene(),p=s.players.p;p.wanted=80;p.lastCrime=-50;tick(s,12);assert.equal(p.wanted,0);
 p.health=0;p.respawnAt=s.elapsed+1;p.x=100;p.cash=250;tick(s,1.2);assert.equal(p.health,100);assert.equal(p.x,0);assert.equal(p.cash,150);assert.equal(p.wanted,0);
});
test('rivals allow player combat while co-op prevents friendly fire',()=>{
 for(const mode of ['rivals','coop']){const s=scene(),p=s.players.p,q=player();q.id='q';q.z=-10;s.players.q=q;s.mode=mode;p.input={...emptyInput(),fire:true};p.inputAt=s.elapsed;tick(s,.02);assert.equal(q.health,mode==='rivals'?76:100);}
});
test('difficulty is selected by host and preserved in authoritative room state',()=>{
 const member={id:'p',name:'P'},r=makeRoom('ABC123',member,{missionId:'first-shift',mode:'career',difficulty:'hard'},100);
 assert.equal(r.state.difficulty,'hard');assert.equal(difficultyOf(r.state.difficulty).time,.85);
 assert.equal(makeRoom('ABC124',member,{missionId:'first-shift',mode:'career',difficulty:'hacked'},100).state.difficulty,'normal');
 applyRoom(r,member,'input',{input:{fire:'true',x:0,seq:1},action:'buy:ak47VolleyAttack',actionSeq:1},200);
 assert.equal(r.state.players.p.input.fire,false);
});
test('connected action replay does not repeat purchases',()=>{
 const member={id:'p',name:'P'},r=makeRoom('ABC123',member,{missionId:'first-shift',mode:'career'},100);
 Object.assign(r.state.players.p,r.state.shop);const action={input:{seq:1},action:'buy:ak47VolleyAttack',actionSeq:5};
 applyRoom(r,member,'input',action,120);const cash=r.state.players.p.cash;assert.ok(cash<750);
 applyRoom(r,member,'input',action,130);assert.equal(r.state.players.p.cash,cash);
});
test('city contains server-owned walkers, riders, traffic and dealer; public snapshots omit NPC paths',()=>{
 const s=createState([{id:'p',name:'P'}],'free-roam');assert.ok(s.npcs.length>=43);assert.equal(s.traffic.length,2030);assert.ok(s.npcs.some(n=>n.motion==='cycle'));
 const citizen=s.npcs.find(n=>n.id==='citizen-0');const before=citizen.x+','+citizen.z;advanceState(s,.5);assert.notEqual(citizen.x+','+citizen.z,before);
 const pub=publicState(s);assert.ok(!('path' in pub.npcs[1]));assert.ok(!('input' in pub.players.p));
});
test('combat extraction cannot finish while armed mission NPCs remain',()=>{
 const s=createState([{id:'p',name:'P'}],'rinia-rescue'),p=s.players.p,m=MISSIONS.find(m=>m.id===s.missionId);Object.assign(p,m.stops[0]);stepState(s);assert.equal(p.finished,false);
 for(const n of s.npcs)if(n.kind==='gang')n.health=0;stepState(s);assert.equal(p.finished,true);
});
test('shipped living GLBs have complete binary chunks and valid external dependencies',()=>{
 const base=new URL('../webapp/public/assets/tirana-streets/living/',import.meta.url);
 for(const file of readdirSync(base).filter(f=>f.endsWith('.glb'))){const b=readFileSync(new URL(file,base));assert.equal(b.readUInt32LE(0),0x46546c67,file);assert.equal(b.readUInt32LE(8),b.length,file);const length=b.readUInt32LE(12),d=JSON.parse(b.subarray(20,20+length)),binary=b.length-28-length;
 for(const v of d.bufferViews)assert.ok((v.byteOffset||0)+v.byteLength<=binary,file);
 for(const image of d.images||[])if(image.uri&&!image.uri.startsWith('data:'))assert.ok(existsSync(new URL(image.uri,base)),file+' '+image.uri);
 if(file==='human.glb')assert.ok(['Idle','Walk','Run'].every(n=>d.animations.some(a=>a.name===n)));
 }
});

test('actual building walls block city fire rays in both directions',()=>{
 const b=WORLD.buildings.find(b=>!b.special && b.p.length===5 && b.h>5) || WORLD.buildings[10];
 const xs=b.p.map(p=>p[0]),zs=b.p.map(p=>p[1]),z=(Math.min(...zs)+Math.max(...zs))/2;
 const a={x:Math.min(...xs)-3,z},c={x:Math.max(...xs)+3,z};
 assert.equal(lineOfSight(a,c),false);assert.equal(lineOfSight(c,a),false);
});

test('older persisted preview rooms gain city systems without losing progress',()=>{
 const s=createState([{id:'p',name:'P'}],'first-shift');s.players.p.index=1;s.elapsed=24;
 delete s.lifeVersion;delete s.npcs;delete s.units;delete s.effects;delete s.players.p.inventory;
 upgradeState(s);assert.equal(s.players.p.index,1);assert.equal(s.elapsed,24);assert.equal(s.lifeVersion,2);assert.ok(s.npcs.length>=43);assert.ok(s.players.p.inventory);
 s.players.p.cash=123;upgradeState(s);assert.equal(s.players.p.cash,123);
});
