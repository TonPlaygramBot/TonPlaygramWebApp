import { useEffect, useState, useRef } from 'react';
import SpinWheel, { SpinWheelHandle } from '../components/SpinWheel.tsx';
import RewardPopup from '../components/RewardPopup.tsx';
import AdModal from '../components/AdModal.tsx';
import { canSpin, nextSpinTime } from '../utils/rewardLogic';
import {
  getWalletBalance,
  updateBalance,
  addTransaction
} from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from '../components/LoginOptions.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';

export default function SpinPage() {
  useTelegramBackButton();
  let telegramId: number;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }
  const [lastSpin, setLastSpin] = useState<number | null>(null);
  const [reward, setReward] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);

  const wheelRef = useRef<SpinWheelHandle>(null);

  const ready = freeSpins > 0 || canSpin(lastSpin);

  useEffect(() => {
    const ts = localStorage.getItem('lastSpin');
    if (ts) setLastSpin(parseInt(ts, 10));
    const fs = localStorage.getItem('freeSpins');
    if (fs) setFreeSpins(parseInt(fs, 10));
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


  const handleFinish = async (r: number) => {
    let extraSpins = 0;
    if (r === 1600) extraSpins = 1;
    else if (r === 1800) extraSpins = 2;

    if (extraSpins > 0) {
      const total = freeSpins + extraSpins;
      setFreeSpins(total);
      localStorage.setItem('freeSpins', String(total));
    } else {
      const finalReward = r;
      setReward(finalReward);
      const id = telegramId;
      const balRes = await getWalletBalance(id);
      const newBalance = (balRes.balance || 0) + finalReward;
      await updateBalance(id, newBalance);
      await addTransaction(id, finalReward, 'spin');
    }

    const finalCount = freeSpins + extraSpins;
    if (finalCount === 0) {
      const now = Date.now();
      localStorage.setItem('lastSpin', String(now));
      setLastSpin(now);
    }
    if (extraSpins > 0) setReward(r);
    setAdWatched(false);
  };

  const triggerSpin = () => {
    if (spinning) return;
    if (freeSpins === 0) {
      if (!adWatched) {
        setShowAd(true);
        return;
      }
      if (!ready) return;
    }

    if (freeSpins > 0) {
      const remaining = freeSpins - 1;
      setFreeSpins(remaining);
      localStorage.setItem('freeSpins', String(remaining));
    }

    wheelRef.current?.spin();
  };

  const handleAdComplete = () => {
    setAdWatched(true);
    setShowAd(false);
    triggerSpin();
  };

  const spinBtnClass = `px-4 py-1 ${ready ? 'bg-green-600 hover:bg-green-500' : 'bg-primary hover:bg-primary-hover'} text-background text-sm font-bold rounded disabled:bg-gray-500`;

  const formatTime = (ms: number) => {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 space-y-6 flex flex-col items-center text-text">
      <h1 className="text-xl font-bold">Spin &amp; Win</h1>
      <p className="text-sm text-subtext">Try your luck and win rewards!</p>
      <div className="bg-surface border border-border rounded p-4 flex flex-col items-center space-y-2 wide-card">
        <div className="flex justify-center">
          <SpinWheel
            ref={wheelRef}
            onFinish={handleFinish}
            spinning={spinning}
            setSpinning={setSpinning}
            disabled={!ready}
            showButton={false}
          />
        </div>
        <div className="flex space-x-2 mt-4">
          <button
            onClick={triggerSpin}
            className={spinBtnClass}
            disabled={spinning || !ready}
          >
            Spin
          </button>
        </div>
        {!ready && (
          <>
            <p className="text-sm text-text font-semibold">
              Next spin in {formatTime(timeLeft)}
            </p>
            <p className="text-sm text-text">Watch an ad every 15 minutes to get a free spin.</p>
          </>
        )}
      </div>
      <RewardPopup
        reward={reward}
        onClose={() => setReward(null)}
        duration={1500}
        showCloseButton={false}
      />
      <AdModal
        open={showAd}
        onComplete={handleAdComplete}
        onClose={() => setShowAd(false)}
      />
    </div>
  );
}
