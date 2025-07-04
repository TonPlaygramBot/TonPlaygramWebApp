import { useEffect, useState } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { createAccount, buyBundle, claimPurchase } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import InfoPopup from '../components/InfoPopup.jsx';

const STORE_ADDRESS = 'UQDqDBiNU132j15Qka5EmSf37jCTLF-RdOlaQOXLHIJ5t-XT';
const BUNDLES = [
  { id: 'newbie', name: 'Newbie Pack', icon: '🌱', tpc: 25000, ton: 0.25, supply: '0.5M', boost: 0, presale: true },
  { id: 'rookie', name: 'Rookie', icon: '🎯', tpc: 50000, ton: 0.4, supply: '1M', boost: 0, presale: true },
  { id: 'starter', name: 'Starter', icon: '🚀', tpc: 100000, ton: 0.75, supply: '2M', boost: 0, presale: true },
  { id: 'miner', name: 'Miner Pack', icon: '⛏️', tpc: 250000, ton: 1.6, supply: '5M', boost: 0.03, presale: true },
  { id: 'grinder', name: 'Grinder', icon: '⚙️', tpc: 500000, ton: 3.0, supply: '7.5M', boost: 0.05, presale: true },
  { id: 'pro', name: 'Pro Bundle', icon: '🏆', tpc: 1000000, ton: 5.5, supply: '10M', boost: 0.08, presale: true },
  { id: 'whale', name: 'Whale Bundle', icon: '🐋', tpc: 2500000, ton: 10.5, supply: '12.5M', boost: 0.12, presale: true },
  { id: 'max', name: 'Max Presale', icon: '👑', tpc: 5000000, ton: 20, supply: '15M', boost: 0.15, presale: true }
];

export default function Store() {
  useTelegramBackButton();
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  const [accountId, setAccountId] = useState('');
  const [msg, setMsg] = useState('');
  const [claimHash, setClaimHash] = useState('');

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
    <div className="relative p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold">Store</h2>
      {BUNDLES.map((b) => (
        <div
          key={b.id}
          className="store-card w-80 mx-auto"
        >
          <div className="flex items-center space-x-2">
            <span className="text-xl">{b.icon}</span>
            <h3 className="font-semibold">{b.name}</h3>
          </div>
          <div className="text-lg font-bold flex items-center space-x-1">
            <span>{b.tpc.toLocaleString()}</span>
            <img src="/icons/TPCcoin.png" alt="TPC" className="w-5 h-5" />
          </div>
          <div className="text-primary text-lg flex items-center space-x-1">
            <span>{b.ton}</span>
            <img src="/icons/TON.png" alt="TON" className="w-5 h-5" />
          </div>
          <div className="text-xs text-accent">Presale Bundle</div>
          <div className="text-sm">
            {b.boost ? `Mining Boost: +${b.boost * 100}%` : 'No Mining Boost'}
          </div>
          {b.supply && (
            <div className="text-xs text-subtext">{b.supply}</div>
          )}
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
