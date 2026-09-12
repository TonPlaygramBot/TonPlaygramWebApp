import {useEffect,useRef,useState} from 'react';
import {nearestShop} from '../shared/cityPopulation.mjs';
import {WEAPONS,WEAPON_BY_ID} from '../shared/weapons.mjs';
import {wantedStars} from '../shared/cityLife.mjs';
import {WEAPON_STORE_CATALOG} from '../weaponStoreCatalog.mjs';
import {loadWeaponStoreAccount,purchaseWeapon,type WeaponStoreAccount} from '../weaponStoreApi';
import type {State,Player} from '../shared/engine.mjs';

export function StreetArsenal({player:p,state,onAction,onOwned}:{player:Player;state:State;onAction:(a:string)=>void;onOwned:(ids:string[])=>void}) {
 const [filter,setFilter]=useState('all'),[account,setAccount]=useState<WeaponStoreAccount|null>(null),[message,setMessage]=useState('Loading your TPG account…'),[busy,setBusy]=useState('');
 const locked=useRef(false),mounted=useRef(true),grant=useRef(onOwned);grant.current=onOwned;
 useEffect(()=>{mounted.current=true;void refresh();return()=>{mounted.current=false;};},[]);
 async function refresh(){try{const a=await loadWeaponStoreAccount();if(mounted.current){setAccount(a);grant.current(a.ownedWeaponIds);setMessage('TPG equipment is saved to your account.');}}catch(e){if(mounted.current)setMessage((e as Error).message);}}
 const shop=nearestShop(state,p),near=!!shop&&!p.carId&&Math.hypot(p.x-shop.x,p.z-shop.z)<=9;
 const canBuy=near&&p.health>0&&!p.finished&&!p.failed&&wantedStars(p.wanted)===0;
 async function buy(itemId:string){
  if(locked.current||!canBuy||!account)return;locked.current=true;setBusy(itemId);
  try{const receipt=await purchaseWeapon(itemId);grant.current(receipt.ownedWeaponIds);if(mounted.current){setAccount(receipt);setMessage('Purchase complete. Weapon added to your inventory.');}}
  catch(e){if(mounted.current){setMessage((e as Error).message);if((e as {code?:string}).code==='ALREADY_OWNED')void refresh();}}
  finally{locked.current=false;if(mounted.current)setBusy('');}
 }
 const catalog=new Map(WEAPON_STORE_CATALOG.map(w=>[w.weaponId,w]));
 return <section>
  <p>{near?'WEAPONS · Choose equipment':'Walk to a pistol marker on the city map to buy equipment.'}</p>
  <p><strong>{account?account.balanceTPG.toLocaleString():'—'} TPG</strong> · <strong>${p.cash}</strong> street cash for ammunition, healing and armor.</p>
  <p role="status">{message}</p>{!account&&<button disabled={!!busy} onClick={()=>void refresh()}>RETRY ACCOUNT</button>}
  {!near&&<p>Owned weapons can be equipped anywhere.</p>}{wantedStars(p.wanted)>0&&<p>Lose your wanted stars before shopping.</p>}
  <label>Category <select value={filter} onChange={e=>setFilter(e.target.value)}>{['all',...new Set(WEAPONS.map(w=>w.category))].map(c=><option key={c} value={c}>{c}</option>)}</select></label>
  <div className="tsc-chapters">{WEAPONS.filter(w=>(p.inventory[w.id]||catalog.has(w.id))&&(filter==='all'||w.category===filter)).map(w=>{
   const own=p.inventory[w.id],item=catalog.get(w.id),ammoPrice=Math.max(30,Math.round(w.price*.2));
   return <div key={w.id} className="tsc-weapon"><strong>{w.label}</strong><p>{w.category}{own&&w.category!=='melee'?` · ${own.ammo} loaded / ${own.reserve} reserve`:''}</p>
    {own?<><button disabled={p.weapon===w.id||p.finished||p.failed} onClick={()=>onAction(`equip:${w.id}`)}>{p.weapon===w.id?'EQUIPPED':'EQUIP'}</button>{w.category!=='melee'&&<button disabled={!canBuy||p.cash<ammoPrice||own.reserve>=w.magazine*8} onClick={()=>onAction(`buy:${w.id}`)}>AMMO ${ammoPrice}</button>}</>:
     item&&<button disabled={!canBuy||!account||!!busy||account.balanceTPG<item.priceTPG} onClick={()=>void buy(item.id)}>{busy===item.id?'PROCESSING…':`BUY · ${item.priceTPG.toLocaleString()} TPG`}</button>}
   </div>;
  })}</div>
  <p><button disabled={!canBuy||p.health>=100||p.cash<90} onClick={()=>onAction('buy:medkit')}>HEAL $90</button> <button disabled={!canBuy||p.armor>=100||p.cash<180} onClick={()=>onAction('buy:armor')}>ARMOR $180</button></p>
  <button onClick={()=>onAction('holster')}>{p.weapon?`HOLSTER ${WEAPON_BY_ID.get(p.weapon)?.label||'WEAPON'}`:'DRAW WEAPON'}</button>
 </section>;
}
