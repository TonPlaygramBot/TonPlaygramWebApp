import { useEffect, useState, useRef } from 'react';
import SpinWheel, { SpinWheelHandle } from '../components/SpinWheel.tsx';
import BonusAnimation from '../components/BonusAnimation.tsx';
import type { Segment } from '../utils/rewardLogic';
import RewardPopup from '../components/RewardPopup.tsx';
import AdModal from '../components/AdModal.tsx';
import { canSpin, nextSpinTime, numericSegments } from '../utils/rewardLogic';
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
  const [showAd, setShowAd] = useState(false);
  const ONE_HOUR = 60 * 60 * 1000;
  const [adWatched, setAdWatched] = useState(() => {
    const ts = localStorage.getItem('lastSpinAd');
    return ts ? Date.now() - parseInt(ts, 10) < ONE_HOUR : false;
  });
  const [timeLeft, setTimeLeft] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);

  const [bonusMode, setBonusMode] = useState(false);
  const [leftReward, setLeftReward] = useState<number | null>(null);
  const [rightReward, setRightReward] = useState<number | null>(null);
  const [spinningLeft, setSpinningLeft] = useState(false);
  const [spinningRight, setSpinningRight] = useState(false);
  const [showBonusAnim, setShowBonusAnim] = useState(false);
  const [bonusVisible, setBonusVisible] = useState(false);

  const mainRef = useRef<SpinWheelHandle>(null);
  const leftRef = useRef<SpinWheelHandle>(null);
  const rightRef = useRef<SpinWheelHandle>(null);

  const globalSpinning = spinningMain || spinningLeft || spinningRight;

  useEffect(() => {
    if (bonusMode) {
      leftRef.current?.spin();
      rightRef.current?.spin();
    }
  }, [bonusMode]);

  useEffect(() => {
    if (
      bonusMode &&
      leftReward !== null &&
      rightReward !== null &&
      !spinningLeft &&
      !spinningRight
    ) {
      finalizeReward(leftReward + rightReward);
      setLeftReward(null);
      setRightReward(null);
      setBonusMode(false);
      setBonusVisible(false);
    }
  }, [bonusMode, leftReward, rightReward, spinningLeft, spinningRight]);

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


  const finalizeReward = async (amount: number) => {
    setReward(amount);
    const id = telegramId;
    const balRes = await getWalletBalance(id);
    const newBalance = (balRes.balance || 0) + amount;
    await updateBalance(id, newBalance);
    await addTransaction(id, amount, 'spin');
    const now = Date.now();
    localStorage.setItem('lastSpin', String(now));
    setLastSpin(now);
  };

    const handleFinish = async (r: Segment) => {
      if (r === 'BONUS_X3') {
        setBonusMode(true);
        setBonusVisible(false);
        setShowBonusAnim(true);
        setLeftReward(null);
        setRightReward(null);
        return;
      }

      let extraSpins = 0;
      if (r === 'FREE_SPIN') extraSpins = 2;

      if (extraSpins > 0) {
        const total = freeSpins + extraSpins;
        setFreeSpins(total);
        localStorage.setItem('freeSpins', String(total));
      } else {
        if (typeof r === 'number') await finalizeReward(r as number);
      }

      const finalCount = freeSpins + extraSpins;
      if (finalCount === 0) {
        const now = Date.now();
        localStorage.setItem('lastSpin', String(now));
        setLastSpin(now);
      }
      setReward(r);
    };

  const handleLeftFinish = (val: Segment) => {
    if (typeof val === 'number') setLeftReward(val);
  };

  const handleRightFinish = (val: Segment) => {
    if (typeof val === 'number') setRightReward(val);
  };

  const triggerSpin = () => {
    if (globalSpinning) return;
    if (freeSpins === 0) {
      const ts = parseInt(localStorage.getItem('lastSpinAd') || '0', 10);
      const adValid = Date.now() - ts < ONE_HOUR;
      if (!adValid) setAdWatched(false);
      if (!adValid || !adWatched) {
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

    mainRef.current?.spin();
  };

  const handleAdComplete = () => {
    const now = Date.now();
    localStorage.setItem('lastSpinAd', String(now));
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
          {bonusMode && (
            <div className={bonusVisible ? '' : 'invisible'}>
              <SpinWheel
                ref={leftRef}
                onFinish={handleLeftFinish}
                spinning={spinningLeft}
                setSpinning={setSpinningLeft}
                disabled={!ready}
                showButton={false}
                segments={numericSegments}
              />
            </div>
          )}
          <SpinWheel
            ref={mainRef}
            onFinish={handleFinish}
            spinning={spinningMain}
            setSpinning={setSpinningMain}
            disabled={!ready}
            showButton={false}
            segments={bonusMode ? numericSegments : undefined}
          />
          {bonusMode && (
            <div className={bonusVisible ? '' : 'invisible'}>
              <SpinWheel
                ref={rightRef}
                onFinish={handleRightFinish}
                spinning={spinningRight}
                setSpinning={setSpinningRight}
                disabled={!ready}
                showButton={false}
                segments={numericSegments}
              />
            </div>
          )}
        </div>
        <div className="flex space-x-2 mt-4">
          <button
            onClick={triggerSpin}
            className={spinBtnClass}
            disabled={globalSpinning || !ready}
          >
            Spin
          </button>
        </div>
        {!ready && (
          <>
            <p className="text-sm text-text font-semibold">
              Next spin in {formatTime(timeLeft)}
            </p>
            <p className="text-sm text-text">Watch an ad every hour to get a free spin.</p>
          </>
        )}
      </div>
      <RewardPopup
        reward={reward}
        onClose={() => setReward(null)}
        duration={1500}
        showCloseButton={false}
      />
      <BonusAnimation
        show={showBonusAnim}
        onComplete={() => {
          setBonusVisible(true);
          setShowBonusAnim(false);
        }}
      />
      <AdModal
        open={showAd}
        onComplete={handleAdComplete}
        onClose={() => setShowAd(false)}
      />
    </div>
  );
}
