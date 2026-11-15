import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import * as T from 'three';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RaceTelemetryHud,RaceDebrief} from './RaceTelemetryHud';
import {KartRenderer} from './renderer';
import {ACTION_MISSIONS} from './actionCareer.mjs';

// Exercise the production renderer's session lifecycle and fixed-step dispatch.
// Only GPU drawing and asset-backed presentation are stubbed; driving, combat,
// action mission progression, input and result payloads remain production code.
vi.mock('three',async()=>{
 const actual=await vi.importActual<typeof import('three')>('three');
 return {...actual,PMREMGenerator:class {
  fromScene(){return {texture:new actual.Texture(),dispose:vi.fn()};}
  dispose(){}
 }};
});
vi.mock('../tiranastreets/createWebGLRenderer',()=>({createWebGLRenderer:()=>({
 domElement:document.createElement('canvas'),shadowMap:{},capabilities:{getMaxAnisotropy:()=>8},
 info:{render:{calls:0}},setPixelRatio:vi.fn(),setSize:vi.fn(),render:vi.fn(),dispose:vi.fn()
})}));
vi.mock('./tiranaScenery',()=>({TiranaScenery:class {}}));
vi.mock('./freeRoam',()=>({freeRoamWorld:()=>({
 mode:'free-roam',bounds:[-100000,-100000,100000,100000],nearestRoad:()=>null,nearbyRoads:()=>[],recover:()=>{},move:()=>null
})}));
vi.mock('./ActionCareerWorld',async()=>{
 const {Group}=await import('three');
 return {ActionCareerWorld:class {
  group=new Group();update=vi.fn();setFirstPerson=vi.fn();
  dispose=vi.fn(()=>this.group.removeFromParent());
 }};
});

let game:any,host:HTMLDivElement,frame:ReturnType<typeof vi.fn>,finish:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));
 vi.stubGlobal('cancelAnimationFrame',vi.fn());
 vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
 Object.defineProperty(document,'hidden',{configurable:true,value:false});
 host=document.createElement('div');document.body.append(host);
 Object.defineProperties(host,{clientWidth:{value:390},clientHeight:{value:844}});
 frame=vi.fn();finish=vi.fn();game=new KartRenderer(host,frame,finish,()=>{});
 // Asset loading/visual geometry is verified separately by the browser harness.
 // Keep real scene and camera math, without constructing the entire city here.
 game.createWorld=()=>{game.world.clear();game.visuals.clear();};
 game.cloneKart=(_slot:number,_low:boolean,kartId:string)=>{const v=new T.Group();v.userData.kartId=kartId;return v;};
 game.driverModels=[new T.Group()];
 game.last=0;game.fpsAt=0;
});
afterEach(()=>{game.destroy();host.remove();vi.unstubAllGlobals();});
function advance(seconds=.1){
 const end=game.last+seconds*1000;
 while(game.last<end-.01)game.animate(Math.min(end,game.last+50));
}

it('runs combat only in its local session and pauses both projectiles and held controls',()=>{
 game.startCombatRace('skanderbeg','rookie');
 expect(game.network).toBe(false);expect(game.timeTrial).toBe(false);expect(game.racers).toHaveLength(6);
 const effects=game.combatEffects,dispose=vi.spyOn(effects,'dispose');
 game.countdown=0;game.state='racing';
 const ammo=game.combat.player.ammo;
 Object.assign(game.input,{fire:true,throttle:true});advance(.3);
 expect(game.combat.player.ammo).toBeLessThan(ammo);
 expect(game.time).toBeGreaterThan(0);
 game.queueCombatPulse();advance(.05);expect(game.combat.player.pulseCooldown).toBeGreaterThan(21);
 game.combat.player.pulseCooldown=0;game.queueCombatPulse();
 game.combatInput.reload=true;game.actionInput.fire=true;game.pause(true);
 const time=game.time,combatTime=game.combat.elapsed,shots=JSON.stringify(game.combat.projectiles);
 advance(.3);
 expect(game.time).toBe(time);expect(game.combat.elapsed).toBe(combatTime);expect(JSON.stringify(game.combat.projectiles)).toBe(shots);
 expect(game.input.fire).toBe(false);expect(game.input.throttle).toBe(false);
 expect(game.combatInput.reload).toBe(false);expect(game.actionInput.fire).toBe(false);expect(game.combatEmpPulse).toBe(false);
 game.pause(false);advance(.05);expect(game.combat.player.pulseCooldown).toBe(0);
 game.startLocal('skanderbeg','rookie');
 expect(game.combat).toBeNull();expect(game.actionCareer).toBeNull();expect(dispose).toHaveBeenCalledOnce();
 expect(effects.group.parent).toBeNull();
});

