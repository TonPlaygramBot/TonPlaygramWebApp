import {useState} from 'react';
import {WEAPON_BY_ID} from '../shared/weapons.mjs';
import {reserveCapacity} from '../shared/ammunition.mjs';
import type {CityEconomySimulation,EconomyAction} from './CityEconomySimulation.mjs';
import './property-bank.css';
type Props={economy:CityEconomySimulation;onAction:(action:EconomyAction,id:string,amount?:number,weapon?:string)=>boolean;onWallet:()=>void;onClose:()=>void};
export function PropertyBankPanel({economy,onAction,onWallet,onClose}:Props){
 const [amount,setAmount]=useState('100'),[notice,setNotice]=useState(''),[confirmRob,setConfirmRob]=useState(false),[,refresh]=useState(0);
 const player=economy.sim.player,site=economy.selected;
 const choices=Object.keys(player.inventory).filter(id=>{const w=WEAPON_BY_ID.get(id);return w&&w.category!=='melee';});
 const [weapon,setWeapon]=useState(choices.includes(player.weapon)?player.weapon:choices[0]||'');
 if(!site)return <section className="tsc-economy"><h2>City services</h2><p>Walk to a bank counter or a property entrance to use its services.</p><button onClick={onClose}>Return to the city</button></section>;
 const owned=economy.owns(site.id),bank=site.kind==='bank',w=WEAPON_BY_ID.get(weapon),inv=player.inventory[weapon],stored=economy.data.stash[site.id]?.[weapon]||0;
 const request=(action:EconomyAction,value=Number(amount))=>{
  const ok=onAction(action,site.id,value,weapon);setNotice(economy.sim.body.notice);refresh(v=>v+1);
  if(ok&&action==='rob')onClose();return ok;
 };
 const blocked=economy.blockedReason;
 return <section className="tsc-economy" aria-label={bank?'Bank services':'Property services'}>
  <div className="tsc-economy-heading"><div><small>{bank?'CITY BANK':owned?'YOUR HOME':'PROPERTY FOR SALE'}</small><h2>{site.name}</h2></div><button aria-label="Close services" onClick={onClose}>×</button></div>
  <p className="tsc-economy-money">Pocket: <strong>{Math.floor(player.cash).toLocaleString()}</strong> street cash {bank&&<> · Bank: <strong>{economy.data.bank.toLocaleString()}</strong></>}</p>
  <p className="tsc-economy-note">Street cash is fictional game money. Your TPG wallet is separate.</p>
  {blocked&&<p role="status">{blocked}</p>}
  {bank?<>
   <label>Street cash amount<input inputMode="numeric" type="number" min="1" step="1" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <div className="tsc-economy-row"><button disabled={!!blocked} onClick={()=>request('deposit')}>Deposit</button><button disabled={!!blocked} onClick={()=>request('withdraw')}>Withdraw</button></div>
   <div className="tsc-economy-row"><button disabled={!!blocked||player.cash<1} onClick={()=>request('deposit',Math.floor(player.cash))}>Deposit all cash</button><button disabled={!!blocked||economy.data.bank<1} onClick={()=>request('withdraw',economy.data.bank)}>Withdraw saved cash</button></div>
   <button className="tsc-economy-wallet" onClick={onWallet}>Open TPG wallet ↗</button>
   <p className="tsc-economy-note">TPG transfers use your existing account wallet. Bank jobs only award street cash.</p>
   <details className="tsc-economy-job"><summary>Fictional bank job</summary><p>Trigger the alarm, hold the teller zone for 18 seconds, then escape 100 m and lose your wanted stars. Death or arrest cancels the reward.</p>
    {economy.data.cooldowns[site.id]>0?<p>Branch recovery: {Math.ceil(economy.data.cooldowns[site.id]/60)} min</p>:confirmRob?<div className="tsc-economy-row"><button disabled={!!blocked} onClick={()=>request('rob')}>Start alarm and job</button><button onClick={()=>setConfirmRob(false)}>Cancel</button></div>:<button disabled={!!blocked} onClick={()=>setConfirmRob(true)}>Prepare bank job</button>}
   </details>
  </>:!owned?<>
   <p>{site.kind[0].toUpperCase()+site.kind.slice(1)} · {site.stashMagazines} spare magazines per firearm in home storage.</p>
   <p className="tsc-economy-price">{site.price?.toLocaleString()} street cash</p>
   <button disabled={!!blocked||player.cash<(site.price||0)} onClick={()=>request('purchase')}>Buy this {site.kind}</button>
   <p className="tsc-economy-note">Ownership is saved with your career. Enter your home after purchase to store spare ammunition.</p>
  </>:<>
   <p>Store reserve ammunition here, then collect it before your next drive. Loaded magazines stay with you.</p>
   <label>Weapon<select value={weapon} onChange={e=>setWeapon(e.target.value)}>{choices.map(id=><option key={id} value={id}>{WEAPON_BY_ID.get(id)?.label}</option>)}</select></label>
   <p>Carrying {inv?.reserve||0}/{reserveCapacity(w)} · Stored {stored}/{(site.stashMagazines||0)*(w?.magazine||0)} rounds</p>
   <label>Rounds<input inputMode="numeric" type="number" min="1" step="1" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <div className="tsc-economy-row"><button disabled={!!blocked||!inv} onClick={()=>request('store')}>Store rounds</button><button disabled={!!blocked||!inv} onClick={()=>request('take')}>Take rounds</button></div>
   <div className="tsc-economy-row"><button disabled={!!blocked||!inv?.reserve} onClick={()=>request('store',Math.min(inv?.reserve||0,(site.stashMagazines||0)*(w?.magazine||0)-stored))}>Store spare ammo</button><button disabled={!!blocked||!stored} onClick={()=>request('take',Math.min(stored,reserveCapacity(w)-(inv?.reserve||0)))}>Fill reserve</button></div>
  </>}
  {notice&&<p className="tsc-economy-status" role="status">{notice}</p>}
 </section>;
}
