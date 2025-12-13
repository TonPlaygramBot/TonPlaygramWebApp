import { useEffect, useMemo, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  POOL_ROYALE_DEFAULT_LOADOUT,
  POOL_ROYALE_OPTION_LABELS,
  POOL_ROYALE_STORE_ITEMS
} from '../config/poolRoyaleInventoryConfig.js';
import {
  CHESS_ROYALE_DEFAULT_LOADOUT,
  CHESS_ROYALE_OPTION_LABELS,
  CHESS_ROYALE_STORE_ITEMS
} from '../config/chessRoyalInventoryConfig.js';
import {
  addPoolRoyalUnlock,
  getPoolRoyalInventory,
  isPoolOptionUnlocked,
  poolRoyalAccountId
} from '../utils/poolRoyalInventory.js';
import {
  addChessRoyalUnlock,
  chessRoyalAccountId,
  getChessRoyalInventory,
  isChessOptionUnlocked
} from '../utils/chessRoyalInventory.js';
import { getAccountBalance, sendAccountTpc } from '../utils/api.js';
import { DEV_INFO } from '../utils/constants.js';

const POOL_TYPE_LABELS = {
  tableFinish: 'Table Finishes',
  chromeColor: 'Chrome Fascias',
  railMarkerColor: 'Rail Markers',
  clothColor: 'Cloth Colors',
  cueStyle: 'Cue Styles'
};

const CHESS_TYPE_LABELS = {
  tableWood: 'Table Wood',
  tableCloth: 'Table Cloth',
  tableBase: 'Table Base',
  chairColor: 'Chairs',
  tableShape: 'Table Shape'
};

const TPC_ICON = '/assets/icons/ezgif-54c96d8a9b9236.webp';
const POOL_STORE_ACCOUNT_ID = import.meta.env.VITE_POOL_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;
const CHESS_STORE_ACCOUNT_ID = import.meta.env.VITE_CHESS_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;

