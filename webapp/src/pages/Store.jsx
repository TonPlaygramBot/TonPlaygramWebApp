import { useEffect, useMemo, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  POOL_ROYALE_DEFAULT_LOADOUT,
  POOL_ROYALE_OPTION_LABELS,
  POOL_ROYALE_STORE_ITEMS
} from '../config/poolRoyaleInventoryConfig.js';
import {
  CHESS_BATTLE_ROYALE_DEFAULT_LOADOUT,
  CHESS_BATTLE_ROYALE_OPTION_LABELS,
  CHESS_BATTLE_ROYALE_STORE_ITEMS
} from '../config/chessBattleRoyalInventoryConfig.js';
import {
  addPoolRoyalUnlock,
  getPoolRoyalInventory,
  isPoolOptionUnlocked,
  poolRoyalAccountId
} from '../utils/poolRoyalInventory.js';
import {
  addChessBattleRoyalUnlock,
  getChessBattleRoyalInventory,
  isChessBattleOptionUnlocked
} from '../utils/chessBattleRoyalInventory.js';
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
const CHESS_STORE_ACCOUNT_ID = import.meta.env.VITE_CHESS_BATTLE_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;

export default function Store() {
  useTelegramBackButton();
  const [accountId, setAccountId] = useState(() => poolRoyalAccountId());
  const [poolOwned, setPoolOwned] = useState(() => getPoolRoyalInventory(accountId));
  const [chessOwned, setChessOwned] = useState(() => getChessBattleRoyalInventory(accountId));
  const [info, setInfo] = useState('');
  const [tpcBalance, setTpcBalance] = useState(null);
  const [processing, setProcessing] = useState('');

  useEffect(() => {
    setAccountId(poolRoyalAccountId());
  }, []);

  useEffect(() => {
    setPoolOwned(getPoolRoyalInventory(accountId));
    setChessOwned(getChessBattleRoyalInventory(accountId));
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
        setPoolOwned(event.detail?.inventory || getPoolRoyalInventory(accountId));
      }
    };
    window.addEventListener('poolRoyalInventoryUpdate', handler);
    return () => window.removeEventListener('poolRoyalInventoryUpdate', handler);
  }, [accountId]);

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === accountId) {
        setChessOwned(event.detail?.inventory || getChessBattleRoyalInventory(accountId));
      }
    };
    window.addEventListener('chessBattleRoyalInventoryUpdate', handler);
    return () => window.removeEventListener('chessBattleRoyalInventoryUpdate', handler);
  }, [accountId]);

  const groupedPoolItems = useMemo(() => {
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
    const items = CHESS_BATTLE_ROYALE_STORE_ITEMS.map((item) => ({
      ...item,
      owned: isChessBattleOptionUnlocked(item.type, item.optionId, chessOwned)
    }));
    return items.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    }, {});
  }, [chessOwned]);

  const defaultPoolLoadout = useMemo(
    () =>
      POOL_ROYALE_DEFAULT_LOADOUT.map((entry) => ({
        ...entry,
        owned: isPoolOptionUnlocked(entry.type, entry.optionId, poolOwned)
      })),
    [poolOwned]
  );

  const defaultChessLoadout = useMemo(
    () =>
      CHESS_BATTLE_ROYALE_DEFAULT_LOADOUT.map((entry) => ({
        ...entry,
        owned: isChessBattleOptionUnlocked(entry.type, entry.optionId, chessOwned)
      })),
    [chessOwned]
  );

  const handlePurchase = async (item, gameKey) => {
    const isPool = gameKey === 'pool';
    const processingKey = `${gameKey}:${item.id}`;
    const labelsMap = isPool ? POOL_ROYALE_OPTION_LABELS : CHESS_BATTLE_ROYALE_OPTION_LABELS;
    const optionLabels = labelsMap[item.type] || {};
    const ownedLabel = optionLabels[item.optionId] || item.name;
    const storeAccount = isPool ? POOL_STORE_ACCOUNT_ID : CHESS_STORE_ACCOUNT_ID;

    if (item.owned || processing === processingKey) return;
    if (!accountId || accountId === 'guest') {
      setInfo('Link your TPC account in the wallet first.');
      return;
    }
    if (!storeAccount) {
      setInfo('Store account unavailable. Please try again later.');
      return;
    }

    if (tpcBalance !== null && item.price > tpcBalance) {
      setInfo('Insufficient TPC balance for this purchase.');
      return;
    }

    setProcessing(processingKey);
    setInfo('');
    try {
      const res = await sendAccountTpc(
        accountId,
        storeAccount,
        item.price,
        `${isPool ? 'Pool Royale' : 'Chess Battle Royal'}: ${ownedLabel}`
      );
      if (res?.error) {
        setInfo(res.error || 'Purchase failed.');
        return;
      }

      const updatedInventory = (isPool ? addPoolRoyalUnlock : addChessBattleRoyalUnlock)(
        item.type,
        item.optionId,
        accountId
      );
      (isPool ? setPoolOwned : setChessOwned)(updatedInventory);
      setInfo(`${ownedLabel} purchased and added to your ${isPool ? 'Pool Royale' : 'Chess Battle Royal'} account.`);

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

  const storeGames = [
    {
      key: 'pool',
      name: 'Pool Royale',
      defaultLoadout: defaultPoolLoadout,
      groupedItems: groupedPoolItems,
      typeLabels: POOL_TYPE_LABELS,
      collectionLabel: 'Pool Royale Collection',
      defaultDescription: 'These items are always available and applied when you enter Pool Royale.'
    },
    {
      key: 'chess',
      name: 'Chess Battle Royal',
      defaultLoadout: defaultChessLoadout,
      groupedItems: groupedChessItems,
      typeLabels: CHESS_TYPE_LABELS,
      collectionLabel: 'Chess Battle Royal Collection',
      defaultDescription: 'These items are always available inside the Chess Battle Royal table setup menu.'
    }
  ];

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center">
      <h2 className="text-xl font-bold">Store</h2>
      <p className="text-subtext text-sm text-center max-w-2xl">
        Pool Royale and Chess Battle Royal cosmetics are organized here as non-tradable unlocks.
        Defaults are already equipped for every player, while the cards below are minted as account-bound NFTs.
      </p>

      <div className="store-info-bar">
        <span className="font-semibold">Account: {accountId}</span>
        <span className="text-xs text-subtext">Prices shown in TPC</span>
        <span className="text-xs text-subtext">
          Balance: {tpcBalance === null ? '...' : tpcBalance.toLocaleString()} TPC
        </span>
      </div>

      <div className="w-full space-y-6">
        {storeGames.map((game) => (
          <div key={game.key} className="space-y-4">
            <div className="store-card max-w-2xl">
              <h3 className="text-lg font-semibold">{game.name} Default Loadout (Free)</h3>
              <p className="text-sm text-subtext">{game.defaultDescription}</p>
              <ul className="mt-2 space-y-1 w-full">
                {game.defaultLoadout.map((item) => (
                  <li
                    key={`${game.key}-${item.type}-${item.optionId}`}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 w-full"
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs uppercase text-subtext">
                      {game.typeLabels[item.type] || item.type}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="w-full space-y-3">
              <h3 className="text-lg font-semibold text-center">{game.collectionLabel}</h3>
              {Object.entries(game.groupedItems).map(([type, items]) => (
                <div key={`${game.key}-${type}`} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-semibold">{game.typeLabels[type] || type}</h4>
                    <span className="text-xs text-subtext">NFT unlocks</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {items.map((item) => {
                      const labels =
                        (game.key === 'pool'
                          ? POOL_ROYALE_OPTION_LABELS[item.type]
                          : CHESS_BATTLE_ROYALE_OPTION_LABELS[item.type]) || {};
                      const ownedLabel = labels[item.optionId] || item.name;
                      const purchaseKey = `${game.key}:${item.id}`;
                      return (
                        <div key={purchaseKey} className="store-card">
                          <div className="flex w-full items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-lg leading-tight">{item.name}</p>
                              <p className="text-xs text-subtext">{item.description}</p>
                              <p className="text-xs text-subtext mt-1">
                                Applies to: {game.typeLabels[item.type] || item.type}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 text-sm font-semibold">
                              {item.price}
                              <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePurchase(item, game.key)}
                            disabled={item.owned || processing === purchaseKey}
                            className={`buy-button mt-2 text-center ${
                              item.owned || processing === purchaseKey
                                ? 'cursor-not-allowed opacity-60'
                                : ''
                            }`}
                          >
                            {item.owned
                              ? `${ownedLabel} Owned`
                              : processing === purchaseKey
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
          </div>
        ))}
      </div>

      {info ? (
        <div className="checkout-card text-center text-sm font-semibold">{info}</div>
      ) : null}
    </div>
  );
}
