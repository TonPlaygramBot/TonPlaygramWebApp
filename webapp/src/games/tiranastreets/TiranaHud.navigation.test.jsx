import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {MissionReadout} from './MissionReadout';
import {Game} from '../blackwater/baseUi';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const engineMock = vi.hoisted(() => ({current:null, snapshot:null}));
vi.mock('../blackwater/engine', () => ({GameEngine:class {
  constructor(_canvas, _surface, publish) {
    this.settings = {sensitivity:1,volume:.55,assist:true,quality:'auto',targetFps:60,bloodEffects:true};
    this.input = {active:true,move:{x:0,y:0},sprinting:false};
    this.publish=publish;
    this.pause=vi.fn();this.resume=vi.fn();this.dispose=vi.fn();this.setSettings=vi.fn();
    engineMock.current=this;
    if(engineMock.snapshot)publish(engineMock.snapshot);
  }
}}));
vi.mock('../blackwater/BattlefieldPlayer', () => ({BODY_WEAPON:{ak47:'ak47'}}));
vi.mock('../blackwater/startingWeapons', () => ({startingWeapons:()=>['ak47']}));
vi.mock('../blackwater/shared/layout.mjs', () => ({roads:[],buildings:[],START:{x:0,z:0},ORIGIN:{x:0,z:0},EXTRACTION:{x:0,z:0},ATTRIBUTION:'Map attribution',BATTLEFIELD_MAPS:[{id:'square',name:'Square'}]}));
vi.mock('../blackwater/shared/battlefield.mjs', () => ({BATTLE_MODES:[{id:'sweep',name:'District sweep',description:'Clear and extract.'}],OPERATIONS:[{id:'first',map:'square',mode:'sweep',title:'First mission'}],operationUnlocked:()=>true}));
vi.mock('../blackwater/core', () => ({WEAPONS:{ak47:{name:'AK47',role:'Rifle'}},clamp:(n,min,max)=>Math.max(min,Math.min(max,n))}));
vi.mock('./LiveHud', () => ({LiveHud:()=>null}));
vi.mock('./WeaponSwitcher', () => ({WeaponSwitcher:()=>null}));
vi.mock('./OpticalSight', () => ({OpticalSight:()=>null}));
let host, root;
const click = async element => { await act(async () => element.click()); };
const render = async element => { await act(async () => root.render(element)); };
beforeEach(() => {
  window.localStorage.clear();engineMock.snapshot=null;
  HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  HTMLDialogElement.prototype.close=function(){this.open=false;};
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount());host.remove();vi.restoreAllMocks(); });
it('changes capture status to contested and extraction without retaining stale timer or hints', async () => {
  await render(<MissionReadout label="Operation" eyebrow="District hold" title="CAPTURE" progress={.3} remaining={31} meta={['4 hostiles']} hint="Stay near the beacon"/>);
  expect(host.querySelector('progress').value).toBe(.3);
  expect(host.querySelector('time').textContent).toBe('31s');
  await render(<MissionReadout label="Operation" eyebrow="District hold" title="CONTESTED" progress={.3} contested hint="Clear nearby threats"/>);
  expect(host.querySelector('.is-contested')).not.toBeNull();
  expect(host.querySelector('time')).toBeNull();
  expect(host.textContent).not.toContain('4 hostiles');
  await render(<MissionReadout label="Operation" eyebrow="Extraction open" title="EXTRACT" progress={1} meta={['23 m to extraction']}/>);
  expect(host.querySelector('.is-contested')).toBeNull();
  expect(host.querySelector('.ts-mission-hint')).toBeNull();
  expect(host.querySelector('progress').value).toBe(1);
  expect(host.textContent).toContain('23 m to extraction');
});
it('bounds progress and handles malformed or absent optional numeric data', async () => {
  await render(<MissionReadout label="Job" eyebrow="Delivery" title="DELIVER" progress={7} remaining={-4}/>);
  expect(host.querySelector('progress').value).toBe(1);
  expect(host.querySelector('time').textContent).toBe('0s');
  await render(<MissionReadout label="Job" eyebrow="Delivery" title="DELIVER" progress={NaN} remaining={Infinity}/>);
  expect(host.querySelector('progress')).toBeNull();expect(host.querySelector('time')).toBeNull();
  expect(host.textContent).not.toMatch(/NaN|Infinity/);
});
it('applies and persists Battlefield layout and HUD preferences independently from gameplay settings', async () => {
  await render(<Game onExit={()=>{}}/>);
  await click(host.querySelector('[aria-label="Game settings"]'));
  expect(engineMock.current.pause).toHaveBeenCalledOnce();
  await click(host.querySelector('[aria-label="Left-handed controls"]'));
  await click(host.querySelector('[aria-label="Clear view"]'));
  await click(host.querySelector('[aria-label="Performance statistics"]'));
  expect(host.querySelector('.bw-scope').classList.contains('is-left-handed')).toBe(true);
  expect(host.querySelector('.bw-scope').classList.contains('is-compact')).toBe(true);
  expect(JSON.parse(localStorage.getItem('tirana-streets:battlefield-interface:v1'))).toEqual({leftHanded:true,compactHud:true,showPerformance:true});
  expect(engineMock.current.setSettings).not.toHaveBeenCalled();
  await click(host.querySelector('[aria-label="Blood traces"]'));
  expect(engineMock.current.setSettings).toHaveBeenCalledWith({bloodEffects:false});
  await act(async()=>root.unmount());root=createRoot(host);
  await render(<Game onExit={()=>{}}/>);
  expect(host.querySelector('.bw-scope').classList.contains('is-left-handed')).toBe(true);
  expect(host.querySelector('.bw-scope').classList.contains('is-compact')).toBe(true);
});
it('ignores malformed saved HUD booleans', async () => {
  localStorage.setItem('tirana-streets:battlefield-interface:v1',JSON.stringify({leftHanded:'true',compactHud:1,showPerformance:[]}));
  await render(<Game onExit={()=>{}}/>);
  expect(host.querySelector('.bw-scope').classList.contains('is-left-handed')).toBe(false);
  expect(host.querySelector('.bw-scope').classList.contains('is-compact')).toBe(false);
});
it('renders authoritative online match progress without solo director information', async () => {
  engineMock.snapshot={phase:'paused',health:100,maxHealth:100,ammo:30,reserve:100,kills:3,wave:1,remaining:2,score:10,time:42,fps:60,reload:0,aim:false,crouch:false,heading:0,extract:false,extraction:0,distance:20,hit:0,hurt:0,message:'',messageKind:'',medkits:1,weapon:'ak47',shots:4,hits:3,x:0,z:0,enemies:[],quality:1,ready:true,best:0,compatibility:false,objectiveStage:'capture',objectiveHint:'Offline hint',objectiveRatio:.4,
    online:{rule:'deathmatch',players:[{hp:100},{hp:100}],killLimit:10,limit:180,elapsed:42}};
  await render(<Game mode="online" onExit={()=>{}}/>);
  expect(host.querySelector('.mission-status').textContent).toContain('TPG DEATHMATCH');
  expect(host.querySelector('.mission-status').textContent).toContain('/ 10 KILLS');
  expect(host.querySelector('.mission-status').textContent).not.toContain('Offline hint');
  expect(host.querySelector('.mission-status progress')).toBeNull();
});
