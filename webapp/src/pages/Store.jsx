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

const TYPE_LABELS = {
  tableFinish: 'Table Finishes',
  chromeColor: 'Chrome Fascias',
  railMarkerColor: 'Rail Markers',
  clothColor: 'Cloth Colors',
  cueStyle: 'Cue Styles'
};

const TPC_ICON = '/assets/icons/ezgif-54c96d8a9b9236.webp';

export default function Store() {
  useTelegramBackButton();
  const [accountId, setAccountId] = useState(() => poolRoyalAccountId());
  const [owned, setOwned] = useState(() => getPoolRoyalInventory(accountId));
  const [info, setInfo] = useState('');

  useEffect(() => {
    setAccountId(poolRoyalAccountId());
  }, []);

  useEffect(() => {
    setOwned(getPoolRoyalInventory(accountId));
  }, [accountId]);

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
    addPoolRoyalUnlock(item.type, item.optionId, accountId);
    setOwned(getPoolRoyalInventory(accountId));
    const labels = POOL_ROYALE_OPTION_LABELS[item.type] || {};
    setInfo(`${labels[item.optionId] || item.name} unlocked for Pool Royale.`);
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
        <span className="text-xs text-subtext">Prices shown in TPC</span>
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
                      disabled={item.owned}
                      className={`buy-button mt-2 text-center ${
                        item.owned ? 'cursor-not-allowed opacity-60' : ''
                      }`}
                    >
                      {item.owned ? `${ownedLabel} Owned` : `Unlock ${ownedLabel}`}
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
