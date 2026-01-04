import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createAccount, getAccountInfo } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { loadGoogleProfile } from '../utils/google.js';
import InfoPopup from '../components/InfoPopup.jsx';
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
import { Gift, Package, Sparkles } from 'lucide-react';

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
  const [actionTitle, setActionTitle] = useState('');
  const [actionInfo, setActionInfo] = useState('');

  const defaultPoolSet = useMemo(() => buildDefaultSet(POOL_ROYALE_DEFAULT_LOADOUT), []);
  const defaultDominoSet = useMemo(() => buildDefaultSet(DOMINO_ROYAL_DEFAULT_LOADOUT), []);
  const formatTypeLabel = (type) =>
    type ? type.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()) : 'NFT';
  const sortNfts = (items = []) =>
    [...items].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return 1;
      if (!a.isDefault && b.isDefault) return -1;
      return (a.title || '').localeCompare(b.title || '');
    });

  const handleAction = (item, action) => {
    if (item.isDefault) {
      setActionTitle('Default NFT locked');
      setActionInfo('Starter NFTs stay in your account and cannot be sent, converted, or burned.');
      return;
    }
    setActionTitle(`${action} ${item.title}`);
    setActionInfo(
      `We will route ${item.title} through your wallet. Sending, converting, and burning are being rolled out here, so this action will be available soon.`
    );
  };

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
        const ownedPool = listOwnedPoolRoyalOptions(poolInventory).map((item) => ({
          ...item,
          id: `${item.type}:${item.optionId}`,
          title: item.label || item.name || item.optionId,
          subtitle: formatTypeLabel(item.type),
          iconComponent: Sparkles,
          category: 'Pool Royale',
          isDefault: defaultPoolSet.has(`${item.type}:${item.optionId}`)
        }));
        setPoolNfts(sortNfts(ownedPool));

        const dominoInventory = getDominoRoyalInventory(acc.accountId);
        const ownedDomino = listOwnedDominoOptions(dominoInventory).map((item) => ({
          ...item,
          id: `${item.type}:${item.optionId}`,
          title: item.label || item.name || item.optionId,
          subtitle: formatTypeLabel(item.type),
          iconComponent: Package,
          category: 'Domino Royal',
          isDefault: defaultDominoSet.has(`${item.type}:${item.optionId}`)
        }));
        setDominoNfts(sortNfts(ownedDomino));

        const info = await getAccountInfo(acc.accountId);
        const ownedGifts = Array.isArray(info?.gifts)
          ? info.gifts.map((gift) => {
              const details = NFT_GIFTS.find((g) => g.id === gift.gift) || {};
              return {
                id: gift._id || `${gift.gift}-${gift.price}`,
                title: details.name || gift.gift,
                subtitle: gift.tier ? `Tier ${gift.tier}` : 'Gift NFT',
                price: gift.price,
                category: 'Gift',
                iconComponent: Gift,
                icon: details.icon,
                tier: details.tier,
                isDefault: false,
                thumbnail: details.icon ? <GiftIcon icon={details.icon} className="w-10 h-10" /> : null
              };
            })
          : [];
        setGiftNfts(sortNfts(ownedGifts));
      } catch (err) {
        console.error('Failed to load NFTs', err);
        setError('Unable to load NFTs right now.');
      } finally {
        setLoading(false);
      }
    }

    loadNfts();
  }, [telegramId, googleProfile?.id, defaultPoolSet, defaultDominoSet]);

  const renderList = (items, emptyText, fallbackIcon = Package) =>
    items.length ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => {
          const Icon = item.iconComponent || fallbackIcon;
          return (
            <div
              key={item.id || `${item.type || item.title}-${item.optionId || item.price}`}
              className="flex items-start gap-3 rounded-xl border border-border px-3 py-3 bg-surface/60"
            >
              <div
                className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${
                  item.isDefault ? 'from-background to-border/40' : 'from-primary/30 to-primary/70'
                } border border-border`}
              >
                {item.thumbnail || <Icon className="w-6 h-6 text-white" />}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white leading-tight">{item.title}</p>
                    <p className="text-[11px] uppercase text-subtext">{item.subtitle}</p>
                    {item.price != null && (
                      <p className="text-xs text-subtext mt-1">{item.price} TPC</p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] border ${
                      item.isDefault
                        ? 'border-border text-subtext bg-background/60'
                        : 'border-primary text-black bg-primary/80'
                    }`}
                  >
                    {item.isDefault ? 'Starter (locked)' : 'Tradable'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Send', 'Convert', 'Burn'].map((action) => (
                    <button
                      key={action}
                      onClick={() => handleAction(item, action)}
                      disabled={item.isDefault}
                      className={`px-3 py-1 rounded text-sm border ${
                        item.isDefault
                          ? 'border-border text-subtext cursor-not-allowed opacity-60'
                          : 'border-primary bg-primary text-black hover:bg-primary-hover'
                      }`}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
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
            View every cosmetic and gift you own. Starter cosmetics are locked, while tradable items show quick actions for
            sending, converting, or burning.
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
            {renderList(poolNfts, 'No Pool Royale NFTs yet.', Sparkles)}
          </div>

          <div className="prism-box p-4 space-y-2 mx-auto wide-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Domino Royal</h3>
              <span className="text-xs text-subtext">Cosmetic NFTs</span>
            </div>
            {renderList(dominoNfts, 'No Domino Royal NFTs yet.', Package)}
          </div>

          <div className="prism-box p-4 space-y-2 mx-auto wide-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Gift NFTs</h3>
              <span className="text-xs text-subtext">Sent or received</span>
            </div>
            {renderList(giftNfts, 'No NFT gifts yet.', Gift)}
          </div>
        </>
      )}

      <InfoPopup
        open={!!actionInfo}
        onClose={() => {
          setActionInfo('');
          setActionTitle('');
        }}
        title={actionTitle || 'NFT action'}
        info={actionInfo}
      />
    </div>
  );
}
