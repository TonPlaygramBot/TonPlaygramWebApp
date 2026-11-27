import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
const harness=vi.hoisted(()=>({makeTrack:vi.fn(),game:null}));
vi.mock('./simulation.mjs',async importOriginal=>{
 const actual=await importOriginal();harness.makeTrack.mockImplementation(actual.makeTrack);
 return {...actual,makeTrack:harness.makeTrack};
});
vi.mock('./renderer',()=>({KartRenderer:class{
 constructor(_host,onFrame,onFinish){harness.game=this;this.input={};this.combatInput={reload:false};this.onFrame=onFrame;this.onFinish=onFinish;}
 load=vi.fn(async()=>{});setColor=vi.fn();setKart=vi.fn();setQuality=vi.fn();setCameraMode=vi.fn();
 networkInput=vi.fn(()=>this.input);networkState=vi.fn();showGarage=vi.fn();startLocal=vi.fn();startCaptainDuel=vi.fn();startFirstBattleCareer=vi.fn();startDriftBattleCareer=vi.fn();startCombatRace=vi.fn();queueCombatReload=vi.fn();queueCombatPulse=vi.fn();pause=vi.fn();clearInput=vi.fn(()=>{this.input={};this.combatInput={reload:false};});destroy=vi.fn();
}}));
vi.mock('./audio',()=>({KartAudio:class{unlock(){}update(){}silence(){}beep(){}destroy(){}setMuted(){}}}));
import BaseKartRoyale from './BaseKartRoyale';
import {TRACKS} from './simulation.mjs';
const firstTrack=TRACKS[0].id;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

it('imports the garage without eagerly constructing all circuit minimaps',()=>{
 expect(harness.makeTrack).not.toHaveBeenCalled();
});
it('opens the real garage, prepares only the shown circuit and starts an AI race',async()=>{
 localStorage.clear();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<BaseKartRoyale/>));
  expect(host.querySelector('.kr-lobby')).not.toBeNull();
  expect(new Set(harness.makeTrack.mock.calls.map(([id])=>id))).toEqual(new Set([firstTrack]));
  expect(host.textContent).not.toContain('FREE ROAM');
  expect(host.querySelector('#kr-roam-start')).toBeNull();
  const launch=host.querySelector('button.kr-start');
  expect(launch).toBeTruthy();expect(launch.disabled).toBe(false);
  await act(async()=>launch.click());
  expect(harness.game.startLocal).toHaveBeenCalledWith(firstTrack,'rookie',false);
 }finally{await act(async()=>root.unmount());host.remove();}
 expect(harness.game.destroy).toHaveBeenCalledOnce();
});

async function clickText(host,text) {
 const button=[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
 expect(button).toBeTruthy();
 await act(async()=>button.click());
}
function testSocket() {
 const listeners=new Map();
 const socket={connected:true,on:vi.fn((event,handler)=>listeners.set(event,handler)),off:vi.fn(),timeout:vi.fn(),emit:vi.fn()};
 socket.timeout.mockReturnValue(socket);
 socket.emit.mockImplementation((event,payload,ack)=>{
  if(!ack)return;
  if(event==='kart:create'||event==='kart:quick') {
   const state={code:'ABCDEF',hostId:'you',trackId:payload.trackId,raceFormat:payload.raceFormat,cupIndex:payload.raceFormat==='championship'?payload.cupIndex:null,public:event==='kart:quick',status:'waiting',players:[{id:'you',name:'Racer',ready:false,connected:true}],racers:[],elapsed:0,startsAt:0,serverNow:0,results:[],tableId:null};
   ack(null,{ok:true,code:state.code,playerId:'you',token:'token',state});
  }else ack(null,{ok:true});
 });
 return socket;
}

it('offers only normal racing under AI and multiplayer with no retired entrypoints',async()=>{
 localStorage.clear();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<BaseKartRoyale/>));
  expect([...host.querySelectorAll('.kr-mode b')].map(el=>el.textContent)).toEqual(['VS AI','MULTIPLAYER']);
  expect(host.querySelector('[aria-label="Racing activity"]')).toBeNull();
  expect(host.querySelector('.kr-cups')).toBeNull();
  for(const label of ['Career', 'Combat race', 'Time trial', 'CITY JOBS & ACTION MISSIONS'])expect(host.textContent).not.toContain(label);
  await act(async()=>host.querySelector('.kr-start').click());
  expect(harness.game.startLocal).toHaveBeenCalledWith(firstTrack,'rookie',false);
  expect(harness.game.startCombatRace).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('creates a standard free room and retains the selected circuit',async()=>{
 sessionStorage.clear();const socket=testSocket();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<BaseKartRoyale getSocket={async()=>socket}/>));
  await act(async()=>[...host.querySelectorAll('.kr-mode')].find(b=>b.textContent.includes('MULTIPLAYER')).click());
  await clickText(host,'Create room');
  expect(socket.emit).toHaveBeenCalledWith('kart:create',expect.objectContaining({raceFormat:'race',trackId:firstTrack}),expect.any(Function));
  expect(host.textContent).toContain('ABCDEF');
  expect(host.querySelector('[aria-label="Racing activity"]')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();sessionStorage.clear();}
});

