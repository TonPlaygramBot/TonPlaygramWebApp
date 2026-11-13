import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
const harness=vi.hoisted(()=>({makeTrack:vi.fn(),game:null}));
vi.mock('./simulation.mjs',async importOriginal=>{
 const actual=await importOriginal();harness.makeTrack.mockImplementation(actual.makeTrack);
 return {...actual,makeTrack:harness.makeTrack};
});
vi.mock('./renderer',()=>({KartRenderer:class{
 constructor(_host,onFrame,onFinish){harness.game=this;this.input={};this.onFrame=onFrame;this.onFinish=onFinish;}
 load=vi.fn(async()=>{});setColor=vi.fn();setKart=vi.fn();setQuality=vi.fn();setCameraMode=vi.fn();
 startLocal=vi.fn();pause=vi.fn();clearInput=vi.fn();destroy=vi.fn();
}}));
vi.mock('./audio',()=>({KartAudio:class{unlock(){}update(){}silence(){}beep(){}destroy(){}setMuted(){}}}));
import BaseKartRoyale from './BaseKartRoyale';
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
  const trial=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('TIME TRIAL'));
  await act(async()=>trial.click());
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
