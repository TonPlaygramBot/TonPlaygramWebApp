import { useEffect, useMemo, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  POOL_ROYALE_DEFAULT_LOADOUT,
  POOL_ROYALE_OPTION_LABELS,
  POOL_ROYALE_STORE_ITEMS
} from '../config/poolRoyaleInventoryConfig.js';
import {
  addPoolRoyalUnlock,
  getPoolRoyalInventory,
  isPoolOptionUnlocked,
  poolRoyalAccountId
} from '../utils/poolRoyalInventory.js';
import {
  CHESS_BATTLE_DEFAULT_LOADOUT,
  CHESS_BATTLE_OPTION_LABELS,
  CHESS_BATTLE_STORE_ITEMS
} from '../config/chessBattleInventoryConfig.js';
import {
  addChessBattleUnlock,
  getChessBattleInventory,
  isChessOptionUnlocked,
  chessBattleAccountId
} from '../utils/chessBattleInventory.js';
import { getAccountBalance, sendAccountTpc } from '../utils/api.js';
import { DEV_INFO } from '../utils/constants.js';

const TYPE_LABELS = {
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
  tableShape: 'Table Shape',
  sideColor: 'Piece Colors',
  boardTheme: 'Board Themes',
  headStyle: 'Pawn Heads'
};

const TPC_ICON = '/assets/icons/ezgif-54c96d8a9b9236.webp';
const POOL_STORE_ACCOUNT_ID = import.meta.env.VITE_POOL_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;
const CHESS_STORE_ACCOUNT_ID = import.meta.env.VITE_CHESS_BATTLE_STORE_ACCOUNT_ID || DEV_INFO.account;

