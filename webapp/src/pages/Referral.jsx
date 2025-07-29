import { useEffect, useState } from 'react';
import LoginOptions from '../components/LoginOptions.jsx';
import { getTelegramId } from '../utils/telegram.js';
import { getReferralInfo } from '../utils/api.js';
import { BOT_USERNAME } from '../utils/constants.js';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';

export default function Referral() {
  useTelegramBackButton();
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [info, setInfo] = useState(null);

  useEffect(() => {
    getReferralInfo(telegramId).then(setInfo);
  }, [telegramId]);

  if (!info) return <div className="p-4">Loading...</div>;

  const link = `https://t.me/${BOT_USERNAME}?start=${info.referralCode}`;

  return (
    <div className="p-4 space-y-2 text-text">
      <h2 className="text-xl font-bold">Referral</h2>
      <div>
        <p className="mb-1">Share this link with your friends:</p>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            readOnly
            value={link}
            onClick={(e) => e.target.select()}
            className="flex-1 bg-surface border border-border rounded px-2 py-1 text-sm"
          />
          <button
            onClick={() => navigator.clipboard.writeText(link)}
            className="px-2 py-1 bg-primary hover:bg-primary-hover text-background rounded text-sm"
          >
            Copy
          </button>
        </div>
        <p className="text-sm text-subtext mt-1">Invited friends: {info.referralCount}</p>
        <p className="text-sm text-subtext">Mining boost: +{info.bonusMiningRate * 100}%</p>
      </div>
    </div>
  );
}
