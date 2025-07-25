import { useEffect, useState } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import TonConnectButton from './TonConnectButton.jsx';
import InfoPopup from './InfoPopup.jsx';
import { calculateTpcAmount } from '../utils/buyLogic.js';
import { buyTPC, getPresaleStatus } from '../utils/api.js';
import { STORE_ADDRESS } from '../utils/storeData.js';

export default function BuyTpcCard() {
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  const [amountTon, setAmountTon] = useState('');
  const [tpcAmount, setTpcAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    getPresaleStatus().then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    setTpcAmount(calculateTpcAmount(amountTon, status?.currentPrice));
  }, [amountTon, status]);

  const handleBuy = async () => {
    if (!walletAddress) {
      tonConnectUI.openModal();
      return;
    }
    const amount = parseFloat(amountTon);
    if (!amount || amount <= 0) {
      setMsg('Enter TON amount');
      return;
    }
    const tx = {
      validUntil: Math.floor(Date.now() / 1000) + 60,
      messages: [{ address: STORE_ADDRESS, amount: String(amount * 1e9) }]
    };
    try {
      await tonConnectUI.sendTransaction(tx);
      const res = await buyTPC(walletAddress, amount);
      if (res.error) setMsg(res.error);
      else setMsg('Purchase successful');
      setAmountTon('');
      getPresaleStatus().then(setStatus).catch(() => {});
    } catch {
      setMsg('Transaction failed');
    }
  };

  return (
    <div className="checkout-card">
      <label className="self-start text-sm">TON You Pay</label>
      <input
        type="number"
        placeholder="0"
        value={amountTon}
        onChange={(e) => setAmountTon(e.target.value)}
        className="w-full p-1 text-black rounded"
      />
      <label className="self-start text-sm">TPC You Receive</label>
      <input
        type="text"
        value={tpcAmount}
        readOnly
        className="w-full p-1 text-black rounded"
      />
      <TonConnectButton className="w-full" />
      <div className="flex items-center justify-center text-xs">
        Payment Method: TON only <img src="/assets/icons/TON.webp" alt="TON" className="w-4 h-4 ml-1" />
      </div>
      <button onClick={handleBuy} className="buy-button w-full mt-1">Buy TPC</button>
      <InfoPopup open={!!msg} onClose={() => setMsg('')} title="Store" info={msg} />
    </div>
  );
}
