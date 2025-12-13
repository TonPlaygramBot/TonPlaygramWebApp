import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { createAccount, getAccountBalance, sendAccountTpc } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

const TYPE_LABELS = {
  tableFinish: 'Table Finishes',
  chromeColor: 'Chrome Fascias',
  railMarkerColor: 'Rail Markers',
  clothColor: 'Cloth Colors',
  cueStyle: 'Cue Styles'
};

const TPC_ICON = '/assets/icons/ezgif-54c96d8a9b9236.webp';
const STORE_ACCOUNT_ID = import.meta.env.VITE_STORE_ACCOUNT_ID || 'POOL_ROYALE_STORE';

export default function Store() {
  useTelegramBackButton();
  const [accountId, setAccountId] = useState(() => poolRoyalAccountId());
  const [owned, setOwned] = useState(() => getPoolRoyalInventory(accountId));
  const [info, setInfo] = useState('');
  const [tpcBalance, setTpcBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [processingId, setProcessingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setAccountId(poolRoyalAccountId());
  }, []);

  useEffect(() => {
    setOwned(getPoolRoyalInventory(accountId));
  }, [accountId]);

  const loadAccountBalance = useCallback(async () => {
    setLoadingBalance(true);
    setError('');
    try {
      let telegramId;
      try {
        telegramId = getTelegramId();
      } catch (err) {
        telegramId = undefined;
      }
      const googleId = telegramId ? null : localStorage.getItem('googleId');
      const acc = await createAccount(telegramId, googleId);
      if (acc?.error) throw new Error(acc.error);
      const resolvedAccountId = acc?.accountId || accountId;
      if (acc?.accountId) {
        setAccountId(acc.accountId);
        localStorage.setItem('accountId', acc.accountId);
      }
      if (acc?.walletAddress) {
        localStorage.setItem('walletAddress', acc.walletAddress);
      }
      const bal = await getAccountBalance(resolvedAccountId);
      if (bal?.error) throw new Error(bal.error);
      const nextBalance = typeof bal.balance === 'number' ? bal.balance : 0;
      setTpcBalance(nextBalance);
      return { accountId: resolvedAccountId, balance: nextBalance };
    } catch (err) {
      console.error('Failed to load account for store', err);
      setError('Unable to load TPC account. Please try again.');
      setTpcBalance(0);
      return { accountId, balance: 0 };
    } finally {
      setLoadingBalance(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadAccountBalance();
  }, [loadAccountBalance]);

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === accountId) {
        setOwned(getPoolRoyalInventory(accountId));
      }
    };
    window.addEventListener('poolRoyalInventoryUpdate', handler);
    return () => window.removeEventListener('poolRoyalInventoryUpdate', handler);
  }, [accountId]);

  const groupedItems = useMemo(() => {
    const items = POOL_ROYALE_STORE_ITEMS.map((item) => ({
      ...item,
      owned: isPoolOptionUnlocked(item.type, item.optionId, owned)
    }));
    return items.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    }, {});
  }, [owned]);

  const defaultLoadout = useMemo(
    () =>
      POOL_ROYALE_DEFAULT_LOADOUT.map((entry) => ({
        ...entry,
        owned: isPoolOptionUnlocked(entry.type, entry.optionId, owned)
      })),
    [owned]
  );

  const handlePurchase = (item) => {
    (async () => {
      if (item.owned || processingId) return;
      setProcessingId(item.id);
      setInfo('');
      setError('');
      try {
        const labels = POOL_ROYALE_OPTION_LABELS[item.type] || {};
        const ownedLabel = labels[item.optionId] || item.name;
        let resolvedAccountId = accountId;
        if (!resolvedAccountId || resolvedAccountId === 'guest') {
          const res = await loadAccountBalance();
          resolvedAccountId = res?.accountId || resolvedAccountId;
        }
        const balance =
          typeof tpcBalance === 'number'
            ? tpcBalance
            : (await getAccountBalance(resolvedAccountId)).balance || 0;

        if (balance < item.price) {
          setError('Insufficient TPC balance for this purchase.');
          return;
        }

        const tx = await sendAccountTpc(
          resolvedAccountId,
          STORE_ACCOUNT_ID,
          item.price,
          `Pool Royale: ${ownedLabel}`
        );
        if (tx?.error) throw new Error(tx.error);
        const latestBalance =
          typeof tx?.balance === 'number'
            ? tx.balance
            : (await getAccountBalance(resolvedAccountId)).balance || 0;
        setTpcBalance(latestBalance);
        addPoolRoyalUnlock(item.type, item.optionId, resolvedAccountId);
        setOwned(getPoolRoyalInventory(resolvedAccountId));
        setInfo(`${ownedLabel} purchased with TPC. Statement recorded.`);
      } catch (err) {
        console.error('Purchase failed', err);
        setError('Purchase failed. Please try again.');
      } finally {
        setProcessingId('');
      }
    })();
  };

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center">
      <h2 className="text-xl font-bold">Store</h2>
      <p className="text-subtext text-sm text-center max-w-2xl">
        Pool Royale cosmetics are organized here as non-tradable unlocks. Defaults are already
        equipped for every player, while the cards below are minted as account-bound NFTs for this
        game.
      </p>

      <div className="store-info-bar">
        <span className="font-semibold">Pool Royale</span>
        <span className="text-xs text-subtext">Account: {accountId}</span>
        <span className="text-xs text-subtext">
          {loadingBalance
            ? 'Checking balance...'
            : `Balance: ${tpcBalance?.toLocaleString() || 0} TPC`}
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
                      disabled={item.owned || !!processingId}
                      className={`buy-button mt-2 text-center ${
                        item.owned || processingId
                          ? 'cursor-not-allowed opacity-60'
                          : ''
                      }`}
                    >
                      {item.owned
                        ? `${ownedLabel} Owned`
                        : processingId === item.id
                          ? 'Processing...'
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
      {error ? (
        <div className="checkout-card text-center text-sm font-semibold text-red-500">{error}</div>
      ) : null}
    </div>
  );
}
