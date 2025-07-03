import { useEffect, useState } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { createAccount, buyBundle, claimPurchase } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import InfoPopup from '../components/InfoPopup.jsx';

const STORE_ADDRESS = 'UQDqDBiNU132j15Qka5EmSf37jCTLF-RdOlaQOXLHIJ5t-XT';
const BUNDLES = [
  { id: '10k', tpc: 10000, ton: 0.012 },
  { id: '20k', tpc: 20000, ton: 0.02 },
  { id: '100k', tpc: 100000, ton: 0.05 },
  { id: '250k', tpc: 250000, ton: 0.1 }
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
          className="prism-box p-4 space-y-2 w-80 mx-auto flex flex-col items-center"
        >
          <button
            onClick={() => handleBuy(b)}
            className="lobby-tile px-4 cursor-pointer"
          >
            Buy
          </button>
          <div className="mt-auto flex flex-col space-y-1 w-full">
            <div className="text-center font-semibold flex items-center justify-center space-x-1">
              <img src="/icons/TPCcoin.png" alt="TPC" className="w-5 h-5" />
              <span>{b.tpc.toLocaleString()}</span>
            </div>
            <div className="text-center text-sm flex items-center justify-center space-x-1">
              <span>Price:</span>
              <img src="/icons/TON.png" alt="TON" className="w-5 h-5" />
              <span>{b.ton}</span>
            </div>
          </div>
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
