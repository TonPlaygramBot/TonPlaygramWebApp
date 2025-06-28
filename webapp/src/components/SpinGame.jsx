import { useEffect, useState } from 'react';
import SpinWheel from './SpinWheel.tsx';
import RewardPopup from './RewardPopup.tsx';
import AdModal from './AdModal.tsx';
import { canSpin, nextSpinTime } from '../utils/rewardLogic';
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
  const [spinning, setSpinning] = useState(false);
  const [showAd, setShowAd] = useState(false);

  useEffect(() => {
    const ts = localStorage.getItem('lastSpin');
    if (ts) setLastSpin(parseInt(ts, 10));
  }, []);

  const handleFinish = async (r) => {
    const now = Date.now();
    localStorage.setItem('lastSpin', String(now));
    setLastSpin(now);
    setReward(r);
    const id = telegramId;
    const balRes = await getWalletBalance(id);
    const newBalance = (balRes.balance || 0) + r;
    await updateBalance(id, newBalance);
    await addTransaction(id, r, 'spin');
  };

  const ready = canSpin(lastSpin);

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 flex flex-col items-center space-y-2">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
      />
      <h3 className="text-lg font-bold text-text">Spin &amp; Win</h3>
      <p className="text-sm text-subtext">Try your luck and win rewards!</p>
      <SpinWheel
        onFinish={handleFinish}
        spinning={spinning}
        setSpinning={setSpinning}
        disabled={!ready}
      />
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
      <RewardPopup
        reward={reward}
        onClose={() => setReward(null)}
        message="Keep spinning every day to earn more!"
      />
      <AdModal open={showAd} onClose={() => setShowAd(false)} />
    </div>
  );
}
