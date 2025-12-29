import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createAccount, getAccountInfo } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { loadGoogleProfile } from '../utils/google.js';
import {
  getPoolRoyalInventory,
  listOwnedPoolRoyalOptions
} from '../utils/poolRoyalInventory.js';
import {
  getDominoRoyalInventory,
  listOwnedDominoOptions
} from '../utils/dominoRoyalInventory.js';
import { POOL_ROYALE_DEFAULT_LOADOUT } from '../config/poolRoyaleInventoryConfig.js';
import { DOMINO_ROYAL_DEFAULT_LOADOUT } from '../config/dominoRoyalInventoryConfig.js';
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
  if (!telegramId && !googleProfile?.id) return <LoginOptions onAuthenticated={setGoogleProfile} />;

  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  const [poolNfts, setPoolNfts] = useState([]);
  const [dominoNfts, setDominoNfts] = useState([]);
  const [giftNfts, setGiftNfts] = useState([]);
  const [error, setError] = useState('');

  const defaultPoolSet = useMemo(() => buildDefaultSet(POOL_ROYALE_DEFAULT_LOADOUT), []);
  const defaultDominoSet = useMemo(() => buildDefaultSet(DOMINO_ROYAL_DEFAULT_LOADOUT), []);

  useEffect(() => {
    async function loadNfts() {
      setLoading(true);
      setError('');
      try {
        const acc = await createAccount(telegramId, googleProfile);
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
        const ownedPool = listOwnedPoolRoyalOptions(poolInventory).filter(
          (item) => !defaultPoolSet.has(`${item.type}:${item.optionId}`)
        );
        setPoolNfts(ownedPool);

        const dominoInventory = getDominoRoyalInventory(acc.accountId);
        const ownedDomino = listOwnedDominoOptions(dominoInventory).filter(
          (item) => !defaultDominoSet.has(`${item.type}:${item.optionId}`)
        );
        setDominoNfts(ownedDomino);

        const info = await getAccountInfo(acc.accountId);
        const ownedGifts = Array.isArray(info?.gifts)
          ? info.gifts.map((gift) => {
              const details = NFT_GIFTS.find((g) => g.id === gift.gift) || {};
              return {
                id: gift._id || `${gift.gift}-${gift.price}`,
                name: details.name || gift.gift,
                price: gift.price,
                icon: details.icon,
                tier: details.tier
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
  }, [telegramId, googleProfile?.id, defaultPoolSet, defaultDominoSet]);

  const renderList = (items, emptyText) =>
    items.length ? (
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={`${item.type || item.id}-${item.optionId || item.name}`}
            className="flex items-center justify-between rounded-lg border border-border px-3 py-2 bg-surface/60"
          >
            <span className="font-medium">{item.label || item.name}</span>
            {item.type && (
              <span className="text-[11px] uppercase text-subtext">
                {item.type.replace(/([A-Z])/g, ' $1')}
              </span>
            )}
            {item.price != null && !item.type && (
              <span className="text-xs text-subtext">{item.price} TPC</span>
            )}
          </div>
        ))}
      </div>
    ) : (
      <p className="text-sm text-subtext">{emptyText}</p>
    );

  return (
    <div className="relative p-4 space-y-4 text-text wide-card">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">My NFTs</h2>
          <p className="text-sm text-subtext">
            Only purchased or gifted NFTs are shown. Starter cosmetics stay hidden.
          </p>
        </div>
        <Link
          to="/account"
          className="text-sm px-3 py-1 rounded bg-primary hover:bg-primary-hover text-background font-semibold"
        >
          Back to Profile
        </Link>
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

      {loading ? (
        <div className="p-4 text-subtext">Loading NFTs…</div>
      ) : (
        <>
          <div className="prism-box p-4 space-y-2 mx-auto wide-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pool Royale</h3>
              <span className="text-xs text-subtext">Cosmetic NFTs</span>
            </div>
            {renderList(poolNfts, 'No Pool Royale NFTs yet.')}
          </div>

          <div className="prism-box p-4 space-y-2 mx-auto wide-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Domino Royal</h3>
              <span className="text-xs text-subtext">Cosmetic NFTs</span>
            </div>
            {renderList(dominoNfts, 'No Domino Royal NFTs yet.')}
          </div>

          <div className="prism-box p-4 space-y-2 mx-auto wide-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Gift NFTs</h3>
              <span className="text-xs text-subtext">Sent or received</span>
            </div>
            {giftNfts.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {giftNfts.map((gift) => (
                  <div
                    key={gift.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 bg-surface/60"
                  >
                    <div className="flex items-center space-x-2">
                      {gift.icon && <GiftIcon icon={gift.icon} className="w-8 h-8" />}
                      <span className="font-medium">{gift.name}</span>
                    </div>
                    {gift.price != null && (
                      <span className="text-xs text-subtext whitespace-nowrap">{gift.price} TPC</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-subtext">No NFT gifts yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
