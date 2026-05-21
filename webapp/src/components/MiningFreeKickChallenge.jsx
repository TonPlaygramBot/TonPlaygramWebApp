import { useState } from 'react';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';
import AdModal from './AdModal.tsx';
import RewardPopup from './RewardPopup.tsx';
import { addTransaction, getWalletBalance, updateBalance } from '../utils/api.js';

const TARGETS = [220, 180, 150, 120, 90, 70];

export default function MiningFreeKickChallenge() {
  let telegramId;
  try { telegramId = getTelegramId(); } catch { return <LoginOptions />; }

  const [shotsLeft, setShotsLeft] = useState(5);
  const [score, setScore] = useState(0);
  const [showAd, setShowAd] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [reward, setReward] = useState(null);

  const kick = async (value) => {
    if (!enabled || shotsLeft <= 0) return;
    const nextShots = shotsLeft - 1;
    const nextScore = score + value;
    setShotsLeft(nextShots);
    setScore(nextScore);

    if (nextShots === 0) {
      const payout = Math.max(120, Math.round((nextScore / (220 * 5)) * 300));
      try {
        const balRes = await getWalletBalance(telegramId);
        await updateBalance(telegramId, (balRes.balance || 0) + payout);
        await addTransaction(telegramId, payout, 'lucky');
      } catch {}
      setReward(payout);
      setEnabled(false);
    }
  };

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-3 text-center overflow-hidden wide-card">
      <h3 className="text-lg font-bold text-white">Free Kick Lucky Challenge</h3>
      <p className="text-xs text-subtext">5 free kicks • 6 goal targets • each target has its own TPC value.</p>
      <div className="text-sm text-white">Shots Left: {shotsLeft} • Score: {score}</div>
      <div className="grid grid-cols-3 gap-2">
        {TARGETS.map((value, i) => (
          <button key={i} onClick={() => kick(value)} className="rounded-lg border border-white/20 bg-emerald-500/20 py-3 text-xs text-white">
            Target {i + 1}<br />{value} pts
          </button>
        ))}
      </div>
      {!enabled && shotsLeft === 5 && <button className="btn-primary px-4 py-2 rounded" onClick={() => setShowAd(true)}>Watch Ad & Start Kicks</button>}
      <AdModal open={showAd} onClose={() => setShowAd(false)} onComplete={() => { setEnabled(true); setShowAd(false); }} />
      {reward != null && <RewardPopup reward={reward} onClose={() => setReward(null)} disableEffects />}
    </div>
  );
}
