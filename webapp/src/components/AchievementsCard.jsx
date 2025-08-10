import { useEffect, useState } from 'react';
import { getProfile } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';
import { Link } from 'react-router-dom';

export default function AchievementsCard({ telegramId: propTelegramId }) {
  let telegramId = propTelegramId;
  if (!telegramId) {
    try {
      telegramId = getTelegramId();
    } catch (err) {
      return (
        <div className="bg-surface border border-border rounded-xl wide-card">
          <LoginOptions />
        </div>
      );
    }
  }

  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const prof = await getProfile(telegramId);
        setProfile(prof);
      } catch (err) {
        console.error('Failed to load profile', err);
      }
    }
    load();
  }, [telegramId]);

  if (!profile) {
    return (
      <div className="relative bg-surface border border-border rounded-xl p-4 text-subtext text-center overflow-hidden wide-card">
        <img
          src="/assets/icons/snakes_and_ladders.webp"
          className="background-behind-board object-cover"
          alt=""
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        Loading achievements...
      </div>
    );
  }

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
      <img
        src="/assets/icons/snakes_and_ladders.webp"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <h3 className="text-lg font-bold text-center">Achievements</h3>
      <p className="text-center text-sm">Daily Streak: {profile.dailyStreak || 0} days</p>
      <p className="text-center text-sm">Mined TPC: {formatValue(profile.minedTPC || 0, 0)}</p>
      <p className="text-center text-sm">Gifts Collected: {profile.gifts ? profile.gifts.length : 0}</p>
      <Link
        to="/tasks"
        className="mx-auto block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow text-center"
      >
        View Tasks
      </Link>
    </div>
  );
}

function formatValue(value, decimals = 2) {
  if (typeof value !== 'number') {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return value;
    return parsed.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
