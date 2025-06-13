// DailyCheckIn.jsx
import { useEffect, useState } from 'react';
import RewardPopup from './RewardPopup.tsx';

const REWARDS = Array.from({ length: 30 }, (_, i) => 1000 * (i + 1));
const ONE_DAY = 24 * 60 * 60 * 1000;

export default function DailyCheckIn() {
  const [streak, setStreak] = useState(1);
  const [lastCheck, setLastCheck] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [reward, setReward] = useState(null);

  useEffect(() => {
    const savedStreak = parseInt(localStorage.getItem('dailyStreak') || '1', 10);
    const savedLast = localStorage.getItem('lastCheckIn');
    setStreak(savedStreak);
    setLastCheck(savedLast ? parseInt(savedLast, 10) : null);

    const now = Date.now();
    if (!savedLast || now - parseInt(savedLast, 10) >= ONE_DAY) {
      setShowPopup(true);
    }
  }, []);

  const handleCheckIn = () => {
    const now = Date.now();
    let newStreak = 1;
    if (lastCheck && now - lastCheck < ONE_DAY * 2) {
      newStreak = Math.min(streak + 1, 30);
    }
    setStreak(newStreak);
    setLastCheck(now);
    localStorage.setItem('dailyStreak', String(newStreak));
    localStorage.setItem('lastCheckIn', String(now));
    setReward(REWARDS[newStreak - 1]);
    setShowPopup(false);
  };

  // Only show 5 days, current and next 4
  const progress = [];
  for (
    let i = streak - 1;
    i < Math.min(streak - 1 + 5, REWARDS.length);
    i++
  ) {
    progress.push(
      <div
        key={i}
        className={`flex flex-col items-center justify-center p-2 rounded border border-border w-20 text-xs ${
          i === streak - 1 ? 'bg-accent text-white' : 'bg-surface text-text'
        }`}
      >
        <span className="text-lg font-bold text-center">{i + 1}</span>
        <span className="flex items-center">
          {REWARDS[i]}
          <img src="/icons/tpc.svg" alt="TPC" className="w-4 h-4 ml-1" />
        </span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
          <div className="bg
