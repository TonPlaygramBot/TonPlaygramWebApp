import { useEffect, useState } from 'react';
import { GiMining } from 'react-icons/gi';
import {
  getMiningStatus,
  startMining,
  stopMining,
  getReferralInfo
} from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';

const MINING_DURATION = 12 * 60 * 60; // 12 hours in seconds
const REWARD_AMOUNT = 1000; // maximum base reward, actual amount may vary

export default function MiningCard() {
  let telegramId: string;

  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [isMining, setIsMining] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [bonusRate, setBonusRate] = useState(0);
  const [boostExpiry, setBoostExpiry] = useState<Date | null>(null);

  // Load initial mining status
  useEffect(() => {
    let ignore = false;

    getMiningStatus(telegramId).then((res) => {
      if (ignore) return;

      setIsMining(res.isMining);

      if (res.isMining) {
        const saved = localStorage.getItem('miningStartTime');
        const start = saved ? parseInt(saved, 10) : Date.now();
        if (!saved) localStorage.setItem('miningStartTime', String(start));
        const diff = Math.floor((Date.now() - start) / 1000);

        if (diff >= MINING_DURATION) {
          stopMining(telegramId);
          localStorage.removeItem('miningStartTime');
          setIsMining(false);
          setElapsed(0);
        } else {
          setElapsed(diff);
        }
      } else {
        setIsMining(false);
        localStorage.removeItem('miningStartTime');
        setElapsed(0);
      }
    });

    getReferralInfo(telegramId)
      .then((info) => {
        if (ignore) return;
        const expires = info.storeMiningExpiresAt
          ? new Date(info.storeMiningExpiresAt)
          : null;
        const active =
          info.storeMiningRate && expires && expires > new Date()
            ? info.storeMiningRate
            : 0;
        setBonusRate((info.bonusMiningRate || 0) + active);
        setBoostExpiry(active ? expires : null);
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [telegramId]);

  // Update mining timer every second
  useEffect(() => {
    if (!isMining) return;

    const interval = setInterval(async () => {
      const start = parseInt(
        localStorage.getItem('miningStartTime') || String(Date.now()),
        10
      );

      const diff = Math.floor((Date.now() - start) / 1000);

      if (diff >= MINING_DURATION) {
        await stopMining(telegramId);
        localStorage.removeItem('miningStartTime');
        setIsMining(false);
        setElapsed(0);
        return;
      }

      setElapsed(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [isMining]);

  const toggleMining = async () => {
    if (isMining) return;
    await startMining(telegramId);
    const now = Date.now();
    localStorage.setItem('miningStartTime', String(now));
    setElapsed(0);
    setIsMining(true);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const totalReward = REWARD_AMOUNT * (1 + bonusRate);
  const minted = isMining ? Math.floor((elapsed / MINING_DURATION) * totalReward) : 0;

  return (
    <div className="mining-control wide-card">
      <div className="flex justify-center items-center space-x-1">
        <GiMining className="w-5 h-5 text-accent" />
        <span className="text-lg font-bold text-white text-outline-black">Mining</span>
      </div>

      <button
        onClick={toggleMining}
        disabled={isMining}
        className={`mining-control__button ${isMining ? 'is-active' : ''}`}
      >
        <div>{isMining ? 'Mining' : 'Start Mining'}</div>
        <div className="text-sm">
          {formatTime(isMining ? Math.max(MINING_DURATION - elapsed, 0) : MINING_DURATION)}
        </div>
      </button>
      <div className="mining-control__progress"><i style={{ width: `${Math.min(100, (elapsed / MINING_DURATION) * 100)}%` }} /></div>
      <div className="mining-control__summary">
        <span><small>Mined</small><strong>{minted.toLocaleString()} TPG</strong></span>
        <span><small>Speed</small><strong>+{(bonusRate * 100).toFixed(0)}%</strong></span>
      </div>
      {boostExpiry && (
        <p className="text-xs text-subtext">
          Boost ends in {Math.max(0, Math.floor((boostExpiry.getTime() - Date.now()) / 86400000))}d
        </p>
      )}
    </div>
  );
}
