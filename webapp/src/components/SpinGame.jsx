import { useEffect, useState } from 'react';
import SpinWheel from './SpinWheel.tsx';
import RewardPopup from './RewardPopup.tsx';
import { canSpin, nextSpinTime } from '../utils/rewardLogic';
import AdModal from './AdModal.tsx';
import DailyCheckIn from './DailyCheckIn.jsx';
import {
  getWalletBalance,
  updateBalance,
  addTransaction
} from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import OpenInTelegram from './OpenInTelegram.jsx';

export default function SpinGame() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }
  const [lastSpin, setLastSpin] = useState(null);
  const [reward, setReward] = useState(null);
  const [extraSpins, setExtraSpins] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [showAd, setShowAd] = useState(false);

  useEffect(() => {
    const ts = localStorage.getItem('lastSpin');
    if (ts) setLastSpin(parseInt(ts, 10));
  }, []);

  const handleFinish = async (r) => {
    if (r.spins) {
      setExtraSpins(s => s + r.spins);
      setReward(r);
      return;
    }
    const now = Date.now();
    localStorage.setItem('lastSpin', String(now));
    setLastSpin(now);
    const base = r.tpc || 0;
    setReward({ tpc: base });
    const id = telegramId;
    const balRes = await getWalletBalance(id);
    const newBalance = (balRes.balance || 0) + base;
    await updateBalance(id, newBalance);
    await addTransaction(id, base, 'spin');
  };

  const ready = canSpin(lastSpin, extraSpins);

  return (
    <div className="bg-surface border border-border rounded p-4 flex flex-col items-center space-y-2">
      <h3 className="text-lg font-bold text-text">Spin &amp; Win</h3>
      <p className="text-sm text-subtext">Try your luck and win rewards!</p>
      <SpinWheel
        onFinish={handleFinish}
        spinning={spinning}
        setSpinning={setSpinning}
        disabled={!ready}
      />
      {extraSpins > 0 && (
        <p className="text-sm text-white font-semibold">Free spins left: {extraSpins}</p>
      )}
      {!ready && (
        <>
          <p className="text-sm text-white font-semibold">
            Next spin at {new Date(nextSpinTime(lastSpin)).toLocaleTimeString()}
          </p>
          <button
            className="text-white underline text-sm"
            onClick={() => setShowAd(true)}
          >
            Watch an ad every hour to get a free spin.
          </button>
        </>
      )}
      <DailyCheckIn />
      <RewardPopup
        reward={reward}
        onClose={() => setReward(null)}
        message="Keep spinning every day to earn more!"
      />
      <AdModal open={showAd} onClose={() => setShowAd(false)} />
    </div>
  );
}
