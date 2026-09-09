import { lazy, Suspense } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import Storefront from '../components/store/Storefront';
import { STORE_GAMES, STORE_ITEMS } from '../components/store/storeCatalog';
import { useStoreAccount } from '../components/store/useStoreAccount';
// Existing creator listings and custom-HDRI workflows are preserved rather than reimplemented.
const LegacyStore=lazy(()=>import('./StoreLegacy.jsx'));
function NewStore() {
  useTelegramBackButton();
  const navigate=useNavigate(),{gameSlug}=useParams();
  const account=useStoreAccount();
  const game=STORE_GAMES.some(entry=>entry.slug===gameSlug)?gameSlug!:'all';
  return <Storefront key={account.accountId||'guest'} items={STORE_ITEMS} games={STORE_GAMES} game={game}
    onGameChange={slug=>navigate(`/store/${slug}`)} isOwned={account.isOwned}
    balance={account.balance} linked={account.linked} processing={account.processing}
    balanceError={account.balanceError} onRefresh={()=>void account.refresh()}
    onPurchase={account.purchase} onLegacy={()=>navigate(`/store/${game}?view=creator`)}/>;
}
export default function StoreRedesign() {
  const [params,setParams]=useSearchParams();
  if(params.get('view')==='creator')return <><button type="button" className="sf-root sf-secondary" style={{margin:16}} onClick={()=>setParams({})}>← Back to redesigned store</button><Suspense fallback={<p role="status">Loading creator tools…</p>}><LegacyStore/></Suspense></>;
  return <NewStore/>;
}
