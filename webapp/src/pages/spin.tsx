import { useEffect, useState } from 'react';
import SpinWheel from '../components/SpinWheel.tsx';
import RewardPopup from '../components/RewardPopup.tsx';
import AdModal from '../components/AdModal.tsx';
import { canSpin, nextSpinTime } from '../utils/rewardLogic';
import {
  getWalletBalance,
  updateBalance,
  addTransaction
} from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function SpinPage() {
  const [lastSpin, setLastSpin] = useState<number | null>(null);
  const [reward, setReward] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [showAd, setShowAd] = useState(false);

  useEffect(() => {
    const ts = localStorage.getItem('lastSpin');
    if (ts) setLastSpin(parseInt(ts, 10));
  }, []);

  const handleFinish = async (r: number) => {
    const now = Date.now();
    localStorage.setItem('lastSpin', String(now));
    setLastSpin(now);
    setReward(r);
    const id = getTelegramId();
    const balRes = await getWalletBalance(id);
    const newBalance = (balRes.balance || 0) + r;
    await updateBalance(id, newBalance);
    await addTransaction(id, r, 'spin');
  };

  const ready = canSpin(lastSpin);

  return (
    <div className="p-4 space-y-6 flex flex-col items-center text-text">
      <div className="bg-surface border border-border rounded p-4 flex flex-col items-center space-y-2">
        <SpinWheel
          onFinish={handleFinish}
          spinning={spinning}
          setSpinning={setSpinning}
          disabled={!ready}
        />
        {!ready && (
          <>
            <p className="text-sm text-white font-semibold">Next spin at {new Date(nextSpinTime(lastSpin)).toLocaleTimeString()}</p>
            <button className="text-white underline text-sm" onClick={() => setShowAd(true)}>
              Watch an ad every hour to get a free spin.
            </button>
          </>
        )}
      </div>
      <RewardPopup reward={reward} onClose={() => setReward(null)} />
      <AdModal open={showAd} onClose={() => setShowAd(false)} />
    </div>
  );
}
