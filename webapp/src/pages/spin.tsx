import { useEffect, useState, useRef } from 'react';
import SpinWheel, { SpinWheelHandle } from '../components/SpinWheel.tsx';
import RewardPopup from '../components/RewardPopup.tsx';
import AdModal from '../components/AdModal.tsx';
import { canSpin, nextSpinTime, Segment } from '../utils/rewardLogic';
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
  const [reward, setReward] = useState<Segment | null>(null);
  const [spinningMain, setSpinningMain] = useState(false);
  const [spinningLeft, setSpinningLeft] = useState(false);
  const [spinningMiddle, setSpinningMiddle] = useState(false);
  const spinning = spinningMain || spinningLeft || spinningMiddle;
  const [multiplier, setMultiplier] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [freeSpins, setFreeSpins] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const mainRef = useRef<SpinWheelHandle>(null);
  const leftRef = useRef<SpinWheelHandle>(null);
  const middleRef = useRef<SpinWheelHandle>(null);

  const ready = canSpin(lastSpin);

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


  const usingFreeSpinRef = useRef(false);

  const handleFinish = async (r: Segment) => {
    if (!usingFreeSpinRef.current) {
      const now = Date.now();
      localStorage.setItem('lastSpin', String(now));
      setLastSpin(now);
      setAdWatched(false);
    }

    if (r.type === 'tpc') {
      const finalReward = multiplier ? r.value * 3 : r.value;
      setReward({ type: 'tpc', value: finalReward });
      const id = telegramId;
      const balRes = await getWalletBalance(id);
      const newBalance = (balRes.balance || 0) + finalReward;
      await updateBalance(id, newBalance);
      await addTransaction(id, finalReward, 'spin');
    } else {
      setReward({ type: 'spin', value: r.value });
      setFreeSpins(fs => fs + r.value);
    }
    usingFreeSpinRef.current = false;
  };

  const triggerSpin = () => {
    if (spinning) return;

    if (freeSpins === 0) {
      if (!ready) return;
      if (!adWatched) {
        setShowAd(true);
        return;
      }
    } else {
      usingFreeSpinRef.current = true;
      setFreeSpins(fs => fs - 1);
    }

    if (multiplier && freeSpins === 0) {
      leftRef.current?.spin();
      middleRef.current?.spin();
    }
    mainRef.current?.spin();
  };

  const handleAdComplete = () => {
    setAdWatched(true);
    setShowAd(false);
  };

  const spinBtnClass = `px-4 py-1 ${
    (freeSpins > 0 || (ready && adWatched))
      ? 'bg-green-600 hover:bg-green-500'
      : 'bg-primary hover:bg-primary-hover'
  } text-background text-sm font-bold rounded disabled:bg-gray-500`;

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
      <div className="bg-surface border border-border rounded p-4 flex flex-col items-center space-y-2">
        <div className="flex space-x-4">
          <SpinWheel
            ref={leftRef}
            onFinish={() => {}}
            spinning={spinningLeft}
            setSpinning={setSpinningLeft}
            disabled={!ready}
            showButton={false}
          />
          <SpinWheel
            ref={mainRef}
            onFinish={handleFinish}
            spinning={spinningMain}
            setSpinning={setSpinningMain}
            disabled={!ready}
            showButton={false}
          />
          <SpinWheel
            ref={middleRef}
            onFinish={() => {}}
            spinning={spinningMiddle}
            setSpinning={setSpinningMiddle}
            disabled={!ready}
            showButton={false}
          />
        </div>
        <div className="flex space-x-2 mt-4">
          <button
            onClick={triggerSpin}
            className={spinBtnClass}
            disabled={spinning || (freeSpins === 0 && (!ready || !adWatched))}
          >
            Spin
          </button>
          <button
            onClick={() => setMultiplier(m => !m)}
            className="px-4 py-1 bg-primary hover:bg-primary-hover text-background text-sm font-bold rounded"
            disabled={spinning || (freeSpins === 0 && (!ready || !adWatched))}
          >
            x3
          </button>
        </div>
        {freeSpins > 0 && (
          <p className="text-sm text-text font-semibold">Free spins left: {freeSpins}</p>
        )}
        {!ready && (
          <>
            <p className="text-sm text-text font-semibold">
              Next spin in {formatTime(timeLeft)}
            </p>
            <button className="text-text underline text-sm" onClick={() => setShowAd(true)}>
              Watch an ad every 15 minutes to get a free spin.
            </button>
          </>
        )}
      </div>
      <RewardPopup
        reward={reward}
        onClose={() => setReward(null)}
        message="Keep spinning every day to earn more!"
      />
      <AdModal open={showAd} onClose={() => setShowAd(false)} onComplete={handleAdComplete} />
    </div>
  );
}
