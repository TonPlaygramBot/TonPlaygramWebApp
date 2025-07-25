import { useEffect, useState } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { createAccount, buyTPC, getPresaleStatus, claimPurchase, getAppStats } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import InfoPopup from '../components/InfoPopup.jsx';
import TonConnectButton from '../components/TonConnectButton.jsx';
import { calculateTpcAmount } from '../utils/buyLogic.js';
import { STORE_ADDRESS, PRESALE_ROUNDS, PRESALE_START } from '../utils/storeData.js';
import { MAX_TPC_PER_WALLET } from '../config.js';
import { FaCubes, FaWallet } from 'react-icons/fa';

export default function Store() {
  useTelegramBackButton();
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  const [accountId, setAccountId] = useState('');
  const [msg, setMsg] = useState('');
  const [claimHash, setClaimHash] = useState('');
  const [amountTon, setAmountTon] = useState('');
  const [tpcAmount, setTpcAmount] = useState('');
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    let id;
    try {
      id = getTelegramId();
    } catch {}
    createAccount(id).then((acc) => setAccountId(acc.accountId));
    getPresaleStatus().then(setStatus);
    getAppStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    setTpcAmount(calculateTpcAmount(amountTon, status?.currentPrice));
  }, [amountTon, status]);

  useEffect(() => {
    if (!status) return;
    const duration = 4 * 7 * 24 * 60 * 60 * 1000;
    const update = () => {
      const start = new Date(PRESALE_START).getTime() + duration * (status.currentRound - 1);
      const end = start + duration;
      setTimeLeft(end - Date.now());
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [status]);

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

  function formatTime(ms) {
    if (!ms || ms <= 0) return '0d 0h 0m';
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center min-h-screen bg-surface">
      <img src="/assets/icons/TonPlayGramLogo.webp" alt="TonPlaygram" className="w-16" />
      <p className="text-brand-gold text-xs tracking-widest">PLAY. EARN. DOMINATE.</p>
      <h2 className="text-2xl font-bold">Buy TPC</h2>
      <div className="store-info-bar">
        <div className="flex items-center space-x-1">
          <img src="/assets/icons/TON.webp" alt="TON" className="w-4 h-4" />
          <span>Current Price: {status ? status.currentPrice : '...'} TON / 1 TPC</span>
        </div>
        <div className="flex items-center space-x-1">
          <FaCubes />
          <span>{status ? status.remainingTokens.toLocaleString() : '...'} left</span>
        </div>
        <div className="flex items-center space-x-1">
          <FaWallet />
          <span>Max {MAX_TPC_PER_WALLET.toLocaleString()}</span>
        </div>
        <div className="flex items-center space-x-1">
          <span>Stage ends in {formatTime(timeLeft)}</span>
        </div>
        <div className="flex items-center space-x-1">
          <span>Total Raised: {stats ? stats.tonRaised.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '...'} TON</span>
        </div>
      </div>
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
      </div>
      <div className="store-card space-y-1 max-w-md">
        <h3 className="font-semibold text-center">Other Stages</h3>
        {PRESALE_ROUNDS.filter(r => status && r.round !== status.currentRound).map(r => (
          <div key={r.round} className="text-xs flex justify-between px-2">
            <span>Stage {r.round}</span>
            <span>{r.pricePerTPC} TON</span>
          </div>
        ))}
      </div>
      <div className="prism-box p-4 space-y-2 w-full max-w-md">
        <h3 className="text-center font-semibold">Claim Your Purchase</h3>
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
