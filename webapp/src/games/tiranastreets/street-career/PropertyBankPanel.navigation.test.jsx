import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {PropertyBankPanel} from './PropertyBankPanel';
import {CityEconomySimulation} from './CityEconomySimulation.mjs';
import {ECONOMY_BANKS,ECONOMY_PROPERTIES} from './cityEconomyCatalog.mjs';
import {WEAPON_BY_ID} from '../shared/weapons.mjs';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const weapon=WEAPON_BY_ID.get('ak47VolleyAttack');
const bank={...ECONOMY_BANKS[0],entrance:{x:0,y:.08,z:0},counter:{x:0,y:.08,z:10}};
const home={...ECONOMY_PROPERTIES[0],entrance:{x:10,y:.08,z:0},counter:{x:10,y:.08,z:10}};
let host,root,sim,economy,onAction,onWallet,onClose,paused;
beforeEach(()=>{
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const player={id:'local',x:0,z:10,health:100,cash:10000,wanted:0,weapon:weapon.id,inventory:{[weapon.id]:{ammo:weapon.magazine,reserve:90}},tpg:123};
 sim={player,body:{y:.08,grounded:true,interaction:'free',notice:''},state:{elapsed:0,missionId:'free-roam',effects:[],effectSeq:0},arrest:{locked:false},access:{travel:null},event:vi.fn()};
 economy=new CityEconomySimulation(sim,undefined,[bank,home]);economy.selectedId=bank.id;
 onAction=vi.fn((...args)=>economy.transact(...args));onWallet=vi.fn();paused=true;
 onClose=vi.fn(()=>{paused=false;});
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});
const render=()=>act(async()=>root.render(<PropertyBankPanel economy={economy} onAction={onAction} onWallet={onWallet} onClose={onClose}/>));
const button=name=>[...host.querySelectorAll('button')].find(b=>b.textContent===name||b.getAttribute('aria-label')===name);
const click=name=>act(async()=>{const b=button(name);expect(b,`button ${name}`).toBeTruthy();b.click();});
const amount=value=>act(async()=>{
 const input=host.querySelector('input');
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));
 input.dispatchEvent(new Event('input',{bubbles:true}));
});

it('deposits and withdraws entered amounts through actual bank simulation and shows balances',async()=>{
 await render();expect(host.querySelector('[aria-label="Bank services"]')).toBeTruthy();
 const input=host.querySelector('input');expect(input.inputMode).toBe('numeric');expect(input.closest('label').textContent).toContain('Street cash amount');
 await amount(250);await click('Deposit');
 expect(onAction).toHaveBeenLastCalledWith('deposit',bank.id,250,weapon.id);
 expect(economy.data.bank).toBe(250);expect(sim.player.cash).toBe(9750);expect(host.textContent).toContain('250 street cash deposited.');
 await amount(100);await click('Withdraw');
 expect(economy.data.bank).toBe(150);expect(sim.player.cash).toBe(9850);expect(host.textContent).toContain('100 street cash withdrawn.');
 await click('Deposit all cash');expect(sim.player.cash).toBe(0);expect(economy.data.bank).toBe(10000);expect(button('Deposit all cash').disabled).toBe(true);
 await click('Withdraw saved cash');expect(sim.player.cash).toBe(10000);expect(economy.data.bank).toBe(0);expect(button('Withdraw saved cash').disabled).toBe(true);
});

it('rejects fractional or insufficient transfers with visible feedback and never changes TPG',async()=>{
 await render();await amount(.5);await click('Deposit');
 expect(host.textContent).toContain('Enter a positive whole amount.');expect(sim.player.cash).toBe(10000);
 await amount(100);await click('Withdraw');expect(host.textContent).toContain('Amount exceeds your deposited cash');expect(economy.data.bank).toBe(0);
 const before=economy.snapshot();await click('Open TPG wallet ↗');expect(onWallet).toHaveBeenCalledTimes(1);
 expect(onAction).toHaveBeenCalledTimes(2);expect(economy.snapshot()).toEqual(before);expect(sim.player.tpg).toBe(123);expect(onClose).not.toHaveBeenCalled();
});

