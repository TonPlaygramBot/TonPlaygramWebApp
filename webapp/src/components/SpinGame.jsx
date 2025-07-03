import { useEffect, useState, useRef } from 'react';
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
import LoginOptions from './LoginOptions.jsx';

export default function SpinGame() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }
  const [lastSpin, setLastSpin] = useState(null);
  const [reward, setReward] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const wheelRef = useRef(null);
  const [showAd, setShowAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const ts = localStorage.getItem('lastSpin');
    if (ts) setLastSpin(parseInt(ts, 10));
  }, []);

  useEffect(() => {
    const update = () => {
      const t = nextSpinTime(lastSpin) - Date.now();
      setTimeLeft(t > 0 ? t : 0);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastSpin]);

  useEffect(() => {
    const r = canSpin(lastSpin);
    if (r && !adWatched) {
      setShowAd(true);
    }
  }, [lastSpin, adWatched]);

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
    setAdWatched(false);
  };

  const handleAdComplete = () => {
    setAdWatched(true);
    setShowAd(false);
  };

  const triggerSpin = () => {
    if (!adWatched) {
      setShowAd(true);
      return;
    }
    if (spinning || !ready) return;
    wheelRef.current?.spin();
  };

  const formatTime = (ms) => {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const ready = canSpin(lastSpin);
  const spinBtnClass = `mt-4 px-4 py-1 ${ready && adWatched ? 'bg-green-600 hover:bg-green-500' : 'bg-primary hover:bg-primary-hover'} text-background text-sm font-bold rounded disabled:bg-gray-500`;

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 flex flex-col items-center space-y-2 overflow-hidden">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
      />
      <h3 className="text-lg font-bold text-text">Spin &amp; Win</h3>
      <p className="text-sm text-subtext">Try your luck and win rewards!</p>
      <SpinWheel
        ref={wheelRef}
        onFinish={handleFinish}
        spinning={spinning}
        setSpinning={setSpinning}
        disabled={!ready}
        showButton={false}
      />
      <button
        onClick={triggerSpin}
        className={spinBtnClass}
        disabled={spinning || !ready || !adWatched}
      >
        Spin
      </button>
      {!ready && (
        <>
          <p className="text-sm text-white font-semibold">
            Next spin in {formatTime(timeLeft)}
          </p>
          <button
            className="text-white underline text-sm"
            onClick={() => setShowAd(true)}
          >
            Watch an ad every 15 minutes to get a free spin.
          </button>
        </>
      )}
      <RewardPopup
        reward={reward}
        onClose={() => setReward(null)}
        message="Keep spinning every day to earn more!"
      />
      <AdModal open={showAd} onClose={() => setShowAd(false)} onComplete={handleAdComplete} />
    </div>
  );
}
