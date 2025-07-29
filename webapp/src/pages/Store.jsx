import { useEffect, useState } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { createAccount, buyBundle, claimPurchase } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import InfoPopup from '../components/InfoPopup.jsx';
import { STORE_ADDRESS, STORE_BUNDLES, STORE_CATEGORIES } from '../utils/storeData.js';

export default function Store() {
  useTelegramBackButton();
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  const [accountId, setAccountId] = useState('');
  const [msg, setMsg] = useState('');
  const [claimHash, setClaimHash] = useState('');
  const [category, setCategory] = useState('Bundles');

  useEffect(() => {
    let id;
    try { id = getTelegramId(); } catch {}
    createAccount(id).then((acc) => setAccountId(acc.accountId));
  }, []);

  const handleBuy = async (bundle) => {
    if (!walletAddress) {
      tonConnectUI.openModal();
      return;
    }
    const tx = {
      validUntil: Math.floor(Date.now() / 1000) + 60,
      messages: [{ address: STORE_ADDRESS, amount: String(bundle.ton * 1e9) }]
    };
    try {
      await tonConnectUI.sendTransaction(tx);
      const res = await buyBundle(accountId, bundle.id);
      if (res.error) setMsg(res.error);
      else setMsg('Purchase successful');
    } catch (e) {
      setMsg('Transaction failed');
    }
  };

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center">
      <h2 className="text-xl font-bold">Store</h2>
      <div className="flex justify-center space-x-2">
        {STORE_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`lobby-tile px-3 py-1 ${category === c ? 'lobby-selected' : ''}`}
          >
            {c}
          </button>
        ))}
      </div>
      {STORE_BUNDLES.filter(b => b.category === category).map((b) => (
        <div
          key={b.id}
          className="store-card mx-auto wide-card"
        >
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{b.icon}</span>
            <h3 className="font-semibold">{b.name}</h3>
          </div>
          <div className="text-lg font-bold flex items-center space-x-1">
            <span>{b.tpc.toLocaleString()}</span>
            <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-6 h-6" />
          </div>
          <div className="text-primary text-lg flex items-center space-x-1">
            <span>{b.ton}</span>
            <img src="/assets/icons/TON.webp" alt="TON" className="w-6 h-6" />
          </div>
          <div className="text-xs text-accent">{b.category} Bundle</div>
          {b.boost ? (
            <div className="text-sm">Mining Boost: +{b.boost * 100}%</div>
          ) : null}
          {b.spins ? (
            <div className="text-sm">Spins: {b.spins}</div>
          ) : null}
          {b.duration ? (
            <div className="text-xs text-subtext">Duration: {b.duration}d</div>
          ) : null}
          <button
            onClick={() => handleBuy(b)}
            className="buy-button mt-2"
          >
            Buy
          </button>
        </div>
      ))}
      <div className="prism-box p-4 space-y-2 w-80 mx-auto">
        <h3 className="text-center font-semibold">Claim Purchase</h3>
        <input
          type="text"
          placeholder="Transaction hash"
          value={claimHash}
          onChange={e => setClaimHash(e.target.value)}
          className="w-full p-1 text-black rounded"
        />
        <button
          onClick={async () => {
            if (!claimHash) return;
            const res = await claimPurchase(accountId, claimHash);
            if (res.error) setMsg(res.error);
            else if (res.alreadyClaimed) {
              const when = new Date(res.date).toLocaleString();
              setMsg(`Claim already sent on ${when}`);
            } else {
              setMsg('Claim successful. Sorry for the inconvenience and thank you!');
            }
            setClaimHash('');
          }}
          className="lobby-tile w-full cursor-pointer"
        >
          Claim
        </button>
      </div>
      <p className="text-center text-xs text-subtext">
        We are truly sorry if your TPC wasn't delivered. Please enter your
        transaction hash below to claim it.
      </p>
      <InfoPopup open={!!msg} onClose={() => setMsg('')} title="Store" info={msg} />
    </div>
  );
}
