import { useEffect, useState, useRef } from 'react';
import SpinWheel from './SpinWheel.tsx';
import RewardPopup from './RewardPopup.tsx';
import SpinRewardVideo from './SpinRewardVideo.tsx';
import { canSpin, nextSpinTime, numericSegments } from '../utils/rewardLogic';
import { creditSpinReward } from '../utils/creditSpinReward.js';
import { getTelegramId } from '../utils/telegram.js';
import { getGameVolume } from '../utils/sound.js';
import LoginOptions from './LoginOptions.jsx';

export default function SpinGame({ reelUrl = null }) {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }
  const [lastSpin, setLastSpin] = useState(null);
  const [reward, setReward] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [bonusMode, setBonusMode] = useState(false);
  const bonusResults = useRef([]);
  const [crediting, setCrediting] = useState(false);
  const [creditFailed, setCreditFailed] = useState(false);
  const [freeSpins, setFreeSpins] = useState(0);
  const [spinLock, setSpinLock] = useState(
    localStorage.getItem('spinInProgress') === '1'
  );
  const [timeLeft, setTimeLeft] = useState(0);
  const wheelRef = useRef(null);
  const bonusRefLeft = useRef(null);
  const bonusRefRight = useRef(null);
  const [bombed, setBombed] = useState(false);
  const bombSoundRef = useRef(null);

  useEffect(() => {
    bombSoundRef.current = new Audio('/assets/sounds/a-bomb-139689.mp3');
    bombSoundRef.current.volume = getGameVolume();
    const handler = () => {
      if (bombSoundRef.current) bombSoundRef.current.volume = getGameVolume();
    };
    window.addEventListener('gameVolumeChanged', handler);
    return () => {
      window.removeEventListener('gameVolumeChanged', handler);
      bombSoundRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (bombed) {
      bombSoundRef.current?.play().catch(() => {});
    }
  }, [bombed]);

  useEffect(() => {
    const handleFs = () => {
      const fs = parseInt(localStorage.getItem('freeSpins') || '0', 10);
      setFreeSpins(fs);
      document
        .getElementById('spin-game')
        ?.scrollIntoView({ behavior: 'smooth' });
    };
    window.addEventListener('freeSpinAwarded', handleFs);
    return () => window.removeEventListener('freeSpinAwarded', handleFs);
  }, []);

  useEffect(() => {
    const handleBonus = () => {
      if (localStorage.getItem('bonusX3') === 'true') {
        setBonusMode(true);
        localStorage.removeItem('bonusX3');
        document
          .getElementById('spin-game')
          ?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    window.addEventListener('bonusX3Awarded', handleBonus);
    handleBonus();
    return () => window.removeEventListener('bonusX3Awarded', handleBonus);
  }, []);

  useEffect(() => {
    const ts = localStorage.getItem('lastSpin');
    if (ts) setLastSpin(parseInt(ts, 10));
    const fs = localStorage.getItem('freeSpins');
    if (fs) setFreeSpins(parseInt(fs, 10));
    const sl = localStorage.getItem('spinInProgress');
    if (sl) setSpinLock(sl === '1');

    const handleStorage = (e) => {
      if (e.key === 'lastSpin') {
        setLastSpin(e.newValue ? parseInt(e.newValue, 10) : null);
      } else if (e.key === 'freeSpins') {
        setFreeSpins(e.newValue ? parseInt(e.newValue, 10) : 0);
      } else if (e.key === 'spinInProgress') {
        setSpinLock(e.newValue === '1');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
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
    if (bonusMode) {
      bonusResults.current = [];
      setSpinning(true);
      wheelRef.current?.spin();
      bonusRefLeft.current?.spin();
      bonusRefRight.current?.spin();
    }
  }, [bonusMode]);

  const awardCoins = (amount) => {
    setReward(amount);
    setCrediting(true);
    creditSpinReward(telegramId, amount, 'spin')
      .catch(() => setCreditFailed(true))
      .finally(() => setCrediting(false));
  };

  const handleFinish = (r) => {
    localStorage.removeItem('spinInProgress');
    setSpinLock(false);
    if (r === 'BOMB') {
      if (freeSpins === 0) {
        const now = Date.now();
        localStorage.setItem('lastSpin', String(now));
        setLastSpin(now);
      }
      setSpinning(false);
      setBombed(true);
      return;
    }
    if (r === 'BONUS_X3') {
      setBonusMode(true);
      if (freeSpins === 0) {
        const now = Date.now();
        localStorage.setItem('lastSpin', String(now));
        setLastSpin(now);
      }
      return;
    }

    if (r === 'FREE_SPIN') {
      const total = freeSpins + 2;
      setFreeSpins(total);
      localStorage.setItem('freeSpins', String(total));
      setReward(r);
      return;
    }

    if (freeSpins === 0) {
      const now = Date.now();
      localStorage.setItem('lastSpin', String(now));
      setLastSpin(now);
    }
    awardCoins(r);
  };

  const triggerSpin = () => {
    if (spinning || spinLock || bonusMode || crediting) return;

    const storedFree = parseInt(localStorage.getItem('freeSpins') || '0', 10);

    // Opening/playing an Instagram Reel cannot verify a reward entitlement.
    if (!(storedFree > 0)) return;

    const remaining = storedFree - 1;
    setFreeSpins(remaining);
    localStorage.setItem('freeSpins', String(remaining));

    localStorage.setItem('spinInProgress', '1');
    setSpinLock(true);
    setSpinning(true);
    setCreditFailed(false);
    wheelRef.current?.spin();
  };

  const formatTime = (ms) => {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleBonusFinish = (value) => {
    bonusResults.current.push(value);
    if (bonusResults.current.length !== 3) return;

    localStorage.removeItem('spinInProgress');
    setSpinLock(false);
    const total = bonusResults.current.reduce((sum, prize) => sum + prize, 0);
    awardCoins(total);
    setBonusMode(false);
    setSpinning(false);
  };

  const ready = freeSpins > 0 || canSpin(lastSpin);

  return (
    <div
      id="spin-game"
      className="relative bg-surface border border-border rounded-xl p-4 flex flex-col items-center space-y-2 overflow-hidden wide-card"
    >
      <img
        src="/assets/icons/snakes_and_ladders.webp"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <h3 className="text-lg font-bold text-white">Spin &amp; Win</h3>
      <SpinRewardVideo reelUrl={reelUrl} />
      <p className="text-sm text-subtext">Instagram Reels are optional. Reel-based spin rewards are paused.</p>
      {!bonusMode ? (
        <div key="single-wheel" className="flex items-start justify-center">
          <SpinWheel
            ref={wheelRef}
            onFinish={handleFinish}
            spinning={spinning}
            setSpinning={setSpinning}
            disabled={!ready}
            showButton={false}
          />
        </div>
      ) : (
        <div key="bonus-wheels" className="flex items-start justify-center space-x-2">
          <SpinWheel
            ref={bonusRefLeft}
            onFinish={handleBonusFinish}
            spinning={spinning}
            setSpinning={() => {}}
            segments={numericSegments}
            showButton={false}
          />
          <SpinWheel
            ref={wheelRef}
            onFinish={handleBonusFinish}
            spinning={spinning}
            setSpinning={() => {}}
            segments={numericSegments}
            showButton={false}
          />
          <SpinWheel
            ref={bonusRefRight}
            onFinish={handleBonusFinish}
            spinning={spinning}
            setSpinning={() => {}}
            segments={numericSegments}
            showButton={false}
          />
        </div>
      )}
      {freeSpins > 0 && (
        <p className="text-xs text-accent font-bold">Free Spins: {freeSpins}</p>
      )}
      <button
        onClick={triggerSpin}
        className={`mt-2 px-6 py-2 ${ready ? 'bg-green-600' : 'bg-red-600'} text-white text-sm font-bold rounded disabled:bg-gray-500`}
        disabled={spinning || spinLock || freeSpins <= 0 || bonusMode || crediting}
      >
        Use free spin
      </button>
      {!ready && (
        <>
          <p className="text-sm font-semibold text-yellow-400 text-outline-black">
            Cooldown: {formatTime(timeLeft)}
          </p>
          <p className="text-sm text-yellow-400 text-outline-black">
            Reel views do not unlock new spins.
          </p>
        </>
      )}
      <RewardPopup
        reward={reward}
        onClose={() => setReward(null)}
      />
      {creditFailed && (
        <p role="status" className="text-sm text-yellow-300">
          Could not confirm the reward in your wallet.
        </p>
      )}
      {bombed && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
          <div className="text-center space-y-4">
            <div className="text-6xl bomb-explosion">💥</div>
            <p className="text-text text-xl font-bold">Try Again Later</p>
            <button
              onClick={() => setBombed(false)}
              className="px-4 py-1 bg-primary hover:bg-primary-hover text-white rounded w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
