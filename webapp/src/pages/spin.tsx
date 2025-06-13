import { useEffect, useState } from 'react';
import { useTonWallet } from '@tonconnect/ui-react';
import SpinWheel from '../components/SpinWheel.tsx';
import RewardPopup from '../components/RewardPopup.tsx';
import AdModal from '../components/AdModal.tsx';
import { canSpin, nextSpinTime } from '../utils/rewardLogic';
import { getWalletBalance, getTonBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function SpinPage() {
  const [lastSpin, setLastSpin] = useState<number | null>(null);
  const [reward, setReward] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [tpcBalance, setTpcBalance] = useState<number | null>(null);
  const wallet = useTonWallet();

  function loadBalance() {
    getWalletBalance(getTelegramId()).then((prof) => setTpcBalance(prof.balance));
    if (wallet?.account?.address) {
      getTonBalance(wallet.account.address).then(() => {});
    }
  }

  useEffect(() => {
    const ts = localStorage.getItem('lastSpin');
    if (ts) setLastSpin(parseInt(ts, 10));
    loadBalance();
  }, []);

  useEffect(() => {
    loadBalance();
  }, [wallet]);

  const handleFinish = (r: number) => {
    const now = Date.now();
    localStorage.setItem('lastSpin', String(now));
    setLastSpin(now);
    setReward(r);
  };

  const ready = canSpin(lastSpin);

  return (
    <div className="starry-bg min-h-screen flex flex-col items-center pt-8 space-y-6 text-text">
      <div className="text-yellow-400 text-lg">
        Balance {tpcBalance === null ? '...' : tpcBalance} TPC
      </div>
      <SpinWheel
        onFinish={handleFinish}
        spinning={spinning}
        setSpinning={setSpinning}
        disabled={!ready}
      />
      {!ready && (
        <>
          <p className="text-sm text-yellow-400">Next spin at {new Date(nextSpinTime(lastSpin)).toLocaleTimeString()}</p>
          <button className="text-yellow-400 underline text-sm" onClick={() => setShowAd(true)}>
            Watch an ad every hour to get a free spin.
          </button>
        </>
      )}
      <RewardPopup reward={reward} onClose={() => setReward(null)} />
      <AdModal open={showAd} onClose={() => setShowAd(false)} />
    </div>
  );
}
