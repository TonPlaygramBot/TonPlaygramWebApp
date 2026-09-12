import { nearestShop } from '../shared/cityPopulation.mjs';
import {useState} from 'react';
import {WEAPONS,WEAPON_BY_ID} from '../shared/weapons.mjs';
import {wantedStars} from '../shared/cityLife.mjs';
import type {State,Player} from '../shared/engine.mjs';
/** The same arsenal IDs/actions, with explicit device-local save semantics. */
export function StreetArsenal({player:p,state,onAction}:{player:Player;state:State;onAction:(a:string)=>void}){
 const [filter,setFilter]=useState('all');
 const near=!p.carId&&Math.hypot(p.x-nearestShop(state,p).x,p.z-nearestShop(state,p).z)<=9;
 const canBuy=near&&p.health>0&&!p.finished&&!p.failed&&wantedStars(p.wanted)===0;
 return <section><p>{near?'Arben · Choose equipment':'Walk to any Arsenal marker on the city map to buy equipment.'}</p><p><strong>${p.cash}</strong> street cash · Local to this career, not TPG.</p>
 <p role="status">{p.shopMessage||(!near?'Owned weapons can be equipped anywhere.':p.wanted?'Lose your wanted stars before shopping.':'Arsenal open.')}</p>
 <label>Category <select value={filter} onChange={e=>setFilter(e.target.value)}>{['all',...new Set(WEAPONS.map(w=>w.category))].map(c=><option key={c} value={c}>{c}</option>)}</select></label>
 <div className="tsc-chapters">{WEAPONS.filter(w=>filter==='all'||w.category===filter).map(w=>{const own=p.inventory[w.id],price=own?Math.max(30,Math.round(w.price*.2)):w.price;return <div key={w.id} className="tsc-weapon"><strong>{w.label}</strong><p>{w.category} · {own?`${own.ammo} loaded / ${own.reserve} reserve`:`${w.magazine} rounds`}</p>{own&&<button disabled={p.weapon===w.id||p.finished||p.failed} onClick={()=>onAction(`equip:${w.id}`)}>{p.weapon===w.id?'EQUIPPED':'EQUIP'}</button>} <button disabled={!canBuy||p.cash<price||!!own&&own.reserve>=w.magazine*8} onClick={()=>onAction(`buy:${w.id}`)}>{own?'AMMO':'BUY'} ${price}</button></div>;})}</div>
 <p><button disabled={!canBuy||p.health>=100||p.cash<90} onClick={()=>onAction('buy:medkit')}>HEAL $90</button> <button disabled={!canBuy||p.armor>=100||p.cash<180} onClick={()=>onAction('buy:armor')}>ARMOR $180</button></p>
 <button onClick={()=>onAction('holster')}>{p.weapon?`HOLSTER ${WEAPON_BY_ID.get(p.weapon)?.label||'WEAPON'}`:'DRAW WEAPON'}</button>
 <p>Free-roam purchases save on this device. During a job, retry restores the latest checkpoint; successful completion saves the resulting loadout.</p></section>;
}
