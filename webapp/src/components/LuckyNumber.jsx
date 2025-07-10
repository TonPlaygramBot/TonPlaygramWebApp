import { useState, useEffect } from 'react';
import DiceRoller from './DiceRoller.jsx';
import RewardPopup from './RewardPopup.tsx';
import { segments } from '../utils/rewardLogic';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';
import { getWalletBalance, updateBalance, addTransaction } from '../utils/api.js';

function shuffleRewards() {
  const res = [100];
  for (let i = 1; i < 12; i++) {
    const idx = Math.floor(Math.random() * segments.length);
    res.push(segments[idx]);
  }
  return res;
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
  const [showRewards, setShowRewards] = useState(false);
  const [canRoll, setCanRoll] = useState(false);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    const last = localStorage.getItem('luckyRollDate');
    setCanRoll(last !== todayKey());
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
    const sum = values.reduce((a, b) => a + b, 0);
    const idx = ((sum - 1) % 12);
    setSelected(idx);
    setShowRewards(true);
    const prize = rewards[idx];
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
    } else if (prize === 'BONUS_X3') {
      localStorage.setItem('bonusX3', 'true');
    }
    setReward(prize);
    localStorage.setItem('luckyRollDate', todayKey());
    setCanRoll(false);
  };


  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 text-center overflow-hidden wide-card">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
      />
      <h3 className="text-lg font-bold text-text">Lucky Number</h3>
      <div className="grid grid-cols-3 gap-2 justify-items-center">
        {rewards.map((val, i) => (
          <div
            key={i}
            className={`board-style w-24 h-24 flex flex-col items-center justify-center rounded relative ${selected === i ? 'border-4 border-brand-gold' : 'border-2 border-border'}`}
          >
            {(!showRewards && i !== 0) ? (
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
      <div className="flex flex-col items-center space-y-2 mt-4">
        <DiceRoller
          onRollEnd={handleRollEnd}
          onRollStart={handleRollStart}
          showButton={false}
          clickable={canRoll}
        />
        {!canRoll && (
          <p className="text-sm text-subtext">Come back tomorrow to roll again.</p>
        )}
      </div>
      <RewardPopup
        reward={reward}
        onClose={() => {
          setReward(null);
          setShowRewards(false);
          setRewards(shuffleRewards());
        }}
      />
    </div>
  );
}