export default function Store() {
  useTelegramBackButton();
  const [poolAccountId, setPoolAccountId] = useState(() => poolRoyalAccountId());
  const [poolOwned, setPoolOwned] = useState(() => getPoolRoyalInventory(poolAccountId));
  const [chessAccountId, setChessAccountId] = useState(() => chessRoyalAccountId());
  const [chessOwned, setChessOwned] = useState(() => getChessRoyalInventory(chessAccountId));
  const [info, setInfo] = useState('');
  const [tpcBalance, setTpcBalance] = useState(null);
  const [processing, setProcessing] = useState('');

  useEffect(() => {
    setPoolAccountId(poolRoyalAccountId());
    setChessAccountId(chessRoyalAccountId());
  }, []);

  useEffect(() => {
    setPoolOwned(getPoolRoyalInventory(poolAccountId));
  }, [poolAccountId]);

  useEffect(() => {
    setChessOwned(getChessRoyalInventory(chessAccountId));
  }, [chessAccountId]);

  useEffect(() => {
    const loadBalance = async () => {
      const balanceAccountId =
        (poolAccountId && poolAccountId !== 'guest' && poolAccountId) ||
        (chessAccountId && chessAccountId !== 'guest' && chessAccountId);
      if (!balanceAccountId) return;
      try {
        const res = await getAccountBalance(balanceAccountId);
        if (typeof res?.balance === 'number') {
          setTpcBalance(res.balance);
        }
      } catch (err) {
        console.error('Failed to load TPC balance', err);
      }
    };
    loadBalance();
  }, [chessAccountId, poolAccountId]);

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === poolAccountId) {
        setPoolOwned(getPoolRoyalInventory(poolAccountId));
      }
    };
    window.addEventListener('poolRoyalInventoryUpdate', handler);
    return () => window.removeEventListener('poolRoyalInventoryUpdate', handler);
  }, [poolAccountId]);

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === chessAccountId) {
        setChessOwned(getChessRoyalInventory(chessAccountId));
      }
    };
    window.addEventListener('chessRoyalInventoryUpdate', handler);
    return () => window.removeEventListener('chessRoyalInventoryUpdate', handler);
  }, [chessAccountId]);

  const groupedItems = useMemo(() => {
    const items = POOL_ROYALE_STORE_ITEMS.map((item) => ({
      ...item,
      owned: isPoolOptionUnlocked(item.type, item.optionId, poolOwned)
    }));
    return items.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    }, {});
  }, [poolOwned]);

  const groupedChessItems = useMemo(() => {
    const items = CHESS_ROYALE_STORE_ITEMS.map((item) => ({
      ...item,
      owned: isChessOptionUnlocked(item.type, item.optionId, chessOwned)
    }));
    return items.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    }, {});
  }, [chessOwned]);

  const defaultLoadout = useMemo(
    () =>
      POOL_ROYALE_DEFAULT_LOADOUT.map((entry) => ({
        ...entry,
        owned: isPoolOptionUnlocked(entry.type, entry.optionId, poolOwned)
      })),
    [poolOwned]
  );

  const defaultChessLoadout = useMemo(
    () =>
      CHESS_ROYALE_DEFAULT_LOADOUT.map((entry) => ({
        ...entry,
        owned: isChessOptionUnlocked(entry.type, entry.optionId, chessOwned)
      })),
    [chessOwned]
  );

  const handlePurchase = async (item, game) => {
    if (item.owned || processing === `${game}-${item.id}`) return;
    const isPool = game === 'pool';
    const account = isPool ? poolAccountId : chessAccountId;
    const labels = isPool ? POOL_ROYALE_OPTION_LABELS : CHESS_ROYALE_OPTION_LABELS;
    const addUnlock = isPool ? addPoolRoyalUnlock : addChessRoyalUnlock;
    const storeAccountId = isPool ? POOL_STORE_ACCOUNT_ID : CHESS_STORE_ACCOUNT_ID;
    const gameLabel = isPool ? 'Pool Royale' : 'Chess Battle Royal';

    if (!account || account === 'guest') {
      setInfo('Link your TPC account in the wallet first.');
      return;
    }
    if (!storeAccountId) {
      setInfo('Store account unavailable. Please try again later.');
      return;
    }

    const ownedLabel = (labels[item.type] || {})[item.optionId] || item.name;

    if (tpcBalance !== null && item.price > tpcBalance) {
      setInfo('Insufficient TPC balance for this purchase.');
      return;
    }

    setProcessing(`${game}-${item.id}`);
    setInfo('');
    try {
      const res = await sendAccountTpc(account, storeAccountId, item.price, `${gameLabel}: ${ownedLabel}`);
      if (res?.error) {
        setInfo(res.error || 'Purchase failed.');
        return;
      }

      const updatedInventory = addUnlock(item.type, item.optionId, account);
      if (isPool) {
        setPoolOwned(updatedInventory);
      } else {
        setChessOwned(updatedInventory);
      }
      setInfo(`${ownedLabel} purchased and added to your ${gameLabel} account.`);

      const bal = await getAccountBalance(account);
      if (typeof bal?.balance === 'number') {
        setTpcBalance(bal.balance);
      }
    } catch (err) {
      console.error('Purchase failed', err);
      setInfo('Failed to process purchase.');
    } finally {
      setProcessing('');
    }
  };

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center">
      <h2 className="text-xl font-bold">Store</h2>
      <p className="text-subtext text-sm text-center max-w-2xl">
        Pool Royale and Chess Battle Royal cosmetics are organized here as non-tradable unlocks.
        The first option in each category stays free; the rest are minted as account-bound NFTs you
        can unlock from this page.
      </p>

      <div className="store-info-bar">
        <span className="font-semibold">Accounts</span>
        <span className="text-xs text-subtext">Pool Royale: {poolAccountId}</span>
        <span className="text-xs text-subtext">Chess Battle Royal: {chessAccountId}</span>
        <span className="text-xs text-subtext">Prices shown in TPC</span>
        <span className="text-xs text-subtext">
          Balance: {tpcBalance === null ? '...' : tpcBalance.toLocaleString()} TPC
        </span>
      </div>

      <div className="store-card max-w-2xl">
        <h3 className="text-lg font-semibold">Pool Royale Default Loadout (Free)</h3>
        <p className="text-sm text-subtext">These items are always available inside Pool Royale.</p>
        <ul className="mt-2 space-y-1 w-full">
          {defaultLoadout.map((item) => (
            <li
              key={`${item.type}-${item.optionId}`}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 w-full"
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-xs uppercase text-subtext">
                {POOL_TYPE_LABELS[item.type] || item.type}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="w-full space-y-3">
        <h3 className="text-lg font-semibold text-center">Pool Royale Collection</h3>
        {Object.entries(groupedItems).map(([type, items]) => (
          <div key={type} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">{POOL_TYPE_LABELS[type] || type}</h4>
              <span className="text-xs text-subtext">NFT unlocks</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((item) => {
                const labels = POOL_ROYALE_OPTION_LABELS[item.type] || {};
                const ownedLabel = labels[item.optionId] || item.name;
                return (
                  <div key={item.id} className="store-card">
                    <div className="flex w-full items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-lg leading-tight">{item.name}</p>
                        <p className="text-xs text-subtext">{item.description}</p>
                        <p className="text-xs text-subtext mt-1">
                          Applies to: {POOL_TYPE_LABELS[item.type] || item.type}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-semibold">
                        {item.price}
                        <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePurchase(item, 'pool')}
                      disabled={item.owned || processing === `pool-${item.id}`}
                      className={`buy-button mt-2 text-center ${
                        item.owned || processing === `pool-${item.id}`
                          ? 'cursor-not-allowed opacity-60'
                          : ''
                      }`}
                    >
                      {item.owned
                        ? `${ownedLabel} Owned`
                        : processing === `pool-${item.id}`
                        ? 'Purchasing...'
                        : `Purchase ${ownedLabel}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="store-card max-w-2xl">
        <h3 className="text-lg font-semibold">Chess Battle Royal Default Loadout (Free)</h3>
        <p className="text-sm text-subtext">First options stay unlocked and ready for the arena.</p>
        <ul className="mt-2 space-y-1 w-full">
          {defaultChessLoadout.map((item) => (
            <li
              key={`${item.type}-${item.optionId}`}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 w-full"
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-xs uppercase text-subtext">
                {CHESS_TYPE_LABELS[item.type] || item.type}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="w-full space-y-3">
        <h3 className="text-lg font-semibold text-center">Chess Battle Royal Collection</h3>
        {Object.entries(groupedChessItems).map(([type, items]) => (
          <div key={type} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">{CHESS_TYPE_LABELS[type] || type}</h4>
              <span className="text-xs text-subtext">NFT unlocks</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((item) => {
                const labels = CHESS_ROYALE_OPTION_LABELS[item.type] || {};
                const ownedLabel = labels[item.optionId] || item.name;
                return (
                  <div key={item.id} className="store-card">
                    <div className="flex w-full items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-lg leading-tight">{item.name}</p>
                        <p className="text-xs text-subtext">{item.description}</p>
                        <p className="text-xs text-subtext mt-1">
                          Applies to: {CHESS_TYPE_LABELS[item.type] || item.type}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-semibold">
                        {item.price}
                        <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePurchase(item, 'chess')}
                      disabled={item.owned || processing === `chess-${item.id}`}
                      className={`buy-button mt-2 text-center ${
                        item.owned || processing === `chess-${item.id}`
                          ? 'cursor-not-allowed opacity-60'
                          : ''
                      }`}
                    >
                      {item.owned
                        ? `${ownedLabel} Owned`
                        : processing === `chess-${item.id}`
                        ? 'Purchasing...'
                        : `Purchase ${ownedLabel}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {info ? (
        <div className="checkout-card text-center text-sm font-semibold">{info}</div>
      ) : null}
    </div>
  );
}
