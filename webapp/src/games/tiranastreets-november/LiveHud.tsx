import {useEffect, useState} from 'react';
import {loadWeaponStoreAccount} from './weaponStoreApi';
import './live-hud.css';
export function LiveHud({health, maxHealth=100}: {health:number;maxHealth?:number}) {
  const [balance,setBalance]=useState<number|null>(null), [stale,setStale]=useState(false);
  useEffect(()=>{
    let disposed=false, pending=false;
    const refresh=async()=>{
      if(pending || document.hidden)return; pending=true;
      try {const account=await loadWeaponStoreAccount();
        if(!disposed){const n=account.balanceTPG;setBalance(typeof n==='number'&&Number.isFinite(n)?n:null);setStale(false);}
      }catch{if(!disposed)setStale(true);}finally{pending=false;}
    };
    void refresh();const timer=window.setInterval(refresh,30000);
    window.addEventListener('focus',refresh);window.addEventListener('tpgBalanceUpdated',refresh);
    document.addEventListener('visibilitychange',refresh);
    return()=>{disposed=true;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('tpgBalanceUpdated',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  const life=Math.max(0,Math.min(100,Math.ceil(health/Math.max(1,maxHealth)*100)));
  return <aside className="ts-live-hud" aria-label="Life and TPG balance">
    <span aria-label={`Life ${life}%`} className={life<25?'is-low':''}>♥ {life}%</span>
    <span aria-label={balance===null?'TPG balance unavailable':`TPG balance ${balance}${stale?', last known balance':''}`} title={stale?'Balance temporarily unavailable; showing last confirmed value':undefined}>TPG {balance===null?'—':balance.toLocaleString(undefined,{maximumFractionDigits:2})}{stale&&balance!==null?'*':''}</span>
  </aside>;
}
