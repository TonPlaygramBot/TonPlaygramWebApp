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
  const [spinningMain, setSpinningMain] = useState(false);
  const [spinningLeft, setSpinningLeft] = useState(false);
  const [spinningMiddle, setSpinningMiddle] = useState(false);
  const spinning = spinningMain || spinningLeft || spinningMiddle;
  const [multiplier, setMultiplier] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);

  const mainRef = useRef<SpinWheelHandle>(null);
  const leftRef = useRef<SpinWheelHandle>(null);
  const middleRef = useRef<SpinWheelHandle>(null);

  const ready = canSpin(lastSpin);

  useEffect(() => {
    const ts = localStorage.getItem('lastSpin');
    if (ts) setLastSpin(parseInt(ts, 10));
  }, []);

  useEffect(() => {
    if (ready && !adWatched) {
      setShowAd(true);
    }
  }, [ready, adWatched]);

  const handleFinish = async (r: number) => {
    const now = Date.now();
    localStorage.setItem('lastSpin', String(now));
    setLastSpin(now);
    const finalReward = multiplier ? r * 3 : r;
    setReward(finalReward);
    const id = telegramId;
    const balRes = await getWalletBalance(id);
    const newBalance = (balRes.balance || 0) + finalReward;
    await updateBalance(id, newBalance);
    await addTransaction(id, finalReward, 'spin');
  };

  const triggerSpin = () => {
    if (!adWatched) {
      setShowAd(true);
      return;
    }
    if (spinning || !ready) return;
    if (multiplier) {
      leftRef.current?.spin();
      middleRef.current?.spin();
    }
    mainRef.current?.spin();
  };

  const handleAdComplete = () => {
    setAdWatched(true);
    setShowAd(false);
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
            className="px-4 py-1 bg-primary hover:bg-primary-hover text-background text-sm font-bold rounded disabled:bg-gray-500"
            disabled={spinning || !ready || !adWatched}
          >
            Spin
          </button>
          <button
            onClick={() => setMultiplier(m => !m)}
            className="px-4 py-1 bg-primary hover:bg-primary-hover text-background text-sm font-bold rounded"
            disabled={spinning || !ready || !adWatched}
          >
            x3
          </button>
        </div>
        {!ready && (
          <>
            <p className="text-sm text-text font-semibold">Next spin at {new Date(nextSpinTime(lastSpin)).toLocaleTimeString()}</p>
            <button className="text-text underline text-sm" onClick={() => setShowAd(true)}>
              Watch an ad every hour to get a free spin.
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
