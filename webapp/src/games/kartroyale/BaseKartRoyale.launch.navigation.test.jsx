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
 networkInput=vi.fn(()=>this.input);networkState=vi.fn();showGarage=vi.fn();startLocal=vi.fn();startCombatRace=vi.fn();queueCombatReload=vi.fn();queueCombatPulse=vi.fn();pause=vi.fn();clearInput=vi.fn(()=>{this.input={};this.combatInput={reload:false};});destroy=vi.fn();
}}));
vi.mock('./audio',()=>({KartAudio:class{unlock(){}update(){}silence(){}beep(){}destroy(){}setMuted(){}}}));
import BaseKartRoyale from './BaseKartRoyale';
import { CUPS } from './simulation.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

it('imports the garage without eagerly constructing all circuit minimaps',()=>{
 expect(harness.makeTrack).not.toHaveBeenCalled();
});
it('opens the real garage, prepares only the shown circuit and starts rural free roam',async()=>{
 localStorage.clear();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<BaseKartRoyale/>));
  expect(host.querySelector('.kr-lobby')).not.toBeNull();
  expect(new Set(harness.makeTrack.mock.calls.map(([id])=>id))).toEqual(new Set(['skanderbeg']));
  const free=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('FREE ROAM'));
  await act(async()=>free.click());
  const start=host.querySelector('#kr-roam-start');
  await act(async()=>{start.value='farke';start.dispatchEvent(new Event('change',{bubbles:true}));});
  const launch=host.querySelector('button.kr-start');
  expect(launch).toBeTruthy();expect(launch.disabled).toBe(false);
  await act(async()=>launch.click());
  expect(harness.game.startLocal).toHaveBeenCalledWith('farke','rookie',true);
 }finally{await act(async()=>root.unmount());host.remove();}
 expect(harness.game.destroy).toHaveBeenCalledOnce();
});

it('starts a solo time trial and saves no career wins or credits from a solo finish',async()=>{
 localStorage.clear();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<BaseKartRoyale/>));
  await selectActivity(host,'trial');
  expect(host.textContent).toContain('Recovering invalidates that lap');
  expect(host.querySelector('.kr-difficulty')).toBeNull();
  await act(async()=>host.querySelector('button.kr-start').click());
  expect(harness.game.startLocal).toHaveBeenCalledWith('skanderbeg','street',false,true);
  await act(async()=>harness.game.onFinish({timeTrial:true,newBest:true,personalBest:35,ghostSaved:true,trackId:'skanderbeg',playerId:'you',elapsed:110,
   racers:[{id:'you',name:'You',finished:true,finishTime:110,lap:4,telemetry:{bestLap:35,topSpeed:35,driftDistance:120,draftSeconds:0}}]}));
  expect(host.textContent).toContain('NEW PERSONAL BEST');
  expect(host.textContent).not.toContain('VICTORY');
  expect(localStorage.getItem('tonplaygram.kartroyale.career.v1')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('starts local combat, supports simultaneous controls, and awards no normal career progress',async()=>{
 localStorage.clear();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<BaseKartRoyale/>));
  await selectActivity(host,'combat');
  expect(host.textContent).toContain('no TPG stake or career rewards');
  await act(async()=>host.querySelector('button.kr-start').click());
  expect(harness.game.startCombatRace).toHaveBeenCalledWith('skanderbeg','rookie');
  expect(harness.game.startLocal).not.toHaveBeenCalled();
  await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'r',bubbles:true}));});
  expect(harness.game.input.throttle).toBe(true);expect(harness.game.input.fire).toBe(true);expect(harness.game.combatInput.reload).toBe(true);expect(harness.game.queueCombatReload).toHaveBeenCalledOnce();expect(harness.game.input.reverse).toBe(false);
  await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'e',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'e',repeat:true,bubbles:true}));});
  expect(harness.game.queueCombatPulse).toHaveBeenCalledOnce();
  await act(async()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'f',bubbles:true})));
  expect(harness.game.input.throttle).toBe(true);expect(harness.game.input.fire).toBe(false);
  await act(async()=>window.dispatchEvent(new Event('blur')));
  expect(harness.game.combatInput.reload).toBe(false);expect(harness.game.input.throttle).not.toBe(true);
  await act(async()=>harness.game.onFinish({combat:{player:{kills:2,hits:8}},trackId:'skanderbeg',playerId:'you',elapsed:110,racers:[{id:'you',name:'You',finished:true,finishTime:110,lap:4,telemetry:{bestLap:35,topSpeed:35,driftDistance:120,draftSeconds:0}}]}));
  expect(host.textContent).toContain('2 rival karts disabled');expect(localStorage.getItem('tonplaygram.kartroyale.career.v1')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();}
});


async function selectActivity(host, format) {
 const selector=host.querySelector('[aria-label="Racing activity"]');
 expect(selector).toBeTruthy();
 await act(async()=>{selector.value=format;selector.dispatchEvent(new Event('change',{bubbles:true}));});
}
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