it('moves the on-foot actor while leaving the parked kart unchanged, and publishes its own HUD',()=>{
 const mission=ACTION_MISSIONS[0];game.startActionCareer(mission.id,mission.track);
 expect(game.freeDriving).not.toBeNull();expect(game.combat).toBeNull();
 game.actionInput.interact=true;advance(.05);
 expect(game.actionCareer.mode).toBe('onfoot');
 expect(game.actionInput.interact).toBe(false);
 const player=game.racers[0],parked={x:player.x,z:player.z,lap:player.lap};
 const actor={...game.actionCareer.actor};
 game.input.throttle=true;game.input.steer=1;
 Object.assign(game.actionInput,{moveZ:1,sprint:true,jump:true});advance(.4);
 expect({x:player.x,z:player.z,lap:player.lap}).toEqual(parked);
 expect(Math.hypot(game.actionCareer.actor.x-actor.x,game.actionCareer.actor.z-actor.z)).toBeGreaterThan(.5);
 expect(game.actionCareer.actor.jumpHeight).toBeGreaterThan(0);
 const hud=frame.mock.lastCall?.[0];expect(hud.actionCareer.mode).toBe('onfoot');expect(hud.combat).toBeUndefined();
 game.pause(true);const elapsed=game.actionCareer.elapsed;advance(.2);
 expect(game.actionCareer.elapsed).toBe(elapsed);expect(game.actionInput.moveZ).toBe(0);expect(game.input.throttle).toBe(false);
});

it('buffers short interaction, jump and reload taps until a fixed step, and cancels them on pause',()=>{
 const mission=ACTION_MISSIONS[0];game.startActionCareer(mission.id,mission.track);
 game.queueAction('interact');game.actionInput.interact=false;advance(.05);
 expect(game.actionCareer.mode).toBe('onfoot');
 game.queueAction('jump');game.actionInput.jump=false;advance(.05);
 expect(game.actionCareer.actor.jumpHeight).toBeGreaterThan(0);
 advance(1.2);expect(game.actionCareer.actor.jumpHeight).toBe(0);
 game.actionCareer.ammo=8;game.queueAction('reload');game.actionInput.reload=false;advance(.05);
 expect(game.actionCareer.reload).toBeGreaterThan(0);
 game.startActionCareer(mission.id,mission.track);
 game.queueAction('interact');game.pause(true);game.pause(false);advance(.1);
 expect(game.actionCareer.mode).toBe('driving');
 expect(game.actionPulses).toEqual({jump:false,interact:false,reload:false});
});

it('finishes a failed action mission once with no fictitious race/city/combat result',()=>{
 const mission=ACTION_MISSIONS[0];game.startActionCareer(mission.id,mission.track);
 game.actionCareer.actor.health=0;game.actionInput.fire=true;
 advance(.1);advance(.2);
 expect(game.state).toBe('finished');expect(finish).toHaveBeenCalledOnce();
 const result=finish.mock.calls[0][0];expect(result.actionCareer.status).toBe('failed');
 expect(result.cityJob).toBeUndefined();expect(result.combat).toBeUndefined();expect(game.actionInput.fire).toBe(false);
});

it('drops local mission state and effects before receiving an online race, and cleans up on garage exit',()=>{
 const mission=ACTION_MISSIONS[0];game.startActionCareer(mission.id,mission.track);
 const world=game.actionWorld;
 game.actionInput.fire=true;
 game.networkState({trackId:mission.track,status:'racing',racers:game.racers.map((r:any)=>({...r})),elapsed:10,startsAt:0,serverNow:10000},'you');
 expect(game.network).toBe(true);expect(game.actionCareer).toBeNull();expect(game.combat).toBeNull();
 expect(world.dispose).toHaveBeenCalledOnce();expect(world.group.parent).toBeNull();expect(game.actionInput.fire).toBe(false);
 game.startCombatRace(mission.track,'rookie');const effects=game.combatEffects,dispose=vi.spyOn(effects,'dispose');
 game.showGarage();expect(game.state).toBe('garage');expect(game.combat).toBeNull();expect(dispose).toHaveBeenCalledOnce();
});

