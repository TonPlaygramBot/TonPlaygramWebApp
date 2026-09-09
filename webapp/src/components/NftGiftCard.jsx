import React, { useEffect, useRef, useState } from 'react';
import { createAccount, getAccountInfo, convertGifts } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import { loadGoogleProfile } from '../utils/google.js';
import { NFT_GIFTS, GIFT_BY_ID } from '../utils/nftGifts.js';
import GiftIcon from './GiftIcon.jsx';
import GiftShopPopup from './GiftShopPopup.jsx';
import GiftDialog from './gifts/GiftDialog.jsx';
import { GiftInspection } from './gifts/GiftExperience.jsx';
import { formatGiftPrice } from './gifts/giftCheckout.js';
import './gifts/gifts.css';
export default function NftGiftCard({ accountId: propAccountId }) {
  const [accountId,setAccountId]=useState(propAccountId || ''), [gifts,setGifts]=useState([]), [loading,setLoading]=useState(true);
  const [error,setError]=useState(''), [notice,setNotice]=useState(''), [open,setOpen]=useState(false), [preview,setPreview]=useState(null);
  const [confirm,setConfirm]=useState(false), [busy,setBusy]=useState(false), [convertError,setConvertError]=useState(''), [revision,setRevision]=useState(0);
  const inFlight=useRef(false);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try {
        let id=propAccountId || localStorage.getItem('accountId');
        if(!id){const account=await createAccount(getTelegramId(),loadGoogleProfile());id=account?.accountId;if(id)localStorage.setItem('accountId',id);}
        if(!cancelled){setAccountId(id || '');if(!id)setLoading(false);}
      }catch{if(!cancelled){setError('Sign in to load your gift collection.');setLoading(false);}}
    })();return()=>{cancelled=true;};
  },[propAccountId]);
  useEffect(()=>{
    const refresh=()=>setRevision(n=>n+1);window.addEventListener('tpg:gifts-updated',refresh);return()=>window.removeEventListener('tpg:gifts-updated',refresh);
  },[]);
  useEffect(()=>{
    if(!accountId)return;
    let cancelled=false;setLoading(true);setError('');
    getAccountInfo(accountId).then(info=>{if(info?.error)throw new Error(info.error);if(!cancelled)setGifts(Array.isArray(info?.gifts)?info.gifts:[]);}).catch(()=>{if(!cancelled)setError('Your collection could not load. Please try again.');}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[accountId,revision]);
  const closePreview=()=>{if(inFlight.current)return;setPreview(null);setConfirm(false);setConvertError('');};
  const convert=async()=>{
    if(inFlight.current||!preview?._id)return;
    inFlight.current=true;setBusy(true);setConvertError('');
    try {
      const response=await convertGifts(accountId,[preview._id],'burn');
      if(!response||response.error||response.success===false)throw new Error(response?.error || 'Conversion could not be confirmed. Check your balance before trying again.');
      if(Array.isArray(response.gifts))setGifts(response.gifts);
      setPreview(null);setConfirm(false);setNotice('Gift converted. Your collection is updating.');
      window.dispatchEvent(new CustomEvent('tpg:gifts-updated',{detail:{accountId}}));
    }catch(err){setConvertError(err?.message || 'Conversion could not be confirmed. Check your balance before trying again.');}
    finally{inFlight.current=false;setBusy(false);}
  };
  const details=preview?GIFT_BY_ID[preview.gift]:null;
  return <section className="gift-shelf-card" aria-label="Your gift collection">
    <div className="gift-shelf-heading"><div><p className="gift-eyebrow">GIVE SOMETHING GOOD</p><h3>NFT gifts</h3></div><span>{gifts.length} collected</span></div>
    {loading ? <p className="gift-status" role="status">Loading your collection…</p> : error ? <div className="gift-error" role="alert">{error}<button type="button" className="gift-secondary" onClick={()=>setRevision(n=>n+1)}>Try again</button></div> : gifts.length ? <div className="gift-shelf-items">{gifts.map((item,index)=>{const info=GIFT_BY_ID[item.gift];return <button type="button" key={item._id || `${item.gift}-${index}`} onClick={()=>{setPreview(item);setConvertError('');setConfirm(false);}} aria-label={`View owned ${info?.name || item.gift}`}><GiftIcon icon={info?.icon}/><strong>{info?.name || item.gift}</strong><small>{formatGiftPrice(Number(item.price)||0)} TPG · recorded price</small></button>;})}</div> : <div className="gift-shelf-empty"><div aria-hidden="true">{['saturn_silk','royal_crown','cloud_bunny'].map(id=><GiftIcon key={id} gift={GIFT_BY_ID[id]}/>)}</div><p>Your collection starts with a little joy.<br/>Keep a favourite, or make someone’s day.</p></div>}
    {notice && <p role="status" className="gift-success">{notice}</p>}
    <button type="button" className="gift-primary" onClick={()=>setOpen(true)}>Explore {NFT_GIFTS.length} gifts <span aria-hidden="true">↗</span></button><p className="gift-muted">Original artwork. Thoughtful little gestures.</p>
    <GiftShopPopup open={open} onClose={()=>setOpen(false)} accountId={accountId}/>
    {preview && <GiftDialog title="Your collectible" onClose={closePreview} busy={busy}><div className="gift-scroll">
      {details && !confirm && <GiftInspection gift={details}/>}
      <div className="gift-inventory-meta"><p className="gift-eyebrow">{details?.collection || 'Your collection'}</p><h3>{confirm?'Convert this gift?':details?.name || preview.gift}</h3>
        {confirm ? <><p className="gift-muted">This permanently removes this gift from your collection. The server determines the TPG conversion amount; the catalog price is not a refund quote.</p><div className="gift-order-form">{convertError && <p role="alert" className="gift-error">{convertError}</p>}<button type="button" className="gift-primary" disabled={busy||Boolean(convertError)} onClick={convert}>{busy?'Converting…':'Confirm conversion'}</button><button type="button" className="gift-secondary" disabled={busy} onClick={()=>{setConfirm(false);setConvertError('');}}>Keep my gift</button></div></> : <><p className="gift-muted">In-app collectible. A token ID alone does not confirm on-chain ownership.</p><div className="gift-order-form"><button type="button" className="gift-secondary" disabled={!preview._id} onClick={()=>setConfirm(true)}>Convert gift</button></div></>}
      </div>
    </div></GiftDialog>}
  </section>;
}
