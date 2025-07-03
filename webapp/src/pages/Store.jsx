import { useEffect, useState } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { createAccount, buyBundle } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import InfoPopup from '../components/InfoPopup.jsx';

const STORE_ADDRESS = 'UQDqDBiNU132j15Qka5EmSf37jCTLF-RdOlaQOXLHIJ5t-XT';
const BUNDLES = [
  { id: '100k', tpc: 100000, ton: 0.05 },
  { id: '250k', tpc: 250000, ton: 0.1 }
];

export default function Store() {
  useTelegramBackButton();
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  const [accountId, setAccountId] = useState('');
  const [msg, setMsg] = useState('');

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
      const hash = prompt('Enter transaction hash');
      if (!hash) return;
      const res = await buyBundle(accountId, hash, bundle.id);
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
        <div key={b.id} className="prism-box p-4 space-y-2 w-72 mx-auto">
          <div className="text-center font-semibold">{b.tpc.toLocaleString()} TPC</div>
          <div className="text-center text-sm">Price: {b.ton} TON</div>
          <button
            onClick={() => handleBuy(b)}
            className="lobby-tile w-full cursor-pointer"
          >
            Buy
          </button>
        </div>
      ))}
      <InfoPopup open={!!msg} onClose={() => setMsg('')} title="Store" info={msg} />
    </div>
  );
}
