import { useState, useEffect } from 'react';
import DiceRoller from './DiceRoller.jsx';
import RewardPopup from './RewardPopup.tsx';
import AdModal from './AdModal.tsx';
import { numericSegments } from '../utils/rewardLogic';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';
import { getWalletBalance, updateBalance, addTransaction } from '../utils/api.js';

function shuffleRewards() {
  const numbers = [];
  for (let i = 0; i < 9; i++) {
    numbers.push(numericSegments[i % numericSegments.length]);
  }
  const arr = [...numbers, 'FREE_SPIN', 'BONUS_X3'];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return [100, ...arr];
}

const todayKey = () => new Date().toISOString().slice(0, 10);

export default function LuckyNumber() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [rewards, setRewards] = useState(() => shuffleRewards());
  const [selected, setSelected] = useState(null);
  const [reward, setReward] = useState(null);
  const [canRoll, setCanRoll] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [trigger, setTrigger] = useState(0);

  const COOLDOWN = 4 * 60 * 60 * 1000; // 4 hours

  useEffect(() => {
    const last = parseInt(localStorage.getItem('luckyRollTs') || '0', 10);
    setCanRoll(Date.now() - last >= COOLDOWN);
  }, []);

  useEffect(() => {
    const claimed = localStorage.getItem('luckyCard1Claimed') === todayKey();
    if (!claimed) {
      (async () => {
        try {
          const balRes = await getWalletBalance(telegramId);
          const newBalance = (balRes.balance || 0) + 100;
          await updateBalance(telegramId, newBalance);
          await addTransaction(telegramId, 100, 'lucky');
          localStorage.setItem('luckyCard1Claimed', todayKey());
        } catch (e) {}
      })();
    }
  }, [telegramId]);

  const handleRollStart = () => setRolling(true);

  const handleRollEnd = async (values) => {
    setRolling(false);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const idx = Math.min(Math.max(0, sum - 1), rewards.length - 1);
    const prize = rewards[idx];
    setSelected(idx);
    if (typeof prize === 'number') {
      try {
        const balRes = await getWalletBalance(telegramId);
        const newBalance = (balRes.balance || 0) + prize;
        await updateBalance(telegramId, newBalance);
        await addTransaction(telegramId, prize, 'lucky');
      } catch (e) {}
    } else if (prize === 'FREE_SPIN') {
      const fs = parseInt(localStorage.getItem('freeSpins') || '0', 10) + 2;
      localStorage.setItem('freeSpins', String(fs));
      window.dispatchEvent(new Event('freeSpinAwarded'));
      document
        .getElementById('spin-game')
        ?.scrollIntoView({ behavior: 'smooth' });
    } else if (prize === 'BONUS_X3') {
      localStorage.setItem('bonusX3', 'true');
      window.dispatchEvent(new Event('bonusX3Awarded'));
      document
        .getElementById('spin-game')
        ?.scrollIntoView({ behavior: 'smooth' });
    }
    setReward(prize);
    localStorage.setItem('luckyRollTs', String(Date.now()));
    setCanRoll(false);
    setAdWatched(false);
  };

  const handleRollClick = () => {
    if (!canRoll || rolling) return;
    if (!adWatched) {
      setShowAd(true);
      return;
    }
    setTrigger((t) => t + 1);
  };

  const handleAdComplete = () => {
    setAdWatched(true);
    setShowAd(false);
    setTrigger((t) => t + 1);
  };


  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 text-center overflow-hidden wide-card">
      <img
        src="/assets/icons/lucky_card_bg.webp"
        className="absolute inset-0 w-full h-full object-cover -z-10 pointer-events-none"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <h3 className="text-lg font-bold text-text">Lucky Number</h3>
      <div className="grid grid-cols-3 gap-2 justify-items-center">
        {rewards.map((val, i) => (
          <div
            key={i}
            className={`board-style w-24 h-24 flex flex-col items-center justify-center rounded relative ${selected === i ? 'border-4 border-brand-gold' : 'border-2 border-border'}`}
          >
            {(i !== 0 && selected !== i) ? (
              <>
                <img
                  src="/assets/icons/TonPlayGramLogo_2_512x512.webp"
                  alt="Logo"
                  className="absolute inset-0 w-full h-full object-contain opacity-40"
                />
                <span className="relative z-10 text-xl font-bold">{i + 1}</span>
              </>
            ) : (
              <>
                {val === 'FREE_SPIN' ? (
                  <>
                    <img
                      src="/assets/icons/file_00000000ae68620a96d269fe76d158e5_256x256.webp"
                      alt="Free Spin"
                      className="w-8 h-8"
                    />
                    <span className="font-bold">+2</span>
                  </>
                ) : val === 'BONUS_X3' ? (
                  <>
                    <img
                      src="/assets/icons/file_000000009160620a96f728f463de1c3f.webp"
                      alt="Bonus"
                      className="w-8 h-8"
                    />
                    <span className="font-bold">X3</span>
                  </>
                ) : (
                  <>
                    <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-8 h-8" />
                    <span className="font-bold">{val}</span>
                    {i === 0 && <span className="text-red-500 text-xs">FREE</span>}
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center space-y-2 mt-6">
        <div
          onClick={handleRollClick}
          className={canRoll ? 'cursor-pointer' : 'cursor-not-allowed'}
        >
          <DiceRoller
            onRollEnd={handleRollEnd}
            onRollStart={handleRollStart}
            showButton={false}
            clickable={false}
            trigger={trigger}
            className="lucky-dice"
          />
        </div>
        {!canRoll && (
          <p className="text-sm text-subtext">You can roll again every 4 hours.</p>
        )}
      </div>
      <AdModal
        open={showAd}
        onComplete={handleAdComplete}
        onClose={() => setShowAd(false)}
      />
      <RewardPopup
        reward={reward}
        onClose={() => {
          setReward(null);
          setSelected(null);
          setRewards(shuffleRewards());
        }}
      />
    </div>
  );
}
