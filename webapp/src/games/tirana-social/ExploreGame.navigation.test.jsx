import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ExploreGame} from './ExploreGame';
const mocks=vi.hoisted(()=>({runtime:null,publish:null,connection:null,radios:[],media:{local:null,remote:{},error:'',stop:vi.fn()}}));
vi.mock('./ExploreRuntime',()=>({ExploreRuntime:class {
  input={touch:{x:0,y:0,gas:0,fast:false,brake:false,fire:false},clear:()=>this.clear()};audio={unlock:()=>Promise.resolve()};
  constructor(_host,_connection,_fail,publish){mocks.runtime=this;queueMicrotask(()=>publish({fps:60,ready:true,paused:false}));}
  accept(){}setNetworkAvailable(){}media(){}dispose(){}pause(){this.clear();}setOverlay(){this.clear();}clear(){Object.assign(this.input.touch,{x:0,y:0,gas:0,fast:false,brake:false});}
}}));
vi.mock('./ExploreConnection',()=>({ExploreConnection:class {
  join=vi.fn(async()=>{});request=vi.fn(async()=>({}));dispose(){}
  constructor(_id,publish,_fail,status){mocks.connection=this;mocks.publish=publish;queueMicrotask(()=>{status('connected');publish(snapshot());});}
}}));
vi.mock('./useExploreMedia',()=>({useExploreMedia:()=>mocks.media}));
vi.mock('./ExploreSocialPanel',()=>({ExploreSocialPanel:()=> <section>People panel</section>}));
vi.mock('./ExploreCallDock',()=>({ExploreCallDock:()=>null}));
vi.mock('../tiranastreets/radio/VehicleRadio',()=>({VehicleRadio:class {
  state={station:'top-albania',enabled:false,volume:.45,status:'off'};
  setContext=vi.fn();toggle=vi.fn();next=vi.fn();select=vi.fn();dispose=vi.fn();setVolume=vi.fn();snapshot(){return this.state;}
  constructor(){mocks.radios.push(this);}
}}));
function snapshot(carId=null){return {id:'room',version:1,playerId:'me',state:{players:{me:{x:0,z:0,carId,speed:0}}},members:[],messages:[]};}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let host,root;
beforeEach(()=>{
  vi.clearAllMocks();mocks.radios.length=0;mocks.media.local=null;localStorage.clear();localStorage.setItem('accountId','123');
  host=document.createElement('div');document.body.append(host);root=createRoot(host);HTMLElement.prototype.setPointerCapture=vi.fn();
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=()=>act(async()=>root.render(<ExploreGame onExit={()=>{}}/>));
const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
async function pointer(target,type){await act(async()=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,'pointerId',{value:1});target.dispatchEvent(event);});}
it('joins with Turi by default and preserves a saved valid character',async()=>{
  await render();expect(mocks.connection.join).toHaveBeenCalledWith('turi',undefined);
  expect(button('HOLD TO RUN')).toBeTruthy();
});
it('reuses a saved valid character when joining free roam',async()=>{
  localStorage.setItem('racingRoyal.character','athlete-female');await render();expect(mocks.connection.join).toHaveBeenCalledWith('athlete-female',undefined);
});
it('run is held independently of the movement stick and canceled safely',async()=>{
  await render();await pointer(button('HOLD TO RUN'),'pointerdown');expect(mocks.runtime.input.touch.fast).toBe(true);
  Object.assign(mocks.runtime.input.touch,{x:.5,y:1,gas:1});await pointer(host.querySelector('.te-stick'),'pointerup');
  expect(mocks.runtime.input.touch.fast).toBe(true);expect(mocks.runtime.input.touch.y).toBe(0);
  await pointer(button('HOLD TO RUN'),'pointercancel');expect(mocks.runtime.input.touch.fast).toBe(false);
});
it('enter and exit use the authoritative vehicle action, with a held brake while driving',async()=>{
  await render();await act(async()=>button('ENTER CAR').click());expect(mocks.connection.request).toHaveBeenLastCalledWith('interact',{interaction:'vehicle'});
  mocks.runtime.input.touch.fast=true;await act(async()=>mocks.publish(snapshot('car-me')));expect(button('EXIT CAR')).toBeTruthy();expect(mocks.runtime.input.touch.fast).toBe(false);
  await pointer(button('BRAKE'),'pointerdown');expect(mocks.runtime.input.touch.brake).toBe(true);
  await pointer(button('BRAKE'),'lostpointercapture');expect(mocks.runtime.input.touch.brake).toBe(false);
});
it('radio is user controlled, pauses for calls and is disposed when leaving',async()=>{
  await render();const radio=mocks.radios[0];expect(radio.toggle).not.toHaveBeenCalled();
  await act(async()=>button('LIVE RADIO').click());await act(async()=>host.querySelector('[aria-label="Play radio"]').click());expect(radio.toggle).toHaveBeenCalledOnce();
  mocks.media.local={};await render();expect(radio.setContext).toHaveBeenLastCalledWith(false);expect(host.textContent).toContain('Radio pauses during your call');
  await act(async()=>root.unmount());expect(radio.dispose).toHaveBeenCalledOnce();root=createRoot(host);
});