it('shows only the three entry modes and keeps all race features inside VS AI',async()=>{
 localStorage.clear();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<BaseKartRoyale/>));
  expect([...host.querySelectorAll('.kr-mode b')].map(el=>el.textContent)).toEqual(['VS AI','FREE ROAM','MULTIPLAYER']);
  expect([...host.querySelector('[aria-label="Racing activity"]').options].map(o=>o.value)).toEqual(['race','championship','combat','trial']);
  await selectActivity(host,'championship');
  expect(host.querySelectorAll('.kr-cups button')).toHaveLength(CUPS.length);
  await act(async()=>host.querySelector('.kr-start').click());
  expect(harness.game.startLocal).toHaveBeenCalledWith(CUPS[0].track,CUPS[0].difficulty,false);
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('launches shared free roam through its callback instead of starting a solo kart race',async()=>{
 const onFreeRoam=vi.fn();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<BaseKartRoyale onFreeRoam={onFreeRoam}/>));
  await act(async()=>[...host.querySelectorAll('.kr-mode')].find(b=>b.textContent.includes('FREE ROAM')).click());
  expect(host.querySelector('[aria-label="Racing activity"]')).toBeNull();
  expect(host.textContent).toContain('live radio');
  await clickText(host,'ENTER TIRANA CITY');
  expect(onFreeRoam).toHaveBeenCalledOnce();
  expect(harness.game.startLocal).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('exposes the existing career jobs from the nested career activity',async()=>{
 const onCareer=vi.fn();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<BaseKartRoyale onCareer={onCareer}/>));
  expect(host.textContent).not.toContain('CITY JOBS & ACTION MISSIONS');
  await selectActivity(host,'championship');
  await clickText(host,'CITY JOBS & ACTION MISSIONS');
  expect(onCareer).toHaveBeenCalledOnce();
 }finally{await act(async()=>root.unmount());host.remove();}
});

it.each(['combat','trial','championship'])('creates a free online %s room with the selected activity and cup',async(format)=>{
 sessionStorage.clear();const socket=testSocket();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const paidLobby=vi.fn(()=> <div data-testid="paid-lobby">PAID MATCHMAKING</div>);
 try {
  await act(async()=>root.render(<BaseKartRoyale getSocket={async()=>socket} renderOnlineLobby={paidLobby}/>));
  await act(async()=>[...host.querySelectorAll('.kr-mode')].find(b=>b.textContent.includes('MULTIPLAYER')).click());
  expect(host.querySelector('[data-testid="paid-lobby"]')).not.toBeNull();
  paidLobby.mockClear();
  await selectActivity(host,format);
  expect(host.querySelector('[data-testid="paid-lobby"]')).toBeNull();
  expect(paidLobby).not.toHaveBeenCalled();
  if(format==='championship')await act(async()=>host.querySelectorAll('.kr-cups button')[1].click());
  await clickText(host,'Create room');
  expect(socket.emit).toHaveBeenCalledWith('kart:create',expect.objectContaining({raceFormat:format,cupIndex:format==='championship'?1:0,trackId:format==='championship'?CUPS[1].track:'skanderbeg'}),expect.any(Function));
  expect(host.querySelector('[aria-label="Racing activity"]').value).toBe(format);
  expect(host.textContent).toContain('ABCDEF');
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

it('resets an online cup that is still locked when switching back to VS AI',async()=>{
 localStorage.clear();sessionStorage.clear();const socket=testSocket();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<BaseKartRoyale getSocket={async()=>socket}/>));
  await act(async()=>[...host.querySelectorAll('.kr-mode')].find(b=>b.textContent.includes('MULTIPLAYER')).click());
  await selectActivity(host,'championship');
  await act(async()=>host.querySelectorAll('.kr-cups button')[2].click());
  expect(host.querySelectorAll('.kr-cups button')[2].className).toBe('active');
  await act(async()=>[...host.querySelectorAll('.kr-mode')].find(b=>b.textContent.includes('VS AI')).click());
  expect(host.querySelectorAll('.kr-cups button')[0].className).toBe('active');
  expect(host.querySelectorAll('.kr-cups button')[2].disabled).toBe(true);
  await act(async()=>host.querySelector('button.kr-start').click());
  expect(harness.game.startLocal).toHaveBeenCalledWith(CUPS[0].track,CUPS[0].difficulty,false);
 }finally{await act(async()=>root.unmount());host.remove();sessionStorage.clear();}
});

it('shows a ranked online trial lap at timeout even without completing three laps',async()=>{
 localStorage.clear();sessionStorage.clear();const socket=testSocket();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<BaseKartRoyale getSocket={async()=>socket}/>));
  await act(async()=>[...host.querySelectorAll('.kr-mode')].find(b=>b.textContent.includes('MULTIPLAYER')).click());
  await selectActivity(host,'trial');await clickText(host,'Create room');
  await act(async()=>harness.game.onFinish({online:true,timeTrial:true,trackId:'skanderbeg',playerId:'you',elapsed:900,racers:[{id:'you',name:'You',finished:false,finishTime:0,lap:2,telemetry:{bestLap:105,topSpeed:33,driftDistance:0,draftSeconds:0}}]}));
  expect(host.querySelector('.kr-finish-place').textContent).toContain('01');
  expect(host.querySelector('.kr-finish-place').textContent).not.toContain('DNF');
  expect(host.textContent).toContain('FASTEST LAP.');
  expect(localStorage.getItem('tonplaygram.kartroyale.career.v1')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();sessionStorage.clear();}
});