export default function Store() {
  useTelegramBackButton();
  const [accountId, setAccountId] = useState(() => poolRoyalAccountId());
  const [poolOwned, setPoolOwned] = useState(() => getPoolRoyalInventory(accountId));
  const [chessOwned, setChessOwned] = useState(() => getChessBattleInventory(accountId));
  const [info, setInfo] = useState('');
  const [tpcBalance, setTpcBalance] = useState(null);
  const [processing, setProcessing] = useState('');

  useEffect(() => {
    setAccountId(poolRoyalAccountId());
  }, []);

  useEffect(() => {
    setPoolOwned(getPoolRoyalInventory(accountId));
    setChessOwned(getChessBattleInventory(chessBattleAccountId(accountId)));
  }, [accountId]);

  useEffect(() => {
    const loadBalance = async () => {
      if (!accountId || accountId === 'guest') return;
      try {
        const res = await getAccountBalance(accountId);
        if (typeof res?.balance === 'number') {
          setTpcBalance(res.balance);
        }
      } catch (err) {
        console.error('Failed to load TPC balance', err);
      }
    };
    loadBalance();
  }, [accountId]);

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === accountId) {
        setPoolOwned(getPoolRoyalInventory(accountId));
      }
    };
    window.addEventListener('poolRoyalInventoryUpdate', handler);
    return () => window.removeEventListener('poolRoyalInventoryUpdate', handler);
  }, [accountId]);

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === accountId) {
        setChessOwned(getChessBattleInventory(chessBattleAccountId(accountId)));
      }
    };
    window.addEventListener('chessBattleInventoryUpdate', handler);
    return () => window.removeEventListener('chessBattleInventoryUpdate', handler);
  }, [accountId]);

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

  const defaultLoadout = useMemo(
    () =>
      POOL_ROYALE_DEFAULT_LOADOUT.map((entry) => ({
        ...entry,
        owned: isPoolOptionUnlocked(entry.type, entry.optionId, poolOwned)
      })),
    [poolOwned]
  );

  const chessGroupedItems = useMemo(() => {
    const items = CHESS_BATTLE_STORE_ITEMS.map((item) => ({
      ...item,
      owned: isChessOptionUnlocked(item.type, item.optionId, chessOwned)
    }));
    return items.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    }, {});
  }, [chessOwned]);

  const chessDefaultLoadout = useMemo(
    () =>
      CHESS_BATTLE_DEFAULT_LOADOUT.map((entry) => ({
        ...entry,
        owned: isChessOptionUnlocked(entry.type, entry.optionId, chessOwned)
      })),
    [chessOwned]
  );

  const handlePurchase = async (item) => {
    if (item.owned || processing === item.id) return;
    if (!accountId || accountId === 'guest') {
      setInfo('Link your TPC account in the wallet first.');
      return;
    }
    if (!POOL_STORE_ACCOUNT_ID) {
      setInfo('Store account unavailable. Please try again later.');
      return;
    }

    const labels = POOL_ROYALE_OPTION_LABELS[item.type] || {};
    const ownedLabel = labels[item.optionId] || item.name;

    if (tpcBalance !== null && item.price > tpcBalance) {
      setInfo('Insufficient TPC balance for this purchase.');
      return;
    }

    setProcessing(item.id);
    setInfo('');
    try {
      const res = await sendAccountTpc(
        accountId,
        POOL_STORE_ACCOUNT_ID,
        item.price,
        `Pool Royale: ${ownedLabel}`
      );
      if (res?.error) {
        setInfo(res.error || 'Purchase failed.');
        return;
      }

      const updatedInventory = addPoolRoyalUnlock(item.type, item.optionId, accountId);
      setPoolOwned(updatedInventory);
      setInfo(`${ownedLabel} purchased and added to your Pool Royale account.`);

      const bal = await getAccountBalance(accountId);
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

  const handleChessPurchase = async (item) => {
    if (item.owned || processing === item.id) return;
    if (!accountId || accountId === 'guest') {
      setInfo('Link your TPC account in the wallet first.');
      return;
    }
    if (!CHESS_STORE_ACCOUNT_ID) {
      setInfo('Store account unavailable. Please try again later.');
      return;
    }

    const labels = CHESS_BATTLE_OPTION_LABELS[item.type] || {};
    const ownedLabel = labels[item.optionId] || item.name;

    if (tpcBalance !== null && item.price > tpcBalance) {
      setInfo('Insufficient TPC balance for this purchase.');
      return;
    }

    setProcessing(item.id);
    setInfo('');
    try {
      const res = await sendAccountTpc(
        accountId,
        CHESS_STORE_ACCOUNT_ID,
        item.price,
        `Chess Battle Royale: ${ownedLabel}`
      );
      if (res?.error) {
        setInfo(res.error || 'Purchase failed.');
        return;
      }

      const updatedInventory = addChessBattleUnlock(item.type, item.optionId, accountId);
      setChessOwned(updatedInventory);
      setInfo(`${ownedLabel} purchased and added to your Chess Battle Royal account.`);

      const bal = await getAccountBalance(accountId);
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
        Pool Royale and Chess Battle Royal cosmetics are organized here as non-tradable unlocks. Defaults
        remain free for every player, while the cards below are minted as account-bound NFTs for each game.
      </p>

      <div className="store-info-bar">
        <span className="font-semibold">Pool Royale / Chess Battle Royal</span>
        <span className="text-xs text-subtext">Account: {accountId}</span>
        <span className="text-xs text-subtext">Prices shown in TPC</span>
        <span className="text-xs text-subtext">
          Balance: {tpcBalance === null ? '...' : tpcBalance.toLocaleString()} TPC
        </span>
      </div>

      <div className="store-card max-w-2xl">
        <h3 className="text-lg font-semibold">Default Loadout (Free)</h3>
        <p className="text-sm text-subtext">
          These items are always available and applied when you enter Pool Royale.
        </p>
        <ul className="mt-2 space-y-1 w-full">
          {defaultLoadout.map((item) => (
            <li
              key={`${item.type}-${item.optionId}`}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 w-full"
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-xs uppercase text-subtext">
                {TYPE_LABELS[item.type] || item.type}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="store-card max-w-2xl">
        <h3 className="text-lg font-semibold">Chess Battle Royal Defaults (Free)</h3>
        <p className="text-sm text-subtext">
          Two base piece colors stay unlocked by default; purchase the others to surface them inside the table setup menu.
        </p>
        <ul className="mt-2 space-y-1 w-full">
          {chessDefaultLoadout.map((item) => (
            <li
              key={`chess-${item.type}-${item.optionId}`}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 w-full"
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-xs uppercase text-subtext">{CHESS_TYPE_LABELS[item.type] || item.type}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="w-full space-y-3">
        <h3 className="text-lg font-semibold text-center">Pool Royale Collection</h3>
        {Object.entries(groupedItems).map(([type, items]) => (
          <div key={type} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">{TYPE_LABELS[type] || type}</h4>
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
                          Applies to: {TYPE_LABELS[item.type] || item.type}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-semibold">
                        {item.price}
                        <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePurchase(item)}
                      disabled={item.owned || processing === item.id}
                      className={`buy-button mt-2 text-center ${
                        item.owned || processing === item.id
                          ? 'cursor-not-allowed opacity-60'
                          : ''
                      }`}
                    >
                      {item.owned
                        ? `${ownedLabel} Owned`
                        : processing === item.id
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

      <div className="w-full space-y-3">
        <h3 className="text-lg font-semibold text-center">Chess Battle Royal Collection</h3>
        {Object.entries(chessGroupedItems).map(([type, items]) => (
          <div key={type} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">{CHESS_TYPE_LABELS[type] || type}</h4>
              <span className="text-xs text-subtext">NFT unlocks</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((item) => {
                const labels = CHESS_BATTLE_OPTION_LABELS[item.type] || {};
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
                      onClick={() => handleChessPurchase(item)}
                      disabled={item.owned || processing === item.id}
                      className={`buy-button mt-2 text-center ${
                        item.owned || processing === item.id
                          ? 'cursor-not-allowed opacity-60'
                          : ''
                      }`}
                    >
                      {item.owned
                        ? `${ownedLabel} Owned`
                        : processing === item.id
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
