import { useEffect, useState } from 'react';
import { tonToTpc, tpcToTon } from '../utils/tokenomics.js';
import { getWalletBalance, getTonBalance, sendTpc } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import OpenInTelegram from '../components/OpenInTelegram.jsx';
import ConnectWallet from '../components/ConnectWallet.jsx';
import { useTonWallet } from '@tonconnect/ui-react';

export default function Wallet() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }
  const [ton, setTon] = useState('');
  const [tpc, setTpc] = useState('');
  const [tonBalance, setTonBalance] = useState(null);
  const [tpcBalance, setTpcBalance] = useState(null);
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const wallet = useTonWallet();

  const loadBalances = async () => {
    const prof = await getWalletBalance(telegramId);
    setTpcBalance(prof.balance);
    if (wallet?.account?.address) {
      const bal = await getTonBalance(wallet.account.address);
      setTonBalance(bal.balance);
    }
  };

  useEffect(() => {
    loadBalances();
  }, [wallet]);

  const handleTonChange = (e) => {
    const value = e.target.value;
    setTon(value);
    setTpc(value ? tonToTpc(Number(value)) : '');
  };

  const handleTpcChange = (e) => {
    const value = e.target.value;
    setTpc(value);
    setTon(value ? tpcToTon(Number(value)) : '');
  };

  const handleSend = async () => {
    const amt = Number(amount);
    if (!receiver || !amt) return;
    await sendTpc(telegramId, Number(receiver), amt);
    setReceiver('');
    setAmount('');
    loadBalances();
  };

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-xl font-bold">Wallet</h2>
      <p className="text-sm">Account #{telegramId}</p>
      <ConnectWallet />
      <p>TON Balance: {tonBalance === null ? '...' : tonBalance}</p>
      <p>TPC Balance: {tpcBalance === null ? '...' : tpcBalance}</p>
      <div className="space-y-1">
        <label className="block">TON</label>
        <input
          type="number"
          value={ton}
          onChange={handleTonChange}
          className="border p-1 rounded w-full"
        />
      </div>
      <div className="space-y-1">
        <label className="block">TPC</label>
        <input
          type="number"
          value={tpc}
          onChange={handleTpcChange}
          className="border p-1 rounded w-full"
        />
      </div>
      <div className="space-y-1">
        <label className="block">Send TPC</label>
        <input
          type="number"
          placeholder="Receiver Telegram ID"
          value={receiver}
          onChange={(e) => setReceiver(e.target.value)}
          className="border p-1 rounded w-full"
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border p-1 rounded w-full mt-1"
        />
        <button
          onClick={handleSend}
          className="mt-1 px-3 py-1 bg-blue-600 text-white rounded"
        >
          Send
        </button>
      </div>
      <div className="space-y-1">
        <label className="block">Receive TPC</label>
        <button
          onClick={() => navigator.clipboard.writeText(String(telegramId))}
          className="px-3 py-1 bg-green-600 text-white rounded"
        >
          Copy Account Number
        </button>
      </div>
    </div>
  );
}
