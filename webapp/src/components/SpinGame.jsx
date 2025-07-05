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
  const [leftSpinning, setLeftSpinning] = useState(false);
  const [rightSpinning, setRightSpinning] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [freeSpins, setFreeSpins] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const wheelRef = useRef(null);
  const leftWheelRef = useRef(null);
  const rightWheelRef = useRef(null);
  const [bonusActive, setBonusActive] = useState(false);
  const [bonusSpinDone, setBonusSpinDone] = useState(0);

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

  const handleFinish = async (r) => {
    if (r === 'BONUS_X3') {
      setBonusActive(true);
      setAdWatched(false);
      return;
    }
    let extraSpins = 0;
    if (r === 1600) extraSpins = 1;
    else if (r === 1800) extraSpins = 2;
    else if (r === 5000) extraSpins = 3;

    if (extraSpins > 0) {
      const total = freeSpins + extraSpins;
      setFreeSpins(total);
      localStorage.setItem('freeSpins', String(total));
    } else if (typeof r === 'number') {
      const id = telegramId;
      const balRes = await getWalletBalance(id);
      const newBalance = (balRes.balance || 0) + r;
      await updateBalance(id, newBalance);
      await addTransaction(id, r, 'spin');
    }
    const finalCount = freeSpins + extraSpins;
    if (finalCount === 0) {
      const now = Date.now();
      localStorage.setItem('lastSpin', String(now));
      setLastSpin(now);
    }
    setReward(r);
    setAdWatched(false);
  };

  const handleBonusFinish = async (r) => {
    if (typeof r !== 'number') return;
    let extraSpins = 0;
    if (r === 1600) extraSpins = 1;
    else if (r === 1800) extraSpins = 2;
    else if (r === 5000) extraSpins = 3;

    if (extraSpins > 0) {
      const total = freeSpins + extraSpins;
      setFreeSpins(total);
      localStorage.setItem('freeSpins', String(total));
    } else {
      const id = telegramId;
      const balRes = await getWalletBalance(id);
      const newBalance = (balRes.balance || 0) + r;
      await updateBalance(id, newBalance);
      await addTransaction(id, r, 'spin');
    }
    const finalCount = freeSpins + extraSpins;
    if (finalCount === 0) {
      const now = Date.now();
      localStorage.setItem('lastSpin', String(now));
      setLastSpin(now);
    }
    setReward(r);
    setBonusSpinDone((c) => {
      const next = c + 1;
      if (next >= 2) setBonusActive(false);
      return next;
    });
  };

  const triggerSpin = () => {
    if (spinning || leftSpinning || rightSpinning) return;
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

    if (bonusActive) {
      wheelRef.current?.spin();
      leftWheelRef.current?.spin();
      rightWheelRef.current?.spin();
      setBonusSpinDone(0);
    } else {
      wheelRef.current?.spin();
    }
  };

  const handleAdComplete = () => {
    setAdWatched(true);
    setShowAd(false);
    triggerSpin();
  };

  const formatTime = (ms) => {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const ready = freeSpins > 0 || canSpin(lastSpin);

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 flex flex-col items-center space-y-2 overflow-hidden">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
      />
      <h3 className="text-lg font-bold text-text">Spin &amp; Win</h3>
      <p className="text-sm text-subtext">Try your luck and win rewards!</p>
      <div className="flex items-start space-x-0">
        <div className="relative">
          <div style={{ opacity: bonusActive ? 1 : 0.15 }}>
            <SpinWheel
              ref={leftWheelRef}
              onFinish={handleBonusFinish}
              spinning={leftSpinning}
              setSpinning={setLeftSpinning}
              disabled={!bonusActive}
              showButton={false}
            />
          </div>
          {!bonusActive && (
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-red-600 text-center pointer-events-none drop-shadow-[0_0_2px_white]">
              Bonus to Activate
            </span>
          )}
        </div>
        <SpinWheel
          ref={wheelRef}
          onFinish={handleFinish}
          spinning={spinning}
          setSpinning={setSpinning}
          disabled={!ready}
          showButton={false}
        />
        <div className="relative">
          <div style={{ opacity: bonusActive ? 1 : 0.15 }}>
            <SpinWheel
              ref={rightWheelRef}
              onFinish={handleBonusFinish}
              spinning={rightSpinning}
              setSpinning={setRightSpinning}
              disabled={!bonusActive}
              showButton={false}
            />
          </div>
          {!bonusActive && (
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-red-600 text-center pointer-events-none drop-shadow-[0_0_2px_white]">
              Bonus to Activate
            </span>
          )}
        </div>
      </div>
      {freeSpins > 0 && (
        <p className="text-xs text-accent font-bold">Free Spins: {freeSpins}</p>
      )}
      <button
        onClick={triggerSpin}
        className="mt-2 px-4 py-1 bg-green-600 text-white text-sm font-bold rounded disabled:bg-gray-500"
        disabled={spinning || !ready}
      >
        Spin
      </button>
      {!ready && (
        <>
          <p className="text-sm text-white font-semibold">
            Next spin in {formatTime(timeLeft)}
          </p>
          <p className="text-sm text-white">
            Watch an ad every 15 minutes to get a free spin.
          </p>
        </>
      )}
      <RewardPopup
        reward={reward}
        onClose={() => setReward(null)}
        message="Keep spinning every day to earn more!"
      />
      <AdModal open={showAd} onComplete={handleAdComplete} />
    </div>
  );
}
