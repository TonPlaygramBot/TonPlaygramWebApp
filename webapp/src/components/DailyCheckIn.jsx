import { useEffect, useState } from 'react';

import RewardPopup from './RewardPopup.tsx';
import AdModal from './AdModal.tsx';

import { dailyCheckIn, getProfile } from '../utils/api.js';

import { getTelegramId } from '../utils/telegram.js';

import LoginOptions from './LoginOptions.jsx';

const REWARDS = Array.from({ length: 30 }, (_, i) => 100 + i * 20);

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
  const [showAd, setShowAd] = useState(false);
  const [adWatched, setAdWatched] = useState(() => {
    const ts = localStorage.getItem('lastCheckAd');
    return ts ? Date.now() - parseInt(ts, 10) < ONE_DAY : false;
  });

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

  const attemptCheckIn = () => {
    if (!adWatched) {
      setShowAd(true);
    } else {
      handleCheckIn();
    }
  };

  const handleAdComplete = () => {
    const now = Date.now();
    localStorage.setItem('lastCheckAd', String(now));
    setAdWatched(true);
    setShowAd(false);
    handleCheckIn();
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

        <span className="text-text">Day {i + 1}</span>

        <span className="flex items-center">
          {formatReward(REWARDS[i])}
          <img  src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-7 h-7 -ml-1" />
        </span>

        {i === streak - 1 && showPopup && (
          <span
            onClick={attemptCheckIn}
            className="text-brand-gold text-xs mt-1 cursor-pointer"
          >
            Claim
          </span>
        )}

      </div>

    );

  }

  return (

    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 text-center overflow-hidden wide-card">
      <img
        src="/assets/icons/snakes_and_ladders.webp"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />


      {reward !== null && (
        <RewardPopup
          reward={reward}
          onClose={() => setReward(null)}
          disableEffects
        />
      )}
      <AdModal
        open={showAd}
        onComplete={handleAdComplete}
        onClose={() => setShowAd(false)}
      />

      <h3 className="text-lg font-bold text-white">Daily Streaks</h3>

      <div className="flex space-x-2 overflow-x-auto justify-center">{progress}</div>

      <p className="text-sm text-subtext">Check in each day for increasing rewards.</p>

    </div>

  );
}