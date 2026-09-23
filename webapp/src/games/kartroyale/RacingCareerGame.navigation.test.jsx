import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {RacingCareerGame} from './RacingCareerGame';
import {CITY_JOB_KEY,createCityJob} from './cityJobs.mjs';
import {makeTrack} from './simulation.mjs';
const harness=vi.hoisted(()=>({game:null,finish:null,frame:null}));
vi.mock('./renderer',()=>({KartRenderer:class{
 constructor(host,frame,finish){harness.game=this;harness.finish=finish;harness.frame=frame;this.input={};}
 load=vi.fn(async()=>{});setKart=vi.fn();setCameraMode=vi.fn();startLocal=vi.fn();startCityJob=vi.fn();clearInput=vi.fn();pause=vi.fn();showGarage=vi.fn();destroy=vi.fn();
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
