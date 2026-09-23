import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
const harness=vi.hoisted(()=>({makeTrack:vi.fn(),game:null}));
vi.mock('./simulation.mjs',async importOriginal=>{
 const actual=await importOriginal();harness.makeTrack.mockImplementation(actual.makeTrack);
 return {...actual,makeTrack:harness.makeTrack};
});
vi.mock('./renderer',()=>({KartRenderer:class{
 constructor(){harness.game=this;this.input={};}
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
