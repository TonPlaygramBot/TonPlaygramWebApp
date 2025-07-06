import { useEffect, useState } from 'react';

import RewardPopup from './RewardPopup.tsx';

import { dailyCheckIn, getProfile } from '../utils/api.js';

import { getTelegramId } from '../utils/telegram.js';

import LoginOptions from './LoginOptions.jsx';

const REWARDS = Array.from({ length: 30 }, (_, i) => 1000 * (i + 1));

function formatReward(r) {
  return r >= 1000 ? `${r / 1000}k` : String(r);
}

const ONE_DAY = 24 * 60 * 60 * 1000;

export default function DailyCheckIn() {

  let telegramId;

  try {

    telegramId = getTelegramId();

  } catch (err) {

    return <LoginOptions />;

  }

  const [streak, setStreak] = useState(1);

  const [lastCheck, setLastCheck] = useState(() => {
    const ts = localStorage.getItem('lastCheckIn');
    return ts ? parseInt(ts, 10) : null;
  });

  const [showPopup, setShowPopup] = useState(() => {
    const ts = localStorage.getItem('lastCheckIn');
    if (!ts) return true;
    return Date.now() - parseInt(ts, 10) >= ONE_DAY;
  });

  const [reward, setReward] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const profile = await getProfile(telegramId);
        if (profile.dailyStreak) setStreak(profile.dailyStreak);
        const serverTs = profile.lastCheckIn
          ? new Date(profile.lastCheckIn).getTime()
          : null;
        const localRaw = localStorage.getItem('lastCheckIn');
        const localTs = localRaw ? parseInt(localRaw, 10) : null;
        const ts = Math.max(serverTs || 0, localTs || 0);
        if (ts) {
          setLastCheck(ts);
          localStorage.setItem('lastCheckIn', String(ts));
          setShowPopup(Date.now() - ts >= ONE_DAY);
        } else {
          setShowPopup(true);
        }
      } catch (err) {
        console.error('Failed to load profile', err);
      }
    }
    fetchData();
  }, [telegramId]);

  const handleCheckIn = async () => {
    try {
      const res = await dailyCheckIn(telegramId);
      if (res.error) {
        alert(res.error);
        return;
      }
      setStreak(res.streak);
      setReward(res.reward);
      const now = Date.now();
      setLastCheck(now);
      localStorage.setItem('lastCheckIn', String(now));
    } catch (err) {
      console.error('Daily check-in failed', err);
    }
    setShowPopup(false);
  };

  // Show 5-day streak preview

  const progress = [];

  for (

    let i = streak - 1;

    i < Math.min(streak - 1 + 5, REWARDS.length);

    i++

  ) {

    progress.push(

      <div
        key={i}
        className={`board-style border-2 border-border w-20 p-2 flex flex-col items-center justify-center text-xs ${
          i === streak - 1 ? 'border-4 border-brand-gold' : ''
        }`}
      >

        <span>Day {i + 1}</span>

        <span className="flex items-center">
          {formatReward(REWARDS[i])}
          <img  src="/assets/icons/TPCcoin.png" alt="TPC" className="w-8 h-8 -ml-1" />
        </span>

      </div>

    );

  }

  return (

    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 text-center overflow-hidden">
      <img
        
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
      />

      {showPopup && (

        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">

          <div className="bg-surface border border-border p-6 rounded text-center space-y-4 text-text w-80">

            <img
              
              src="/assets/TonPlayGramLogo.jpg"
              alt="TonPlaygram Logo"

              className="w-10 h-10 mx-auto"

            />

            <h3 className="text-lg font-bold">Daily Check-In</h3>

            <p className="text-sm text-subtext">Come back daily to keep your streak!</p>

            <button

              onClick={handleCheckIn}

              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded w-full"

            >

              Check in

            </button>

          </div>

        </div>

      )}

      {reward !== null && (

        <RewardPopup
          reward={reward}
          onClose={() => setReward(null)}
        />

      )}

      <h3 className="text-lg font-bold text-text">Daily Streaks</h3>

      <div className="flex space-x-2 overflow-x-auto justify-center">{progress}</div>

      <p className="text-sm text-subtext">Check in each day for increasing rewards.</p>

    </div>

  );

}