it('renders online combat for the local viewer without predicting damage or losing tap inputs',()=>{
 game.startCombatRace('skanderbeg','rookie');
 const snapshot={
  trackId:'skanderbeg',raceFormat:'combat',status:'racing',
  racers:structuredClone(game.racers),combat:structuredClone(game.combat),
  elapsed:10,startsAt:0,serverNow:10000,results:[]
 };
 const me=snapshot.racers[1].id;
 snapshot.racers[1].ai=false;
 snapshot.combat.weapons[me].ammo=9;
 game.networkState(snapshot,me);
 expect(game.combat.playerId).toBe(me);
 expect(game.combat.player).toBe(game.combat.weapons[me]);
 expect(game.combat.player.ammo).toBe(9);
 expect(snapshot.combat.playerId).toBe('you');
 const effects=game.combatEffects,dispose=vi.spyOn(effects,'dispose');
 const authoritativeCombat=JSON.stringify(game.combat);
 game.input.fire=true;game.queueCombatReload();game.queueCombatPulse();
 advance(.3);
 expect(JSON.stringify(game.combat)).toBe(authoritativeCombat);
 const packet=game.networkInput();
 expect(packet).toMatchObject({fire:true,reload:true,pulse:true});
 expect(game.networkInput()).toMatchObject({fire:true,reload:false,pulse:false});
 game.networkState({...snapshot,elapsed:10.3},me);
 expect(game.combatEffects).toBe(effects);expect(dispose).not.toHaveBeenCalled();
 expect(game.input.fire).toBe(true);
 game.queueCombatPulse();game.pause(true);
 expect(game.networkInput()).toMatchObject({fire:false,reload:false,pulse:false});
 game.networkState({...snapshot,raceFormat:'race',combat:null,elapsed:10.4},me);
 expect(game.combat).toBeNull();expect(dispose).toHaveBeenCalledOnce();
});

it('uses online trial rankings without writing a local ghost and finishes once',()=>{
 game.startLocal('skanderbeg','rookie');
 const racers=structuredClone(game.racers.slice(0,2));
 const snapshot={trackId:'skanderbeg',raceFormat:'trial',status:'racing',racers,elapsed:30,startsAt:0,serverNow:30000,results:[]};
 game.networkState(snapshot,'you');
 expect(game.timeTrial).toBe(true);expect(game.ghostRecorder).toBeNull();
 advance(.15);
 expect(frame.mock.lastCall?.[0]).toMatchObject({timeTrial:true,online:true});
 const hudMarkup=renderToStaticMarkup(createElement(RaceTelemetryHud,{frame:frame.mock.lastCall?.[0]}));
 expect(hudMarkup).toContain('Fastest valid lap wins this session');
 expect(hudMarkup).not.toMatch(/ghost/i);
 const localHudMarkup=renderToStaticMarkup(createElement(RaceTelemetryHud,{frame:{...frame.mock.lastCall?.[0],online:false}}));
 expect(localHudMarkup).toContain('Your first valid lap creates a ghost');
 // Server ranks the fastest lap; circuit progress alone may have another order.
 const results=[{...racers[1],finished:true},{...racers[0],finished:true}];
 game.networkState({...snapshot,status:'finished',results},'you');
 game.networkState({...snapshot,status:'finished',results},'you');
 expect(finish).toHaveBeenCalledOnce();
 expect(finish.mock.lastCall?.[0].racers.map((r:any)=>r.id)).toEqual(results.map(r=>r.id));
 expect(finish.mock.lastCall?.[0]).toMatchObject({timeTrial:true,online:true,ghostSaved:undefined,newBest:undefined});
 const debriefMarkup=renderToStaticMarkup(createElement(RaceDebrief,{result:finish.mock.lastCall?.[0]}));
 expect(debriefMarkup).toContain('Ranked by the fastest valid lap');
 expect(debriefMarkup).not.toMatch(/ghost/i);
 game.showGarage();expect(game.timeTrial).toBe(false);expect(game.authoritativeResults).toBeNull();
});
