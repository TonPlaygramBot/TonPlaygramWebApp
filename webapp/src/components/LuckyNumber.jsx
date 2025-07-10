import { useState, useEffect } from 'react';
import DiceRoller from './DiceRoller.jsx';
import RewardPopup from './RewardPopup.tsx';
import { segments } from '../utils/rewardLogic';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';
import { getWalletBalance, updateBalance, addTransaction } from '../utils/api.js';

function shuffleRewards() {
  const arr = [...segments];
  const res = [];
  for (let i = 0; i < 12; i++) {
    const idx = Math.floor(Math.random() * arr.length);
    res.push(arr[idx]);
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
  const [canRoll, setCanRoll] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    const last = localStorage.getItem('luckyRollDate');
    setCanRoll(last !== todayKey());
  }, []);

  const handleRollStart = () => setRolling(true);

  const handleRollEnd = async (values) => {
    setRolling(false);
    const sum = values.reduce((a, b) => a + b, 0);
    const idx = ((sum - 1) % 12);
    setSelected(idx);
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
    setRewards(shuffleRewards());
    localStorage.setItem('luckyRollDate', todayKey());
    setCanRoll(false);
  };

  const triggerRoll = () => {
    if (!canRoll || rolling) return;
    setTrigger((t) => t + 1);
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
        {rewards.map((_, i) => (
          <div
            key={i}
            className={`board-style w-24 h-24 flex items-center justify-center rounded relative ${selected === i ? 'border-4 border-brand-gold' : 'border-2 border-border'}`}
          >
            <img
              src="/assets/icons/TonPlayGramLogo_2_512x512.webp"
              alt="Logo"
              className="absolute inset-0 w-full h-full object-contain opacity-40"
            />
            <span className="relative z-10 text-xl font-bold">{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center space-y-2 mt-2">
        <DiceRoller
          onRollEnd={handleRollEnd}
          onRollStart={handleRollStart}
          trigger={trigger}
          showButton={false}
        />
        <button
          onClick={triggerRoll}
          disabled={!canRoll || rolling}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded disabled:opacity-50"
        >
          Roll Dice
        </button>
        {!canRoll && (
          <p className="text-sm text-subtext">Come back tomorrow to roll again.</p>
        )}
      </div>
      <RewardPopup reward={reward} onClose={() => setReward(null)} />
    </div>
  );
}
