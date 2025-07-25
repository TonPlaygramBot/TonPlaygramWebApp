import { useEffect, useState } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { createAccount, buyTPC, getPresaleStatus, claimPurchase } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import InfoPopup from '../components/InfoPopup.jsx';
import { STORE_ADDRESS } from '../utils/storeData.js';
import { MAX_TPC_PER_WALLET } from '../config.js';

export default function Store() {
  useTelegramBackButton();
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  const [accountId, setAccountId] = useState('');
  const [msg, setMsg] = useState('');
  const [claimHash, setClaimHash] = useState('');
  const [amountTon, setAmountTon] = useState('');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let id;
    try {
      id = getTelegramId();
    } catch {}
    createAccount(id).then((acc) => setAccountId(acc.accountId));
    getPresaleStatus().then(setStatus);
  }, []);

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
      getPresaleStatus().then(setStatus);
    } catch (e) {
      setMsg('Transaction failed');
    }
  };

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center">
      <h2 className="text-xl font-bold">Store</h2>
      <div className="prism-box p-4 space-y-2 w-80 mx-auto">
        <div className="text-center text-sm">
          Current Price: {status ? status.currentPrice : '...'} TON / 1 TPC
        </div>
        <div className="text-center text-sm">
          Remaining Tokens in Current Round:{' '}
          {status ? status.remainingTokens.toLocaleString() : '...'}
        </div>
        <div className="text-center text-sm">
          Max TPC you can buy per wallet:{' '}
          {MAX_TPC_PER_WALLET.toLocaleString()} TPC
        </div>
        <input
          type="number"
          placeholder="TON to spend"
          value={amountTon}
          onChange={(e) => setAmountTon(e.target.value)}
          className="w-full p-1 text-black rounded"
        />
        <button onClick={handleBuy} className="buy-button w-full">
          Buy TPC
        </button>
      </div>
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
