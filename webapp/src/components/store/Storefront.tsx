import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownUp, ArrowLeft, ArrowRight, Check, ChevronDown, Gamepad2, Grid2X2, Loader2, Minus, Plus, RefreshCw, Search, ShoppingBag, SlidersHorizontal, Sparkles, Wallet, X, Box } from 'lucide-react';
import StoreArtwork from './StoreArtwork';
import { filterItems, itemDescription, itemInfo, money, totalPrice, uniqueCart, type StoreItem } from './storeModel';
import { itemPalette, sourceImages } from './storeArtwork';
import type { StoreGame } from './storeCatalog';
import type { PurchaseResult } from './useStoreAccount';
import './storefront.css';
const MaterialPreview3D=lazy(()=>import('./MaterialPreview3D').catch(()=>({default:()=> <div className="sf-loading">3D preview could not load. The thumbnail is still available; reload the store to retry.</div>}))); 

interface Props {
  items:StoreItem[]; games:Pick<StoreGame,'slug'|'name'|'shortName'|'symbol'>[];
  game:string; onGameChange:(slug:string)=>void;
  isOwned:(item:StoreItem)=>boolean; balance:number|null; linked:boolean;
  processing:boolean; balanceError?:boolean; onRefresh:()=>void;
  onPurchase:(items:StoreItem[])=>Promise<PurchaseResult>;
  onLegacy?:()=>void; preview?:boolean;
}
function Modal({title,onClose,busy=false,children}:{title:string;onClose:()=>void;busy?:boolean;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null), closeRef=useRef(onClose);
  closeRef.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const dialog=ref.current;dialog?.showModal();
    const before=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{dialog?.close();document.body.style.overflow=before;previous?.focus?.({preventScroll:true});};
  },[]);
  return createPortal(<dialog ref={ref} className="sf-root sf-dialog" aria-label={title} onCancel={event=>{event.preventDefault();if(!busy)closeRef.current();}} onClick={event=>{if(event.target===event.currentTarget && !busy)closeRef.current();}}>
    <div className="sf-dialog-inner"><div className="sf-dialog-head"><h2>{title}</h2><button className="sf-icon-button" aria-label={`Close ${title}`} onClick={onClose} disabled={busy}><X size={20}/></button></div>{children}</div>
  </dialog>,document.body);
}
function Token({amount}:{amount:number}) {return <span className="sf-price"><span className="sf-token" aria-hidden="true">T</span>{money(amount)}<span className="sf-currency">TPG</span></span>;}
function storePreference<T>(key:string,fallback:T):T {try{return JSON.parse(window.localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}}
export default function Storefront(props:Props) {
  const {items,games,game,onGameChange,isOwned,balance,linked,processing,onRefresh,onPurchase,onLegacy,preview=false}=props;
  const [tab,setTab]=useState<'shop'|'owned'>('shop');
  const [query,setQuery]=useState(''),[category,setCategory]=useState('All');
  const [sort,setSort]=useState('featured'),[hideOwned,setHideOwned]=useState(()=>storePreference('tpg:store:hide-owned',false)===true);
  const [filtersOpen,setFiltersOpen]=useState(false),[detail,setDetail]=useState<StoreItem|null>(null);
  const [cart,setCart]=useState<StoreItem[]>([]),[cartOpen,setCartOpen]=useState(false),[notice,setNotice]=useState('');
  const [limit,setLimit]=useState(24),[show3d,setShow3d]=useState(false),[illustration,setIllustration]=useState(false);
  const [uncertain,setUncertain]=useState(false);
  const pageTop=useRef<HTMLDivElement>(null),searchRef=useRef<HTMLInputElement>(null),payingRef=useRef(false);
  const gameItems=useMemo(()=>game==='all'?items:items.filter(item=>item.slug===game),[items,game]);
  const categories=useMemo(()=>['All',...new Set(gameItems.map(item=>item.category))],[gameItems]);
  const ownedCount=useMemo(()=>new Set(items.filter(isOwned).map(item=>item.entitlementKey)).size,[items,isOwned]);
  const visible=useMemo(()=>filterItems(items,{game,category,query,sort,ownedOnly:tab==='owned',hideOwned:tab==='shop'&&hideOwned},isOwned),[items,game,category,query,sort,tab,hideOwned,isOwned]);
  const hero=useMemo(()=>gameItems.find(item=>item.type==='cueStyle' && !isOwned(item))||gameItems.find(item=>sourceImages(item).length&&!isOwned(item))||gameItems[0],[gameItems,isOwned]);
  const selectedKeys=useMemo(()=>new Set(cart.map(item=>item.entitlementKey)),[cart]);
  const subtotal=totalPrice(cart),shortfall=balance===null?0:Math.max(0,Math.round((subtotal-balance)*100)/100);
  const activeGame=games.find(g=>g.slug===game);
  useEffect(()=>{setCategory('All');setLimit(24);},[game]);
  useEffect(()=>{setLimit(24);},[query,category,sort,hideOwned,tab]);
  useEffect(()=>{setCart(previous=>previous.filter(item=>!isOwned(item)));},[isOwned]);
  useEffect(()=>{try{localStorage.setItem('tpg:store:hide-owned',JSON.stringify(hideOwned));}catch{/* Storage can be unavailable in webviews. */}},[hideOwned]);
  useEffect(()=>{setShow3d(false);setIllustration(detail?sourceImages(detail).length===0:false);},[detail?.key]);
  const add=useCallback((item:StoreItem)=>{
    if(isOwned(item))return;
    setCart(previous=>uniqueCart([...previous,item]));setNotice(`${item.displayLabel} added to your basket.`);
  },[isOwned]);
  const clearFilters=()=>{setQuery('');setCategory('All');setSort('featured');setHideOwned(false);};
  const checkout=async()=>{
    if(payingRef.current || processing || uncertain)return;
    payingRef.current=true;
    try{const result=await onPurchase(cart);setNotice(result.message);setUncertain(Boolean(result.uncertain));if(result.ok){setCart([]);setCartOpen(false);}}
    catch{setUncertain(true);setNotice('Payment result is unconfirmed. Check your wallet and inventory before trying again.');}
    finally{payingRef.current=false;}
  };
  const hasFilters=Boolean(query||category!=='All'||hideOwned);
  return <div className="sf-root sf-page" ref={pageTop}>
    {preview && <div className="sf-preview-banner">DESIGN PREVIEW <span>Sample items · base prices</span></div>}
    <header className="sf-header"><div className="sf-brand"><span className="sf-brand-mark"><ShoppingBag size={19}/></span><div><span className="sf-eyebrow">TONPLAYGRAM</span><h1>Store<span className="sf-dot">.</span></h1></div></div>
      <button className="sf-wallet" onClick={onRefresh} aria-label={linked?'Refresh TPG balance':'Check account connection'}><span className="sf-wallet-icon"><Wallet size={16}/></span><span><small>{linked?'Your balance':'Your account'}</small><strong>{linked?balance===null?'Refresh balance':`${money(balance)} TPG`:'Not linked'}</strong></span><RefreshCw size={13}/></button>
    </header>
    <div className="sf-intro"><p>A little more you. A whole new game.</p></div>
    <nav className="sf-tabs" aria-label="Store sections"><button aria-current={tab==='shop'?'page':undefined} onClick={()=>setTab('shop')}><Grid2X2 size={16}/> Discover</button><button aria-current={tab==='owned'?'page':undefined} onClick={()=>setTab('owned')}><Box size={16}/> My collection <span>{ownedCount}</span></button></nav>
    <div className="sf-controls"><div className="sf-search"><Search size={19} aria-hidden="true"/><input ref={searchRef} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find your next favorite" aria-label="Search store items"/>{query&&<button aria-label="Clear search" onClick={()=>{setQuery('');searchRef.current?.focus();}}><X size={16}/></button>}</div><button className={`sf-filter-button ${hasFilters?'sf-filter-active':''}`} onClick={()=>setFiltersOpen(true)} aria-label="Open store filters"><SlidersHorizontal size={20}/>{hasFilters&&<i/>}</button></div>
    <div className="sf-game-row"><label className="sf-game-select"><Gamepad2 size={17}/><select value={game} onChange={event=>onGameChange(event.target.value)} aria-label="Choose a game"><option value="all">All games</option>{games.map(g=><option key={g.slug} value={g.slug}>{g.name}</option>)}</select><ChevronDown size={14}/></label><span className="sf-game-hint">Make your next move yours.</span></div>
    {hero && tab==='shop' && !query && category==='All' && <section className="sf-hero" aria-label="Item spotlight"><div className="sf-hero-copy"><span className="sf-kicker"><Sparkles size={12}/> IN FOCUS</span><h2>{game==='all'?'Your game.\nYour signature.':`${activeGame?.shortName||'Your game'}.\nYour signature.`}</h2><p>{hero.displayLabel}<span>{hero.typeLabel} · {hero.gameName}</span></p><button onClick={()=>setDetail(hero)}>Explore item <ArrowRight size={15}/></button></div><div className="sf-hero-image"><StoreArtwork item={hero} hero/></div></section>}
    <div className="sf-categories" role="group" aria-label="Item categories">{categories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <div className="sf-results-head"><div><h2>{tab==='owned'?'Your collection':category==='All'?'Find your finishing touch':category}</h2><span role="status">{visible.length} {visible.length===1?'item':'items'}{activeGame?` · ${activeGame.shortName}`:''}</span></div><label className="sf-sort"><ArrowDownUp size={14}/><select aria-label="Sort items" value={sort} onChange={event=>setSort(event.target.value)}><option value="featured">Catalog order</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A–Z</option></select><ChevronDown size={12}/></label></div>
    {props.balanceError&&<div className="sf-inline-note">Your balance could not be loaded. <button onClick={onRefresh}>Try again</button></div>}
    {visible.length ? <div className="sf-grid">{visible.slice(0,limit).map(item=>{
      const owned=isOwned(item),inCart=selectedKeys.has(item.entitlementKey),description=itemDescription(item);
      return <article key={item.key} className={`sf-card ${owned?'sf-card-owned':''}`}><button className="sf-card-image" aria-label={`View ${item.displayLabel}`} onClick={()=>setDetail(item)}><StoreArtwork item={item}/>{owned&&<span className="sf-owned-badge"><Check size={11}/> Owned</span>}</button><div className="sf-card-body"><div className="sf-card-meta"><span>{item.gameName}</span><span>{item.typeLabel}</span></div><button className="sf-card-title" onClick={()=>setDetail(item)}>{item.displayLabel}</button><p>{description.short}</p><div className="sf-card-footer"><Token amount={item.price}/><button className={`sf-add ${owned||inCart?'sf-add-done':''}`} aria-label={owned?`${item.displayLabel} is owned`:inCart?`Remove ${item.displayLabel} from basket`:`Add ${item.displayLabel} to basket`} disabled={owned||processing} onClick={()=>inCart?setCart(prev=>prev.filter(i=>i.entitlementKey!==item.entitlementKey)):add(item)}>{owned||inCart?<Check size={17}/>:<Plus size={18}/>}</button></div></div></article>;
    })}</div>:<div className="sf-empty"><Search size={30}/><h3>{tab==='owned'&&!query?'Your collection starts here':'No items found'}</h3><p>{tab==='owned'&&!query?'Your owned items will appear here when your account inventory is available.':'Try a different name, game, or category.'}</p><button className="sf-primary" onClick={()=>{clearFilters();setTab('shop');}}>Explore the store <ArrowRight size={16}/></button></div>}
    {visible.length>limit&&<button className="sf-more" onClick={()=>setLimit(n=>n+24)}>Show more <Plus size={16}/></button>}
    <footer className="sf-footer"><span className="sf-footer-logo">TPG<span> / </span>MAKE IT YOURS</span><p>Prices shown in TPG. Review your items before paying.</p>{onLegacy && <button className="sf-text-button" onClick={onLegacy}>Creator tools <ArrowRight size={13}/></button>}{hasFilters&&<button className="sf-text-button" onClick={clearFilters}>Clear filters <X size={13}/></button>}</footer>
    {notice&&<div className="sf-notice" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={()=>setNotice('')}><X size={16}/></button></div>}
    {cart.length>0&&<div className="sf-basket-bar"><div className="sf-basket-count"><ShoppingBag size={21}/><span>{cart.length}</span></div><div><strong>{money(subtotal)} TPG</strong><small>{cart.length} {cart.length===1?'item':'items'} in your basket</small></div><button onClick={()=>setCartOpen(true)}>Review basket <ArrowRight size={17}/></button></div>}
    {filtersOpen&&<Modal title="Make it easy to find" onClose={()=>setFiltersOpen(false)}><div className="sf-modal-content sf-filter-fields"><label>Game<select value={game} onChange={event=>onGameChange(event.target.value)}><option value="all">All games</option>{games.map(g=><option key={g.slug} value={g.slug}>{g.name}</option>)}</select></label><label>Category<select value={category} onChange={event=>setCategory(event.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Sort by<select value={sort} onChange={event=>setSort(event.target.value)}><option value="featured">Catalog order</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A–Z</option></select></label><label className="sf-checkbox"><input type="checkbox" checked={hideOwned} onChange={e=>setHideOwned(e.target.checked)}/> Hide items I already own</label><div className="sf-filter-actions"><button className="sf-secondary" onClick={clearFilters}>Reset</button><button className="sf-primary" onClick={()=>setFiltersOpen(false)}>Show {visible.length} items <ArrowRight size={16}/></button></div></div></Modal>}
    {detail&&<Modal title="A closer look" onClose={()=>setDetail(null)}><div className="sf-detail-art">{show3d?<Suspense fallback={<div className="sf-loading"><Loader2 className="sf-spin"/> Loading 3D preview</div>}><MaterialPreview3D item={detail}/></Suspense>:<StoreArtwork item={detail} hero onKind={setIllustration}/>}</div><div className="sf-modal-content sf-detail-content"><div className="sf-detail-meta"><span>{detail.gameName}</span><span>{detail.typeLabel}</span></div><h3>{detail.displayLabel}</h3><p>{itemDescription(detail).full}</p><div className="sf-specs"><div><span>Made for</span><strong>{detail.gameName}</strong></div><div><span>Item type</span><strong>{itemDescription(detail).note}</strong></div><div><span>In your collection</span><strong>{isOwned(detail)?'Yes':'Not yet'}</strong></div></div>{illustration&&<div className="sf-illustration-info"><p>{itemPalette(detail).specified?'Illustrative preview uses the catalog color palette. Geometry and lighting may differ in-game.':'Shape illustration only. The catalog does not specify a color palette for this item.'}</p>{!['environment','character','outfit','theme','training','snake','material','board','domino','cards','dice'].includes(itemInfo(detail).kind)&&<button className="sf-secondary" onClick={()=>setShow3d(v=>!v)}><Box size={16}/>{show3d?'Show thumbnail':'View material in 3D'}</button>}</div>}<div className="sf-detail-buy"><Token amount={detail.price}/><button className="sf-primary" disabled={isOwned(detail)||processing} onClick={()=>{if(!selectedKeys.has(detail.entitlementKey))add(detail);setDetail(null);setCartOpen(true);}}>{isOwned(detail)?<><Check size={17}/> In your collection</>:selectedKeys.has(detail.entitlementKey)?<>Review basket <ArrowRight size={16}/></>:<>Add to basket <Plus size={17}/></>}</button></div></div></Modal>}
    {cartOpen&&<Modal title="Review your basket" onClose={()=>setCartOpen(false)} busy={processing}><div className="sf-modal-content"><p className="sf-cart-intro">Check your items and total. Nothing is charged until you confirm.</p>{cart.length?cart.map(item=><div key={item.entitlementKey} className="sf-cart-item"><StoreArtwork item={item}/><div><strong>{item.displayLabel}</strong><small>{item.gameName}</small><Token amount={item.price}/></div><button className="sf-icon-button" aria-label={`Remove ${item.displayLabel}`} disabled={processing} onClick={()=>setCart(prev=>prev.filter(i=>i.entitlementKey!==item.entitlementKey))}><X size={17}/></button></div>):<p>Your basket is empty.</p>}<div className="sf-cart-totals"><div><span>Your balance</span><strong>{balance===null?'Unavailable':`${money(balance)} TPG`}</strong></div><div><span>Total</span><strong>{money(subtotal)} TPG</strong></div>{balance!==null&&<div><span>Balance after purchase</span><strong>{money(balance-subtotal)} TPG</strong></div>}</div>{!linked&&<p className="sf-inline-note">Link your account in the app before purchasing.</p>}{shortfall>0&&<p className="sf-inline-note">You need {money(shortfall)} more TPG.</p>}{balance===null&&linked&&<button className="sf-secondary" onClick={onRefresh}><RefreshCw size={15}/> Refresh balance</button>}{uncertain&&<p className="sf-inline-note" role="alert">Check your wallet and inventory for the previous payment before trying again.</p>}{notice&&<p className="sf-cart-status" role="status">{notice}</p>}<button className="sf-primary sf-checkout" disabled={preview||!linked||balance===null||shortfall>0||processing||!cart.length||uncertain} onClick={()=>void checkout()}>{processing?<><Loader2 size={17} className="sf-spin"/> Processing payment…</>:preview?'Preview only · payments disabled':<>Confirm {money(subtotal)} TPG <ArrowRight size={17}/></>}</button><p className="sf-fine-print">{preview?'This preview cannot connect to your wallet or make purchases.':'Payment uses your existing TPG account balance. No TON transfer is requested.'}</p></div></Modal>}
  </div>;
}
