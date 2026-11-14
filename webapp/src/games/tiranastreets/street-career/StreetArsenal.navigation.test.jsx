import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {StreetArsenal} from './StreetArsenal';
import {loadWeaponStoreAccount,purchaseWeapon} from '../weaponStoreApi';
vi.mock('../weaponStoreApi',()=>({loadWeaponStoreAccount:vi.fn(),purchaseWeapon:vi.fn()}));
vi.mock('../shared/cityPopulation.mjs',()=>({nearestShop:()=>({name:'Test Arsenal',x:0,z:0})}));
vi.mock('../shared/cityLife.mjs',()=>({wantedStars:value=>value>0?1:0}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let host,root,p,onOwned,onAction;
beforeEach(()=>{
 vi.resetAllMocks();host=document.createElement('div');document.body.append(host);root=createRoot(host);
 p={x:0,z:0,cash:750,armor:0,health:100,wanted:0,weapon:'',inventory:{}};onOwned=vi.fn();onAction=vi.fn();
 loadWeaponStoreAccount.mockResolvedValue({balanceTPG:5000,ownedWeaponIds:[]});
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=()=>act(async()=>root.render(<StreetArsenal player={p} state={{}} onOwned={onOwned} onAction={onAction}/>));
const item=name=>[...host.querySelectorAll('.tsc-weapon')].find(node=>node.querySelector('strong').textContent===name);
const buy=name=>item(name).querySelector('button');
const button=name=>[...host.querySelectorAll('button')].find(node=>node.textContent===name);
it('uses TPG for a weapon purchase and delivers receipt ownership without spending street cash',async()=>{
 purchaseWeapon.mockResolvedValue({balanceTPG:2000,ownedWeaponIds:['ar15Attack'],weaponId:'ar15Attack',transactionId:'test'});
 await render();const target=buy('AR15 Rifle');expect(target).toBeTruthy();expect(target.disabled).toBe(false);
 await act(async()=>target.click());expect(purchaseWeapon).toHaveBeenCalledWith('tirana-ar15Attack');
 expect(onOwned).toHaveBeenLastCalledWith(['ar15Attack']);expect(host.textContent).toContain('2,000 TPG');expect(p.cash).toBe(750);
});
it('refreshes a stale low balance and enables a purchase once wallet funds arrive',async()=>{
 loadWeaponStoreAccount.mockResolvedValueOnce({balanceTPG:5,ownedWeaponIds:[]});await render();expect(buy('AR15 Rifle').disabled).toBe(true);
 await act(async()=>button('REFRESH TPG BALANCE').click());expect(buy('AR15 Rifle').disabled).toBe(false);expect(host.textContent).toContain('5,000 TPG');
});
it('passive scope and armor show as active and unarmed remains an explicit action',async()=>{
 p.inventory={scope4x:{ammo:1,reserve:0},armorCarrier:{ammo:1,reserve:0}};await render();
 expect(item('4× Universal Scope').textContent).toContain('OWNED · ACTIVE');expect(item('4× Universal Scope').querySelector('button')).toBeNull();
 expect(host.textContent).toContain('ARMOR 0/150');await act(async()=>button('WALK UNARMED').click());expect(onAction).toHaveBeenLastCalledWith('equip:');
});
it('does not purchase remotely or while wanted and shows why shopping is unavailable',async()=>{
 p.x=100;await render();expect(buy('AR15 Rifle').disabled).toBe(true);expect(host.textContent).toContain('walk to its open entrance');
 p.x=0;p.wanted=10;await render();expect(buy('AR15 Rifle').disabled).toBe(true);expect(host.textContent).toContain('Lose your wanted stars');expect(purchaseWeapon).not.toHaveBeenCalled();
});
