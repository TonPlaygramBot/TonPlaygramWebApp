import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {RacingCareerGame} from './RacingCareerGame';
import {CITY_JOB_KEY,createCityJob} from './cityJobs.mjs';
import {ACTION_CAREER_KEY,createActionCareer} from './actionCareer.mjs';
import {makeTrack} from './simulation.mjs';
const harness=vi.hoisted(()=>({game:null,finish:null,frame:null}));
vi.mock('./renderer',()=>({KartRenderer:class{
 constructor(host,frame,finish){harness.game=this;harness.finish=finish;harness.frame=frame;this.input={};this.actionInput={};}
 load=vi.fn(async()=>{});setKart=vi.fn();setCameraMode=vi.fn();startLocal=vi.fn();startCityJob=vi.fn();startActionCareer=vi.fn();queueAction=vi.fn();clearInput=vi.fn(()=>{this.input={};this.actionInput={};});pause=vi.fn();showGarage=vi.fn();destroy=vi.fn();
}}));
vi.mock('./audio',()=>({KartAudio:class{unlock(){}update(){}silence(){}beep(){}destroy(){}setMuted(){}}}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let host,root;
beforeEach(async()=>{localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<RacingCareerGame onExit={()=>{}}/>));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
it('opens six jobs, starts the original free driving renderer, and pauses without held input',async()=>{
 expect(host.querySelectorAll('.rr-job-card')).toHaveLength(6);expect(harness.game.setCameraMode).toHaveBeenCalledWith('driver');
 await act(async()=>button('ACCEPT JOB').click());expect(harness.game.startCityJob).toHaveBeenCalledWith('market-courier','skanderbeg');expect(harness.game.startLocal).not.toHaveBeenCalled();
 await act(async()=>button('PAUSE').click());expect(harness.game.pause).toHaveBeenLastCalledWith(true);expect(host.querySelector('.rr-career-pause')).not.toBeNull();
 await act(async()=>button('JOB BOARD').click());expect(harness.game.showGarage).toHaveBeenCalledOnce();expect(host.querySelectorAll('.rr-job-card')).toHaveLength(6);
});
it('city completion persists XP once and never records a fictitious championship race',async()=>{
 const key='tonplaygram.kartroyale.career.v1';localStorage.setItem(key,'existing-cup-save');
 await act(async()=>button('ACCEPT JOB').click());
 const state={...createCityJob('market-courier',makeTrack('skanderbeg')),status:'complete',stage:3,elapsed:80,health:100,medal:3,reason:'Gold · flawless run'};
 const result={cityJob:state,racers:[],playerId:'you',elapsed:80,trackId:'skanderbeg'};
 await act(async()=>harness.finish(result));expect(JSON.parse(localStorage.getItem(CITY_JOB_KEY)).medals['market-courier']).toBe(3);expect(localStorage.getItem(key)).toBe('existing-cup-save');expect(host.textContent).toContain('120 city XP');
 await act(async()=>button('RETRY / REPLAY').click());await act(async()=>harness.finish(result));expect(host.textContent).toContain('120 city XP');expect(host.textContent).not.toContain('+120 career XP');
});
it('keeps championship launching and releases the renderer on unmount',async()=>{
 await act(async()=>button('CHAMPIONSHIPS').click());await act(async()=>host.querySelector('.rr-career-card').click());expect(harness.game.startLocal).toHaveBeenCalled();expect(harness.game.startCityJob).not.toHaveBeenCalled();
 const game=harness.game;await act(async()=>root.unmount());root={unmount(){}};expect(game.destroy).toHaveBeenCalledOnce();
});

it('launches a mixed mission, changes controls with the actor, and clears held input on pause and dismount',async()=>{
 await act(async()=>button('ACTION MISSIONS').click());
 expect(host.querySelectorAll('.rr-action-card')).toHaveLength(3);
 await act(async()=>button('ACCEPT MISSION').click());
 expect(harness.game.startActionCareer).toHaveBeenCalledWith('depot-recovery','skanderbeg');
 expect(harness.game.startCityJob).not.toHaveBeenCalled();
 const state=createActionCareer('depot-recovery',makeTrack('skanderbeg'),{x:0,z:0,yaw:0,health:100});
 await act(async()=>harness.frame({actionCareer:state,health:100}));
 await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true})));
 expect(harness.game.input.throttle).toBe(true);
 await act(async()=>harness.frame({actionCareer:{...state,mode:'onfoot'},health:100}));
 expect(harness.game.input.throttle).not.toBe(true);
 expect(host.querySelector('[aria-label="On foot mission controls"]')).not.toBeNull();
 expect(host.querySelector('[aria-label="Kart driving controls"]')).toBeNull();
 await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));});
 expect(harness.game.actionInput.moveZ).toBe(1);expect(harness.game.actionInput.fire).toBe(true);expect(harness.game.actionInput.turn).toBe(1);
 await act(async()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'f',bubbles:true})));
 expect(harness.game.actionInput.moveZ).toBe(1);expect(harness.game.actionInput.fire).toBe(false);
 await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'e',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'e',repeat:true,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key:'e',bubbles:true}));});
 expect(harness.game.queueAction.mock.calls).toEqual([['jump'],['interact']]);
 await act(async()=>button('PAUSE').click());
 expect(harness.game.actionInput.moveZ).not.toBe(1);expect(harness.game.pause).toHaveBeenLastCalledWith(true);
 await act(async()=>button('RESUME MISSION').click());
 expect(harness.game.actionInput.moveZ).not.toBe(1);
});
it('keeps mixed-mission rewards separate and does not duplicate XP on replay',async()=>{
 const key='tonplaygram.kartroyale.career.v1';localStorage.setItem(key,'existing-cup-save');
 await act(async()=>button('ACTION MISSIONS').click());await act(async()=>button('ACCEPT MISSION').click());
 const state={...createActionCareer('depot-recovery',makeTrack('skanderbeg'),{x:0,z:0,yaw:0,health:100}),status:'complete',stage:'extract',elapsed:80,medal:3,reason:'Mission completed',collected:true,staged:true,kills:2,driveDistance:100};
 const result={actionCareer:state,racers:[],playerId:'you',elapsed:80,trackId:'skanderbeg'};
 await act(async()=>harness.finish(result));
 expect(JSON.parse(localStorage.getItem(ACTION_CAREER_KEY)).medals['depot-recovery']).toBe(3);
 expect(localStorage.getItem(key)).toBe('existing-cup-save');expect(localStorage.getItem(CITY_JOB_KEY)).toBeNull();
 const saved=localStorage.getItem(ACTION_CAREER_KEY);
 await act(async()=>button('RETRY / REPLAY').click());await act(async()=>harness.finish(result));
 expect(localStorage.getItem(ACTION_CAREER_KEY)).toBe(saved);expect(host.textContent).not.toContain('+180 action XP');
});
