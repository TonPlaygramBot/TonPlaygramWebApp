import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { NFT_GIFTS, GIFT_BY_ID, GIFT_COLLECTIONS, GIFT_TIER_LABELS, filterGifts } from '../../utils/nftGifts.js';
import { sendGift } from '../../utils/api.js';
import GiftIcon from '../GiftIcon.jsx';
import GiftDialog from './GiftDialog.jsx';
import { createGiftCheckout, formatGiftPrice } from './giftCheckout.js';
const GiftViewer = lazy(() => import('./GiftViewer.tsx'));
class ViewerBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="gift-status" role="status">3D could not load. The gift artwork is still available.</p> : this.props.children; }
}
export function GiftInspection({ gift }) {
  const [view3d, setView3d] = useState(false);
  return <div className="gift-inspection" style={{ '--gift-color': gift.color, '--gift-accent': gift.accent }}>
    {view3d ? <ViewerBoundary key={gift.id}><Suspense fallback={<div className="gift-detail-art"><GiftIcon gift={gift} alt={gift.name}/><span className="gift-muted" role="status">Loading 3D…</span></div>}><GiftViewer gift={gift}/></Suspense></ViewerBoundary> : <div className="gift-detail-art"><GiftIcon gift={gift} alt={gift.name}/></div>}
    <button type="button" className="gift-view-toggle" aria-pressed={view3d} onClick={() => setView3d(v => !v)}>{view3d ? '◈ Artwork' : '◈ Explore in 3D'}</button>
  </div>;
}
export default function GiftExperience({ accountId = '', resolveAccount, players, onClose, onCompleted, title = 'Gift atelier' }) {
  const gameMode = Array.isArray(players);
  const validPlayers = (players || []).filter(p => p && p.id);
  const [receiver, setReceiver] = useState('');
  const [playerId, setPlayerId] = useState(String(validPlayers[0]?.id || ''));
  const [search, setSearch] = useState(''), [collection, setCollection] = useState('All'), [tier, setTier] = useState('All'), [sort, setSort] = useState('featured');
  const [limit, setLimit] = useState(24), [selectedId, setSelectedId] = useState(null), [stage, setStage] = useState('browse');
  const [order, setOrder] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const scroll = useRef(null), savedScroll = useRef(0), heading = useRef(null), busyRef = useRef(false), completed = useRef(null), mounted = useRef(true);
  const checkout = useRef(createGiftCheckout(sendGift));
  const gift = selectedId ? GIFT_BY_ID[selectedId] : null;
  const filtered = useMemo(() => filterGifts({ search, collection, tier, sort }), [search, collection, tier, sort]);
  useEffect(() => { setLimit(24); }, [search, collection, tier, sort]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const playerKey = validPlayers.map(p => String(p.id)).join('|');
  useEffect(() => { if (gameMode && !validPlayers.some(p => String(p.id) === playerId)) setPlayerId(String(validPlayers[0]?.id || '')); }, [playerKey, gameMode, playerId]);
  useEffect(() => { if (stage !== 'browse') { scroll.current?.scrollTo(0, 0); heading.current?.focus(); } }, [stage, selectedId]);
  const finish = () => {
    if (busyRef.current) return;
    const sent = completed.current; completed.current = null;
    onClose?.();
    if (sent) onCompleted?.(sent);
  };
  const selectGift = selected => { savedScroll.current = scroll.current?.scrollTop || 0; setError(''); setSelectedId(selected.id); setStage('detail'); };
  const back = () => { setError(''); setStage('browse'); setSelectedId(null); requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = savedScroll.current; }); };
  const review = event => {
    event.preventDefault(); setError('');
    const recipient = gameMode ? validPlayers.find(p => String(p.id) === playerId) : null;
    if (gameMode && !recipient) { setError('Select an available player first.'); return; }
    const toAccount = gameMode ? String(recipient.id) : receiver.trim() || String(accountId).trim();
    if (!toAccount) { setError('Sign in before buying a gift.'); return; }
    setOrder({ giftId: gift.id, toAccount, recipientName: gameMode ? recipient.name || String(recipient.id) : receiver.trim() && receiver.trim() !== String(accountId).trim() ? receiver.trim() : 'Your collection', playerIndex: recipient?.index });
    setStage('confirm');
  };
  const purchase = async () => {
    if (busyRef.current || !order) return;
    busyRef.current = true; setBusy(true); setError('');
    const snapshot = order;
    try {
      if (gameMode && !validPlayers.some(p => String(p.id) === snapshot.toAccount)) throw new Error('That player is no longer available. Choose another recipient.');
      const from = String(accountId || (resolveAccount ? await resolveAccount() : '') || '').trim();
      const response = await checkout.current({ fromAccount: from, toAccount: snapshot.toAccount, giftId: snapshot.giftId });
      if (response.ignored) return;
      completed.current = { gift: GIFT_BY_ID[snapshot.giftId], recipient: snapshot.toAccount, recipientName: snapshot.recipientName, playerIndex: snapshot.playerIndex, result: response.result };
      window.dispatchEvent(new CustomEvent('tpg:gifts-updated', { detail: { accountId: from } }));
      if (mounted.current) setStage('success');
    } catch (err) {
      if (mounted.current) setError(err?.message || 'Delivery could not be confirmed. Check your inventory and balance before trying again.');
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };
  const resetFilters = () => { setSearch(''); setCollection('All'); setTier('All'); setSort('featured'); };
  return <GiftDialog title={title} onClose={finish} busy={busy}>
    <div ref={scroll} className="gift-scroll">
      {stage === 'browse' ? <>
        <section className="gift-hero"><div><p className="gift-eyebrow">THE COLLECTIBLE EDIT</p><h1>Small gifts.<br/><em>Big energy.</em></h1><p>Find their next favourite.<br/>{NFT_GIFTS.length} designs, made to be given.</p><span className="gift-count-pill">✧ 72 new designs</span></div><div className="gift-hero-art" aria-hidden="true"><GiftIcon gift={GIFT_BY_ID.royal_crown} className="gift-hero-crown"/><GiftIcon gift={GIFT_BY_ID.saturn_silk} className="gift-hero-planet"/><GiftIcon gift={GIFT_BY_ID.butterfly_kiss} className="gift-hero-butterfly"/></div></section>
        <div className="gift-toolbar"><label className="gift-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search gifts" placeholder="Find a gift, a feeling, a collection…" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>×</button>}</label>
          <div className="gift-collections" role="group" aria-label="Gift collections">{['All', ...GIFT_COLLECTIONS].map(item => <button key={item} type="button" aria-pressed={collection === item} className={collection === item ? 'is-active' : ''} onClick={() => setCollection(item)}>{item}</button>)}</div>
          <div className="gift-filter-row"><label><span className="gift-sr-only">Filter by tier</span><select value={tier} onChange={e => setTier(e.target.value)} aria-label="Gift tier"><option value="All">All tiers</option>{[1,2,3].map(t => <option key={t} value={t}>{GIFT_TIER_LABELS[t]}</option>)}</select></label><label><span className="gift-sr-only">Sort gifts</span><select aria-label="Sort gifts" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">New arrivals</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name: A–Z</option></select></label></div>
        </div>
        <div className="gift-section-label"><h3>{collection === 'All' ? 'Find your favourite' : collection}</h3><span role="status" aria-live="polite">{filtered.length} gifts</span></div>
        {filtered.length ? <div className="gift-grid">{filtered.slice(0, limit).map(item => <button type="button" key={item.id} className="gift-tile" onClick={() => selectGift(item)} aria-label={`View ${item.name}, ${formatGiftPrice(item.price)} TPG`}>
          <div className="gift-tile-art" style={{ '--gift-color': item.color, '--gift-accent': item.accent }}><span className="gift-tile-tier">{GIFT_TIER_LABELS[item.tier]}</span><GiftIcon gift={item}/>{item.isNew && <span className="gift-new">NEW</span>}</div><div className="gift-tile-meta"><span className="gift-tile-collection">{item.collection}</span><h4>{item.name}</h4><div className="gift-tile-bottom"><span><i aria-hidden="true">◈</i> {formatGiftPrice(item.price)} <small>TPG</small></span><b aria-hidden="true">↗</b></div></div>
        </button>)}</div> : <div className="gift-empty"><span aria-hidden="true">⌕</span><h3>No gifts found</h3><p>Try a different name or clear your filters.</p><button type="button" className="gift-secondary" onClick={resetFilters}>Clear filters</button></div>}
        {filtered.length > limit && <button type="button" className="gift-load-more" onClick={() => setLimit(n => n + 24)}>Show {Math.min(24, filtered.length - limit)} more gifts <span aria-hidden="true">↓</span></button>}
        <p className="gift-disclosure">Prices are in TPG. Collection tiers are design labels, not scarcity claims. Gifts are in-app collectibles; on-chain status depends on the configured mint provider.</p>
      </> : gift && <>
        {stage === 'detail' && <button type="button" className="gift-back" onClick={back}>← All gifts</button>}
        {stage === 'detail' && <GiftInspection key={gift.id} gift={gift}/>}
        {(stage === 'confirm' || stage === 'success') && <div className="gift-confirm-art"><GiftIcon gift={gift} alt={gift.name}/></div>}
        <div className="gift-detail-copy"><p className="gift-eyebrow">{gift.collection} / {GIFT_TIER_LABELS[gift.tier]}</p><h1 ref={heading} tabIndex={-1}>{stage === 'success' ? 'A little joy, delivered.' : stage === 'confirm' ? 'Make it theirs.' : gift.name}</h1>
          {stage === 'detail' && <p className="gift-muted">An original {gift.collection.toLowerCase()} collectible. A small way to make someone’s day.</p>}
        </div>
        {stage === 'detail' && <form onSubmit={review} className="gift-order-form"><div className="gift-price-row"><span>Gift price</span><strong>◈ {formatGiftPrice(gift.price)} <small>TPG</small></strong></div>
          {gameMode ? <label>Send to<select aria-label="Gift recipient" value={playerId} onChange={e => setPlayerId(e.target.value)}>{!validPlayers.length && <option value="">No available players</option>}{validPlayers.map(p => <option key={`${p.id}-${p.index}`} value={String(p.id)}>{p.name || p.id}</option>)}</select></label> : <label>Recipient account <span className="gift-muted">(optional)</span><input type="text" value={receiver} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={128} onChange={e => setReceiver(e.target.value)} placeholder="Leave empty to keep this gift"/></label>}
          {!gameMode && !accountId && <p className="gift-status">Sign in to buy or send gifts. You can still browse the collection.</p>}
          {error && <p className="gift-error" role="alert">{error}</p>}
          <button type="submit" className="gift-primary" disabled={gameMode ? !validPlayers.length : !accountId}>Review gift <span aria-hidden="true">→</span></button><p className="gift-disclosure">You will review the recipient and total before spending TPG.</p>
        </form>}
        {stage === 'confirm' && <div className="gift-order-form"><dl className="gift-order-summary"><div><dt>Gift</dt><dd>{gift.name}</dd></div><div><dt>To</dt><dd>{order?.recipientName}</dd></div><div><dt>Total</dt><dd>{formatGiftPrice(gift.price)} TPG</dd></div></dl>
          {error && <p className="gift-error" role="alert">{error}</p>}
          <button type="button" className="gift-primary" onClick={purchase} disabled={busy || Boolean(error)}>{busy ? 'Sending gift…' : `Confirm · ${formatGiftPrice(gift.price)} TPG`}</button><button type="button" className="gift-secondary" disabled={busy} onClick={() => {setStage('detail');setError('');}}>Back to gift</button><p className="gift-disclosure">Confirming spends TPG. Please check the recipient carefully.</p>
        </div>}
        {stage === 'success' && <div className="gift-order-form"><p className="gift-success" role="status">{gift.name} was delivered to {order?.recipientName}.</p><button type="button" className="gift-primary" onClick={finish}>Done <span aria-hidden="true">✓</span></button></div>}
      </>}
    </div>
  </GiftDialog>;
}