it('lets standard multiplayer select free rooms or the existing TPG lobby',async()=>{
 sessionStorage.clear();const socket=testSocket();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<BaseKartRoyale getSocket={async()=>socket} renderOnlineLobby={()=> <div data-testid="paid-lobby">PAID MATCHMAKING</div>}/>));
  await act(async()=>[...host.querySelectorAll('.kr-mode')].find(b=>b.textContent.includes('MULTIPLAYER')).click());
  await clickText(host,'FREE ROOMS');
  expect(host.querySelector('[data-testid="paid-lobby"]')).toBeNull();
  expect(host.textContent).toContain('Create room');
  await clickText(host,'TPG RACES');
  expect(host.querySelector('[data-testid="paid-lobby"]')).not.toBeNull();
  expect(host.textContent).not.toContain('Create room');
 }finally{await act(async()=>root.unmount());host.remove();sessionStorage.clear();}
});

it('blocks career while room creation is pending or a multiplayer seat is active',async()=>{
 sessionStorage.clear();const socket=testSocket(),onCareer=vi.fn();let completeCreate;
 const original=socket.emit.getMockImplementation();
 socket.emit.mockImplementation((event,payload,ack)=>{
  if(event==='kart:create'){completeCreate=()=>original(event,payload,ack);return;}
  return original(event,payload,ack);
 });
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const career=()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('CAREER ·'));
 try{
  await act(async()=>root.render(<BaseKartRoyale getSocket={async()=>socket} onCareer={onCareer}/>));
  expect(career().disabled).toBe(false);
  await act(async()=>[...host.querySelectorAll('.kr-mode')].find(b=>b.textContent.includes('MULTIPLAYER')).click());
  await clickText(host,'Create room');
  expect(completeCreate).toBeTypeOf('function');expect(career().disabled).toBe(true);
  await act(async()=>career().click());expect(onCareer).not.toHaveBeenCalled();
  await act(async()=>completeCreate());
  expect(host.textContent).toContain('ABCDEF');expect(career().disabled).toBe(true);
  await act(async()=>career().click());expect(onCareer).not.toHaveBeenCalled();
  await clickText(host,'Leave');expect(career().disabled).toBe(false);
  await act(async()=>career().click());expect(onCareer).toHaveBeenCalledOnce();
  expect(sessionStorage.getItem('kartroyale.session')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();sessionStorage.clear();}
});


it('launches and rematches an opt-in Captain duel without overwriting existing progress',async()=>{
 localStorage.clear();sessionStorage.clear();
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<BaseKartRoyale/>));
  await clickText(host,'street');
  const route=host.querySelector('.kr-track-selector h3').textContent;
  const snapshot=()=>({...localStorage});
  const before=snapshot();
  const duel=host.querySelector('.kr-captain-launch');
  expect(duel).not.toBeNull();expect(duel.disabled).toBe(false);
  await act(async()=>duel.click());
  expect(harness.game.startCaptainDuel).toHaveBeenCalledWith(firstTrack,'street');
  expect(host.querySelector('.rr-place small').textContent).toBe('CAPTAIN DUEL');
  expect(host.querySelector('.rr-place span').textContent).toContain('/2');
  await act(async()=>harness.game.onFinish({
    captainDuel:true,online:false,elapsed:95,trackId:firstTrack,playerId:'you',
    racers:[{id:'you',name:'You',finished:true,finishTime:95},{id:'captain-ali-demi',name:'Ali Demi Captain',ai:true,finished:false,lap:3}]
  }));
  expect(host.textContent).toContain('CAPTAIN BEATEN.');
  expect(host.textContent).toContain(route);
  expect(host.textContent).toContain('No credits, stakes or career record.');
  expect(snapshot()).toEqual(before);
  await clickText(host,'REMATCH CAPTAIN');
  expect(harness.game.startCaptainDuel).toHaveBeenCalledTimes(2);
  expect(harness.game.startCaptainDuel).toHaveBeenLastCalledWith(firstTrack,'street');
  expect(sessionStorage.length).toBe(0);
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('hides Captain practice while the multiplayer garage is selected',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<BaseKartRoyale getSocket={async()=>testSocket()}/>));
  expect(host.querySelector('.kr-captain-launch')).not.toBeNull();
  await act(async()=>[...host.querySelectorAll('.kr-mode')].find(b=>b.textContent.includes('MULTIPLAYER')).click());
  expect(host.querySelector('.kr-captain-launch')).toBeNull();
  await clickText(host,'Create room');
  expect(harness.game.startCaptainDuel).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();sessionStorage.clear();}
});

