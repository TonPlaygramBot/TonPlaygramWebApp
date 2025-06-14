import { useEffect, useState, useRef } from 'react';
import SpinWheel, { SpinWheelHandle } from './SpinWheel.tsx';
import RewardPopup from './RewardPopup.tsx';
import AdModal from './AdModal.tsx';
import DailyCheckIn from './DailyCheckIn.jsx';
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
  const [spinningMain, setSpinningMain] = useState(false);
  const [spinningLeft, setSpinningLeft] = useState(false);
  const [spinningMiddle, setSpinningMiddle] = useState(false);
  const spinning = spinningMain || spinningLeft || spinningMiddle;
  const [showAd, setShowAd] = useState(false);

  const mainRef = useRef<SpinWheelHandle>(null);
  const leftRef = useRef<SpinWheelHandle>(null);
  const middleRef = useRef<SpinWheelHandle>(null);

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

  const triggerSpin = () => {
    if (spinning || !ready) return;
    leftRef.current?.spin();
    mainRef.current?.spin();
    middleRef.current?.spin();
  };

  const ready = canSpin(lastSpin);

  return (
    <div className="bg-surface border border-border rounded p-4 flex flex-col items-center space-y-2">
      <h3 className="text-lg font-bold text-text">Spin &amp; Win</h3>
      <p className="text-sm text-subtext">Try your luck and win rewards!</p>
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
      <button
        onClick={triggerSpin}
        className="mt-4 px-4 py-1 bg-green-600 text-white text-sm font-bold rounded disabled:bg-gray-500"
        disabled={spinning || !ready}
      >
        Spin
      </button>
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