it('buying a home switches the same panel to storage and transfers only carried reserve rounds inside',async()=>{
 economy.selectedId=home.id;Object.assign(sim.player,{x:10,z:0});await render();
 expect(host.querySelector('[aria-label="Property services"]')).toBeTruthy();await click(`Buy this ${home.kind}`);
 expect(economy.owns(home.id)).toBe(true);expect(sim.player.cash).toBe(10000-home.price);expect(host.textContent).toContain('YOUR HOME');expect(button(`Buy this ${home.kind}`)).toBeUndefined();
 expect(host.querySelector('select').value).toBe(weapon.id);expect(host.textContent).toContain('Carrying 90/1200');
 await amount(30);await click('Store rounds');expect(host.textContent).toContain('Walk inside to the service counter.');expect(sim.player.inventory[weapon.id].reserve).toBe(90);
 sim.player.z=10;await render();await click('Store rounds');
 expect(economy.data.stash[home.id][weapon.id]).toBe(30);expect(sim.player.inventory[weapon.id].reserve).toBe(60);expect(host.textContent).toContain('Stored 30/');
 await click('Take rounds');expect(sim.player.inventory[weapon.id].reserve).toBe(90);expect(economy.data.stash[home.id][weapon.id]).toBe(0);
 await click('Store spare ammo');expect(sim.player.inventory[weapon.id].reserve).toBe(0);expect(economy.data.stash[home.id][weapon.id]).toBe(90);
 await click('Fill reserve');expect(sim.player.inventory[weapon.id].reserve).toBe(90);expect(sim.player.inventory[weapon.id].ammo).toBe(weapon.magazine);
});

it('bank job requires explicit confirmation, cancellation is harmless, and successful start closes for gameplay',async()=>{
 await render();const details=host.querySelector('details');details.open=true;
 await click('Prepare bank job');expect(onAction).not.toHaveBeenCalled();expect(economy.robbery).toBeNull();expect(paused).toBe(true);
 await click('Cancel');expect(button('Start alarm and job')).toBeUndefined();expect(economy.robbery).toBeNull();
 await click('Prepare bank job');await click('Start alarm and job');
 expect(onAction).toHaveBeenLastCalledWith('rob',bank.id,100,weapon.id);expect(economy.robbery.phase).toBe('hold');expect(sim.player.wanted).toBeGreaterThan(0);
 expect(onClose).toHaveBeenCalledTimes(1);expect(paused).toBe(false);expect(sim.player.cash).toBe(10000);expect(sim.player.tpg).toBe(123);
});

it('failed bank-job start stays in panel; missions disable transfers and wanted teller rejection is visible',async()=>{
 sim.player.weapon='combatKnife';await render();await click('Prepare bank job');await click('Start alarm and job');
 expect(economy.robbery).toBeNull();expect(onClose).not.toHaveBeenCalled();expect(host.textContent).toContain('Equip a firearm');
 sim.state.missionId='first-shift';await render();expect(button('Deposit').disabled).toBe(true);expect(button('Withdraw').disabled).toBe(true);expect(host.textContent).toContain('Available during free roam');
 const calls=onAction.mock.calls.length;await click('Deposit');expect(onAction).toHaveBeenCalledTimes(calls);
 sim.state.missionId='free-roam';sim.player.wanted=1;await render();await click('Deposit');
 expect(host.textContent).toContain('The teller is closed while you are wanted.');expect(economy.data.bank).toBe(0);
});

it('unavailable site and close controls return through the supplied callback',async()=>{
 economy.selectedId=null;await render();expect(host.textContent).toContain('Walk to a bank counter');await click('Return to the city');expect(onClose).toHaveBeenCalledTimes(1);
 economy.selectedId=bank.id;await render();await click('Close services');expect(onClose).toHaveBeenCalledTimes(2);expect(onAction).not.toHaveBeenCalled();
});
