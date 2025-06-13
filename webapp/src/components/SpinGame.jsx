import { useEffect, useState } from 'react';
import SpinWheel from './SpinWheel.tsx';
import RewardPopup from './RewardPopup.tsx';
import AdModal from './AdModal.tsx';
import { canSpin, nextSpinTime } from '../utils/rewardLogic';

export default function SpinGame() {
  const [lastSpin, setLastSpin] = useState(null);
  const [reward, setReward] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [showAd, setShowAd] = useState(false);

  useEffect(() => {
    const ts = localStorage.getItem('lastSpin');
    if (ts) setLastSpin(parseInt(ts, 10));
  }, []);

  const handleFinish = (r) => {
    const now = Date.now();
    localStorage.setItem('lastSpin', String(now));
    setLastSpin(now);
    setReward(r);
  };

  const ready = canSpin(lastSpin);

  return (
    <div className="bg-gray-800 rounded p-4 flex flex-col items-center space-y-2">
      <div className="text-yellow-400 text-lg">Balance 9.87 M TPC</div>
      <SpinWheel
        onFinish={handleFinish}
        spinning={spinning}
        setSpinning={setSpinning}
        disabled={!ready}
      />
      {!ready && (
        <>
          <p className="text-sm text-yellow-400">
            Next spin at {new Date(nextSpinTime(lastSpin)).toLocaleTimeString()}
          </p>
          <button
            className="text-yellow-400 underline text-sm"
            onClick={() => setShowAd(true)}
          >
            Watch an ad every hour to get a free spin.
          </button>
        </>
      )}
      <RewardPopup reward={reward} onClose={() => setReward(null)} />
      <AdModal open={showAd} onClose={() => setShowAd(false)} />
    </div>
  );
}
