import { useEffect, useState } from 'react';
import LoginOptions from '../components/LoginOptions.jsx';
import { getTelegramId } from '../utils/telegram.js';
import { getReferralInfo, claimReferral } from '../utils/api.js';
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
  const [claim, setClaim] = useState('');
  const [claimMsg, setClaimMsg] = useState('');

  useEffect(() => {
    getReferralInfo(telegramId).then(setInfo);
  }, [telegramId]);

  if (!info) return <div className="p-4">Loading...</div>;

  const link = `https://t.me/${BOT_USERNAME}?start=${info.referralCode}`;
  const baseReward = 400;
  const finalReward = Math.round(baseReward * (1 + info.bonusMiningRate));

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
        <p className="text-sm text-subtext">Mining boost: +{(info.bonusMiningRate * 100).toFixed(0)}%</p>
        <p className="text-sm text-subtext">Reward per session: {finalReward} TPC</p>
        {info.storeMiningRate && info.storeMiningExpiresAt && (
          <p className="text-sm text-subtext">
            Boost ends in {Math.max(0, Math.floor((new Date(info.storeMiningExpiresAt).getTime() - Date.now()) / 86400000))}d
          </p>
        )}
        <div className="mt-4 space-y-2">
          <p className="text-sm">Have a referral link or code?</p>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Paste link or code"
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              className="flex-1 bg-surface border border-border rounded px-2 py-1 text-sm"
            />
            <button
              onClick={async () => {
                const c = claim.includes('start=') ? claim.split('start=')[1] : claim;
                try {
                  const res = await claimReferral(telegramId, c.trim());
                  if (!res.error) {
                    setClaimMsg('Referral claimed!');
                    getReferralInfo(telegramId).then(setInfo);
                  } else {
                    setClaimMsg(res.error || res.message || 'Failed');
                  }
                } catch {
                  setClaimMsg('Failed');
                }
              }}
              className="px-2 py-1 bg-primary hover:bg-primary-hover text-background rounded text-sm"
            >
              Claim
            </button>
          </div>
          {claimMsg && <p className="text-xs text-subtext">{claimMsg}</p>}
        </div>
      </div>
    </div>
  );
}
