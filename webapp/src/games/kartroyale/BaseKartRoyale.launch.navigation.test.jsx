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
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

it('imports the garage without eagerly constructing all circuit minimaps',()=>{
 expect(harness.makeTrack).not.toHaveBeenCalled();
});
it('opens the real garage, prepares only the shown circuit and starts an AI race',async()=>{
 localStorage.clear();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<BaseKartRoyale/>));
  expect(host.querySelector('.kr-lobby')).not.toBeNull();
  expect(new Set(harness.makeTrack.mock.calls.map(([id])=>id))).toEqual(new Set(['skanderbeg']));
  expect(host.textContent).not.toContain('FREE ROAM');
  expect(host.querySelector('#kr-roam-start')).toBeNull();
  const launch=host.querySelector('button.kr-start');
  expect(launch).toBeTruthy();expect(launch.disabled).toBe(false);
  await act(async()=>launch.click());
  expect(harness.game.startLocal).toHaveBeenCalledWith('skanderbeg','rookie',false);
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
  expect(harness.game.startLocal).toHaveBeenCalledWith('skanderbeg','rookie',false);
  expect(harness.game.startCombatRace).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('creates a standard free room and retains the selected circuit',async()=>{
 sessionStorage.clear();const socket=testSocket();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<BaseKartRoyale getSocket={async()=>socket}/>));
  await act(async()=>[...host.querySelectorAll('.kr-mode')].find(b=>b.textContent.includes('MULTIPLAYER')).click());
  await clickText(host,'Create room');
  expect(socket.emit).toHaveBeenCalledWith('kart:create',expect.objectContaining({raceFormat:'race',trackId:'skanderbeg'}),expect.any(Function));
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
