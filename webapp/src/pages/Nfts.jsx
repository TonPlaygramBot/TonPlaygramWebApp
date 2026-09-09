import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createAccount } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import { loadGoogleProfile } from '../utils/google.js';
import LoginOptions from '../components/LoginOptions.jsx';
import NftGiftCard from '../components/NftGiftCard.jsx';
import { getPoolRoyalInventory, listOwnedPoolRoyalOptions } from '../utils/poolRoyalInventory.js';
import { getDominoRoyalInventory, listOwnedDominoOptions } from '../utils/dominoRoyalInventory.js';
import { POOL_ROYALE_DEFAULT_LOADOUT, POOL_ROYALE_STORE_ITEMS } from '../config/poolRoyaleInventoryConfig.js';
import { DOMINO_ROYAL_DEFAULT_LOADOUT, DOMINO_ROYAL_STORE_ITEMS, DOMINO_ROYAL_OPTION_SETS } from '../config/dominoRoyalInventoryConfig.js';

const defaultSet=items=>new Set(items.map(item=>`${item.type}:${item.optionId}`));
const poolDefaults=defaultSet(POOL_ROYALE_DEFAULT_LOADOUT),dominoDefaults=defaultSet(DOMINO_ROYAL_DEFAULT_LOADOUT);
const poolPrices=new Map(POOL_ROYALE_STORE_ITEMS.map(item=>[`${item.type}:${item.optionId}`,Number(item.price)||0]));
const dominoPrices=new Map(DOMINO_ROYAL_STORE_ITEMS.map(item=>[`${item.type}:${item.optionId}`,Number(item.price)||0]));
Object.entries(DOMINO_ROYAL_OPTION_SETS).forEach(([type,options])=>options.forEach(option=>{const key=`${type}:${option.id}`;if(!dominoPrices.has(key))dominoPrices.set(key,Number(option.price)||0);}));

/** Separate authentication boundary: login can no longer change hook order. */
export default function Nfts() {
  let telegramId=null;try{telegramId=getTelegramId();}catch{}
  const [googleProfile,setGoogleProfile]=useState(()=>telegramId?null:loadGoogleProfile());
  if(!telegramId&&!googleProfile?.id)return <LoginOptions onAuthenticated={setGoogleProfile}/>;
  return <OwnedNfts key={`${telegramId || ''}:${googleProfile?.id || ''}`} telegramId={telegramId} googleProfile={googleProfile}/>;
}
function OwnedNfts({telegramId,googleProfile}) {
  const [accountId,setAccountId]=useState(''),[items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [search,setSearch]=useState(''),[sort,setSort]=useState('name'),[revision,setRevision]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      setLoading(true);setError('');
      try {
        const account=await createAccount(telegramId,googleProfile);
        if(account?.error||!account?.accountId)throw new Error(account?.error||'Unable to load your collection.');
        if(cancelled)return;
        setAccountId(account.accountId);
        try{localStorage.setItem('accountId',account.accountId);if(account.walletAddress)localStorage.setItem('walletAddress',account.walletAddress);}catch{}
        const results=await Promise.allSettled([
          Promise.resolve().then(()=>getPoolRoyalInventory(account.accountId)).then(listOwnedPoolRoyalOptions),
          Promise.resolve().then(()=>getDominoRoyalInventory(account.accountId)).then(listOwnedDominoOptions)
        ]);
        if(cancelled)return;
        const next=[];
        results.forEach((result,index)=>{
          if(result.status!=='fulfilled')return;
          const defaults=index?dominoDefaults:poolDefaults,prices=index?dominoPrices:poolPrices;
          result.value.forEach(item=>{const key=`${item.type}:${item.optionId}`;next.push({...item,key:`${index}:${key}`,game:index?'Domino Royal':'Pool Royale',thumbnail:index?'/assets/icons/domino-royal.svg':'/assets/icons/pool-royale.svg',isDefault:defaults.has(key),price:prices.get(key)||0});});
        });
        setItems(next);
        if(results.some(result=>result.status==='rejected'))setError('Some game collectibles could not load. Your gift collection is shown separately below.');
      }catch(err){if(!cancelled)setError(err?.message||'Unable to load your collection.');}
      finally{if(!cancelled)setLoading(false);}
    })();return()=>{cancelled=true;};
  },[telegramId,googleProfile,revision]);
  const visible=useMemo(()=>{
    const term=search.trim().toLowerCase();
    return items.filter(item=>`${item.label || item.name || ''} ${item.type || ''} ${item.game}`.toLowerCase().includes(term)).sort((a,b)=>sort==='price-asc'?a.price-b.price:sort==='price-desc'?b.price-a.price:String(a.label||a.name).localeCompare(String(b.label||b.name)));
  },[items,search,sort]);
  return <div className="mx-auto w-full max-w-4xl space-y-6 p-4 text-text">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-subtext">Your collection</p><h1 className="mt-1 text-2xl font-semibold">My NFTs & collectibles</h1><p className="mt-2 max-w-lg text-sm text-subtext">Your gifts and owned game cosmetics, in one place.</p></div><Link to="/account" className="inline-flex min-h-[44px] items-center rounded-lg border border-border px-3 text-sm">Back to profile</Link></header>
    {error&&<div role="alert" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm"><p>{error}</p><button type="button" className="mt-2 min-h-[44px] rounded-lg border border-border px-4" onClick={()=>setRevision(n=>n+1)}>Try again</button></div>}
    {accountId&&<NftGiftCard accountId={accountId}/>}
    <section className="space-y-4" aria-labelledby="game-collectibles-title"><div><h2 id="game-collectibles-title" className="text-xl font-semibold">Game collectibles</h2><p className="mt-1 text-sm text-subtext">Default cosmetics remain yours. Transfers and burns for game cosmetics are not available here.</p></div>
      <div className="flex flex-col gap-3 sm:flex-row"><input aria-label="Search game collectibles" type="search" placeholder="Search by name or game" value={search} onChange={e=>setSearch(e.target.value)} className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-base"/><select aria-label="Sort game collectibles" value={sort} onChange={e=>setSort(e.target.value)} className="min-h-[48px] rounded-xl border border-border bg-surface px-3 text-base"><option value="name">Name: A–Z</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></div>
      {loading?<p role="status" className="rounded-xl border border-border p-5 text-subtext">Loading game collectibles…</p>:visible.length?<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{visible.map(item=><article key={item.key} className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-surface p-4"><img src={item.thumbnail} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl bg-background object-contain p-2"/><div className="min-w-0"><p className="text-xs text-subtext">{item.game}</p><h3 className="mt-1 break-words font-semibold">{item.label||item.name||item.optionId}</h3><p className="mt-1 text-xs text-subtext">{item.type?.replace(/([A-Z])/g,' $1')}</p><p className="mt-2 text-sm">{item.isDefault?'Included cosmetic':item.price?`${item.price.toLocaleString('en-US')} TPG · catalog price`:'Free cosmetic'}</p></div></article>)}</div>:<p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-subtext">{search?'No matching game collectibles.':'No game collectibles to show yet.'}</p>}
    </section>
  </div>;
}