it('opens only the fixed Brryli Battle event and awards local XP once without altering regular or online progress',async()=>{
 localStorage.clear();sessionStorage.clear();
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const key='tonplaygram.kartroyale.battle-career.v1';
 const result={battleCareerMission:'ali-demi-01',online:false,elapsed:95,trackId:'tirana-brryli',playerId:'you',racers:[
  {id:'you',name:'You',finished:true,finishTime:95,lap:4,lapTimes:[32,31,32]},
  ...Array.from({length:5},(_,i)=>({id:`ai-${i+1}`,name:`Rival ${i+1}`,ai:true,finished:false,lap:3}))
 ]};
 try{
  await act(async()=>root.render(<BaseKartRoyale/>));
  const before={...localStorage};
  await act(async()=>host.querySelector('.kr-battle-launch').click());
  expect(harness.game.startFirstBattleCareer).toHaveBeenCalledWith('rookie');
  expect(harness.game.startLocal).not.toHaveBeenCalled();
  expect(host.querySelector('.rr-place small').textContent).toBe('BATTLE CAREER');
  await act(async()=>harness.game.onFinish({...result,trackId:firstTrack}));
  expect({...localStorage}).toEqual(before);
  await clickText(host,'RETRY BATTLE');
  await act(async()=>harness.game.onFinish(result));
  expect(host.textContent).toContain('+350 Battle XP saved on this device.');
  const {[key]:battle,...ordinary}={...localStorage};
  expect(JSON.parse(battle)).toMatchObject({completedMissionIds:['ali-demi-01'],xp:350});
  expect(ordinary).toEqual(before);
  await clickText(host,'RETRY BATTLE');
  await act(async()=>harness.game.onFinish(result));
  expect(host.textContent).toContain('Replays do not award extra XP.');
  expect(localStorage.getItem(key)).toBe(battle);
  expect(sessionStorage.length).toBe(0);
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('locks Kthesa te ura until Vija e parë, persists drift XP once, and replays the same event',async()=>{
 localStorage.clear();sessionStorage.clear();
 const key='tonplaygram.kartroyale.battle-career.v1';
 const host=document.createElement('div');document.body.append(host);let root=createRoot(host);
 try{
  await act(async()=>root.render(<BaseKartRoyale/>));
  expect(host.querySelector('.kr-battle-drift-launch').disabled).toBe(true);
  await act(async()=>root.unmount());
  localStorage.setItem(key,JSON.stringify({version:1,completedMissionIds:['ali-demi-01'],xp:350}));
  root=createRoot(host);
  await act(async()=>root.render(<BaseKartRoyale/>));
  const snapshot={...localStorage};
  const drift=host.querySelector('.kr-battle-drift-launch');
  expect(drift.disabled).toBe(false);
  await act(async()=>drift.click());
  expect(harness.game.startDriftBattleCareer).toHaveBeenCalledWith('rookie');
  expect(host.querySelector('.rr-place small').textContent).toContain('DRIFT 0/200');
  const result={battleCareerMission:'ali-demi-02',battleDriftPoints:240,online:false,elapsed:157,trackId:'tirana-brryli',playerId:'you',
    racers:[{id:'you',name:'You',finished:true,finishTime:156.9,lap:4,lapTimes:[54,52,50.9]}]};
  await act(async()=>harness.game.onFinish({...result,battleDriftPoints:199}));
  expect(localStorage.getItem(key)).toBe(snapshot[key]);
  await clickText(host,'RETRY BATTLE');
  await act(async()=>harness.game.onFinish(result));
  expect(host.textContent).toContain('+375 Battle XP saved on this device.');
  const {[key]:battle,...regular}={...localStorage};
  const {[key]:_old,...oldRegular}=snapshot;
  expect(regular).toEqual(oldRegular);
  expect(JSON.parse(battle)).toMatchObject({completedMissionIds:['ali-demi-01','ali-demi-02'],xp:725});
  await clickText(host,'RETRY BATTLE');
  await act(async()=>harness.game.onFinish(result));
  expect(localStorage.getItem(key)).toBe(battle);
  expect(sessionStorage.length).toBe(0);
 }finally{await act(async()=>root.unmount());host.remove();localStorage.clear();}
});
