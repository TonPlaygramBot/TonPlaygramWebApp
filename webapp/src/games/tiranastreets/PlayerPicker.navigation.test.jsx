import React,{act,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {PlayerPicker} from './PlayerPicker';
import {selectedStartingLoadout} from './startingLoadout.mjs';
import {selectedPlayerUrl} from './playerCatalog.mjs';

vi.mock('./LoadoutPreview',()=>({LoadoutPreview:({url,onState})=>{
  useEffect(()=>onState({url,ready:true,message:'Ready'}),[url,onState]);
  return <div role="img" aria-label="Loaded character"/>;
}}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,host;
afterEach(async()=>{await act(async()=>root?.unmount());host?.remove();vi.unstubAllGlobals();});
it('chooses a real character, enforces three weapons, and passes the chosen kit to the game',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({players:{}})})));
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  const start=vi.fn(),back=vi.fn();
  await act(async()=>root.render(<PlayerPicker onStart={start} onBack={back}/>));
  const click=async(selector)=>{const button=host.querySelector(selector);expect(button).toBeTruthy();await act(async()=>button.click());};
  const operator=[...host.querySelectorAll('.player-options button')].find(b=>b.textContent==='City Operator');
  await act(async()=>operator.click());await click('.player-continue');
  expect(host.querySelector('h1').textContent).toBe('Choose three weapons');
  expect(host.querySelectorAll('.loadout-weapon[aria-pressed=true]').length).toBe(3);
  await click('[aria-label="Choose AR15 Rifle"]');
  expect(host.querySelectorAll('.loadout-weapon[aria-pressed=true]').length).toBe(3);
  expect(host.querySelector('.loadout-count').textContent).toContain('Remove one');
  await click('[aria-label="Remove PP-19-01 · Vityaz"]');
  expect(host.querySelector('.player-continue').disabled).toBe(true);
  await click('.player-continue');expect(start).not.toHaveBeenCalled();
  await click('[aria-label="Choose AR15 Rifle"]');
  await click('.player-back');expect(back).not.toHaveBeenCalled();
  await click('.player-continue');await click('.player-continue');
  expect(start).toHaveBeenCalledTimes(1);
  expect(selectedStartingLoadout()).toEqual(['adaptiveCombatRifleAttack','makarovAttack','ar15Attack']);
  expect(selectedPlayerUrl()).toBe('/assets/tirana-streets/living/operator.glb');
});
