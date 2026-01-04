import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createAccount, getAccountInfo } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { loadGoogleProfile } from '../utils/google.js';
import { useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import {
  getPoolRoyalInventory,
  listOwnedPoolRoyalOptions
} from '../utils/poolRoyalInventory.js';
import {
  getDominoRoyalInventory,
  listOwnedDominoOptions
} from '../utils/dominoRoyalInventory.js';
import { POOL_ROYALE_DEFAULT_LOADOUT } from '../config/poolRoyaleInventoryConfig.js';
import {
  DOMINO_ROYAL_DEFAULT_LOADOUT,
  DOMINO_ROYAL_STORE_ITEMS,
  DOMINO_ROYAL_OPTION_SETS
} from '../config/dominoRoyalInventoryConfig.js';
import {
  POOL_ROYALE_STORE_ITEMS
} from '../config/poolRoyaleInventoryConfig.js';
import { NFT_GIFTS } from '../utils/nftGifts.js';
import GiftIcon from '../components/GiftIcon.jsx';

const buildDefaultSet = (loadout = []) =>
  new Set(loadout.map((item) => `${item.type}:${item.optionId}`));

export default function Nfts() {
  let telegramId = null;

  try {
    telegramId = getTelegramId();
  } catch {}

  const [googleProfile, setGoogleProfile] = useState(() => (telegramId ? null : loadGoogleProfile()));
  const tonAddress = useTonAddress(true);
  const tonWallet = useTonWallet();
  if (!telegramId && !googleProfile?.id && !tonAddress) return <LoginOptions onAuthenticated={setGoogleProfile} />;

  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  const [poolNfts, setPoolNfts] = useState([]);
  const [dominoNfts, setDominoNfts] = useState([]);
  const [giftNfts, setGiftNfts] = useState([]);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionTone, setActionTone] = useState('info');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('name-asc');

  const defaultPoolSet = useMemo(() => buildDefaultSet(POOL_ROYALE_DEFAULT_LOADOUT), []);
  const defaultDominoSet = useMemo(() => buildDefaultSet(DOMINO_ROYAL_DEFAULT_LOADOUT), []);
  const poolPriceIndex = useMemo(() => {
    const map = new Map();
    POOL_ROYALE_STORE_ITEMS.forEach((item) => {
      map.set(`${item.type}:${item.optionId}`, Number(item.price) || 0);
    });
    return map;
  }, []);
  const dominoPriceIndex = useMemo(() => {
    const map = new Map();
    DOMINO_ROYAL_STORE_ITEMS.forEach((item) => {
      map.set(`${item.type}:${item.optionId}`, Number(item.price) || 0);
    });
    Object.entries(DOMINO_ROYAL_OPTION_SETS).forEach(([type, options]) => {
      options.forEach((option) => {
        if (!map.has(`${type}:${option.id}`)) {
          map.set(`${type}:${option.id}`, Number(option.price) || 0);
        }
      });
    });
    return map;
  }, []);

  useEffect(() => {
    async function loadNfts() {
      setLoading(true);
      setError('');
      try {
        const acc = await createAccount(telegramId, googleProfile, undefined, {
          address: tonAddress || undefined,
          publicKey: tonWallet?.account?.publicKey
        });
        if (acc?.error || !acc?.accountId) {
          setError(acc?.error || 'Unable to load NFTs right now.');
          return;
        }
        setAccountId(acc.accountId);
        localStorage.setItem('accountId', acc.accountId);
        if (acc.walletAddress) {
          localStorage.setItem('walletAddress', acc.walletAddress);
        }

        const poolInventory = await getPoolRoyalInventory(acc.accountId);
        const ownedPool = listOwnedPoolRoyalOptions(poolInventory).map((item) => {
          const priceKey = `${item.type}:${item.optionId}`;
          return {
            ...item,
            isDefault: defaultPoolSet.has(priceKey),
            thumbnail: '/assets/icons/pool-royale.svg',
            price: poolPriceIndex.get(priceKey) ?? 0
          };
        });
        setPoolNfts(ownedPool);

        const dominoInventory = getDominoRoyalInventory(acc.accountId);
        const ownedDomino = listOwnedDominoOptions(dominoInventory).map((item) => {
          const priceKey = `${item.type}:${item.optionId}`;
          return {
            ...item,
            isDefault: defaultDominoSet.has(priceKey),
            thumbnail: '/assets/icons/domino-royal.svg',
            price: dominoPriceIndex.get(priceKey) ?? 0
          };
        });
        setDominoNfts(ownedDomino);

        const info = await getAccountInfo(acc.accountId);
        const ownedGifts = Array.isArray(info?.gifts)
          ? info.gifts.map((gift) => {
              const details = NFT_GIFTS.find((g) => g.id === gift.gift) || {};
              return {
                id: gift._id || `${gift.gift}-${gift.price}`,
                name: details.name || gift.gift,
                price: gift.price ?? 0,
                icon: details.icon,
                tier: details.tier,
                isDefault: false
              };
            })
          : [];
        setGiftNfts(ownedGifts);
      } catch (err) {
        console.error('Failed to load NFTs', err);
        setError('Unable to load NFTs right now.');
      } finally {
        setLoading(false);
      }
    }

    loadNfts();
  }, [
    telegramId,
    googleProfile?.id,
    defaultPoolSet,
    defaultDominoSet,
    poolPriceIndex,
    dominoPriceIndex,
    tonAddress,
    tonWallet?.account?.publicKey
  ]);

  const handleAction = (action, item) => {
    if (item.isDefault) {
      setActionTone('warning');
      setActionMessage('Default NFTs stay in your wallet and cannot be sent, converted, or burned.');
      return;
    }
    const verb = action === 'send' ? 'Send' : action === 'convert' ? 'Convert' : 'Burn';
    setActionTone('info');
    setActionMessage(`${verb} for ${item.label || item.name} is coming soon. Thanks for your patience!`);
  };

  const applyFilters = (items = []) => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? items.filter((item) => {
          const haystack = `${item.label || item.name || ''} ${item.type || ''}`.toLowerCase();
          return haystack.includes(term);
        })
      : items;
    const sorted = [...filtered].sort((a, b) => {
      const nameA = (a.label || a.name || '').toLowerCase();
      const nameB = (b.label || b.name || '').toLowerCase();
      const priceA = Number(a.price) || 0;
      const priceB = Number(b.price) || 0;
      switch (sortKey) {
        case 'price-asc':
          return priceA - priceB;
        case 'price-desc':
          return priceB - priceA;
        case 'name-desc':
          return nameB.localeCompare(nameA);
        default:
          return nameA.localeCompare(nameB);
      }
    });
    return sorted;
  };

  const renderThumbnail = (item, fallbackIcon) => {
    const priceLabel = item.isDefault || Number(item.price) === 0 ? 'Free' : `${item.price} TPC`;
    let content = null;
    if (item.icon) {
      content = <GiftIcon icon={item.icon} className="w-10 h-10" />;
    } else if (item.thumbnail) {
      content = (
        <img
          src={item.thumbnail}
          alt={item.label || item.name}
          className="w-12 h-12 object-contain drop-shadow"
          loading="lazy"
        />
      );
    } else if (fallbackIcon) {
      content = (
        <img
          src={fallbackIcon}
          alt="NFT thumbnail"
          className="w-12 h-12 object-contain drop-shadow"
          loading="lazy"
        />
      );
    } else {
      const initial = (item.label || item.name || '?').charAt(0).toUpperCase();
      content = <span className="text-lg font-bold text-white">{initial}</span>;
    }
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {content}
        <span className="absolute -bottom-1 right-0 rounded bg-black/70 text-[10px] text-white px-1 py-[2px] border border-border">
          {priceLabel}
        </span>
      </div>
    );
  };

  const renderNftGrid = (items, emptyText, fallbackThumbnail) =>
    items.length ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => {
          const disabled = item.isDefault;
          return (
            <div
              key={`${item.type || item.id}-${item.optionId || item.name}`}
              className="rounded-xl border border-border bg-surface/60 p-3 space-y-3 shadow-sm"
            >
              <div className="flex gap-3">
                <div className="relative w-14 h-14 rounded-lg border border-border bg-background/60 flex items-center justify-center overflow-hidden">
                  {renderThumbnail(item, fallbackThumbnail)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="font-semibold leading-tight text-white">{item.label || item.name}</p>
                  <p className="text-xs text-subtext">
                    {item.type ? item.type.replace(/([A-Z])/g, ' $1') : 'Gift NFT'}
                  </p>
                  {item.price != null && (
                    <p className="text-[11px] text-subtext">
                      {item.isDefault || Number(item.price) === 0 ? 'Free' : `${item.price} TPC`}
                    </p>
                  )}
                  {item.isDefault && (
                    <span className="inline-flex items-center rounded-full bg-background px-2 py-[2px] text-[11px] text-amber-200 border border-amber-400/30">
                      Default cosmetic
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['send', 'convert', 'burn'].map((action) => (
                  <button
                    key={action}
                    onClick={() => handleAction(action, item)}
                    disabled={disabled}
                    className={`text-sm rounded border px-2 py-2 font-semibold transition ${
                      disabled
                        ? 'opacity-50 cursor-not-allowed border-border text-subtext'
                        : 'border-primary/60 bg-primary/10 text-white hover:bg-primary/20'
                    }`}
                  >
                    {action === 'send' ? 'Send' : action === 'convert' ? 'Convert' : 'Burn'}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <p className="text-sm text-subtext">{emptyText}</p>
    );

  const filteredPool = applyFilters(poolNfts);
  const filteredDomino = applyFilters(dominoNfts);
  const filteredGifts = applyFilters(giftNfts);

  return (
    <div className="relative p-4 space-y-4 text-text wide-card">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">My NFTs</h2>
          <p className="text-sm text-subtext">
            View every cosmetic and gift you own. Default items stay locked from transfers but visible here.
          </p>
        </div>
        <Link
          to="/account"
          className="text-sm px-3 py-1 rounded bg-primary hover:bg-primary-hover text-background font-semibold"
        >
          Back to Profile
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search NFTs by name or category"
          className="w-full sm:w-72 border border-border rounded px-3 py-2 bg-background/80 text-sm text-white"
        />
        <label className="text-sm text-subtext flex items-center gap-2">
          Sort:
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="border border-border rounded px-2 py-1 bg-background/80 text-white text-sm"
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="price-asc">Price (Low to High)</option>
            <option value="price-desc">Price (High to Low)</option>
          </select>
        </label>
      </div>

      {accountId && (
        <div className="text-xs text-subtext">
          Account ID: <span className="text-white-shadow font-semibold">{accountId}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg border border-red-500 bg-red-500/10 text-sm text-red-200">
          {error}
        </div>
      )}
      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-sm ${
            actionTone === 'warning'
              ? 'border border-amber-400 bg-amber-500/10 text-amber-100'
              : 'border border-primary bg-primary/10 text-white'
          }`}
        >
          {actionMessage}
        </div>
      )}

      {loading ? (
        <div className="p-4 text-subtext">Loading NFTs…</div>
      ) : (
        <>
          <div className="prism-box p-4 space-y-2 mx-auto wide-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pool Royale</h3>
              <span className="text-xs text-subtext">Cosmetic NFTs</span>
            </div>
            {renderNftGrid(filteredPool, 'No Pool Royale NFTs yet.', '/assets/icons/pool-royale.svg')}
          </div>

          <div className="prism-box p-4 space-y-2 mx-auto wide-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Domino Royal</h3>
              <span className="text-xs text-subtext">Cosmetic NFTs</span>
            </div>
            {renderNftGrid(filteredDomino, 'No Domino Royal NFTs yet.', '/assets/icons/domino-royal.svg')}
          </div>

          <div className="prism-box p-4 space-y-2 mx-auto wide-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Gift NFTs</h3>
              <span className="text-xs text-subtext">Sent or received</span>
            </div>
            {renderNftGrid(filteredGifts, 'No NFT gifts yet.', '/assets/icons/pool-royale.svg')}
          </div>
        </>
      )}
    </div>
  );
}
