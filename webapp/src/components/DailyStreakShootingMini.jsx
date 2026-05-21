import { useMemo, useState } from 'react';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';
import AdModal from './AdModal.tsx';
import RewardPopup from './RewardPopup.tsx';
import { getWalletBalance, updateBalance, addTransaction } from '../utils/api.js';

const WEAPONS = ['Pistol', 'SMG', 'Shotgun', 'Rifle', 'Sniper'];
const TARGET_RINGS = [
  { label: 'Bullseye', points: 240, color: 'bg-red-500/90' },
  { label: 'Ring 2', points: 180, color: 'bg-orange-500/80' },
  { label: 'Ring 3', points: 130, color: 'bg-yellow-500/80' },
  { label: 'Ring 4', points: 90, color: 'bg-green-500/70' },
  { label: 'Ring 5', points: 60, color: 'bg-blue-500/70' },
];

export default function DailyStreakShootingMini() {
  let telegramId;
  try { telegramId = getTelegramId(); } catch { return <LoginOptions />; }

  const [shotsLeft, setShotsLeft] = useState(5);
  const [total, setTotal] = useState(0);
  const [weapon, setWeapon] = useState(() => WEAPONS[Math.floor(Math.random() * WEAPONS.length)]);
  const [showAd, setShowAd] = useState(false);
  const [ready, setReady] = useState(false);
  const [reward, setReward] = useState(null);
  const [claimed, setClaimed] = useState(false);

  const bestRing = useMemo(() => TARGET_RINGS[0], []);

  const shoot = async (ring) => {
    if (!ready || shotsLeft <= 0 || claimed) return;
    const nextShots = shotsLeft - 1;
    const nextTotal = total + ring.points;
    setShotsLeft(nextShots);
    setTotal(nextTotal);
    setWeapon(WEAPONS[Math.floor(Math.random() * WEAPONS.length)]);

    if (nextShots === 0) {
      const payout = Math.max(100, Math.round((nextTotal / (bestRing.points * 5)) * 260));
      try {
        const balRes = await getWalletBalance(telegramId);
        await updateBalance(telegramId, (balRes.balance || 0) + payout);
        await addTransaction(telegramId, payout, 'daily');
      } catch {}
      setReward(payout);
      setClaimed(true);
    }
  };

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-3 text-center overflow-hidden wide-card">
      <h3 className="text-lg font-bold text-white">Daily Streak Shooting</h3>
      <p className="text-xs text-subtext">5 shots only • random weapon each shot • ring points decide TPC reward.</p>
      <div className="text-sm text-white">Weapon: <span className="text-yellow-300 font-semibold">{weapon}</span></div>
      <div className="text-sm text-white">Shots Left: {shotsLeft} • Score: {total}</div>
      <div className="mx-auto w-52 h-52 rounded-full border border-white/20 p-4 flex flex-col justify-center gap-2 bg-black/20">
        {TARGET_RINGS.map((ring) => (
          <button key={ring.label} className={`rounded-full py-2 text-xs text-white ${ring.color}`} onClick={() => shoot(ring)}>
            {ring.label} • {ring.points} pts
          </button>
        ))}
      </div>
      {!ready && <button className="btn-primary px-4 py-2 rounded" onClick={() => setShowAd(true)}>Watch Ad & Start 5 Shots</button>}
      <AdModal open={showAd} onClose={() => setShowAd(false)} onComplete={() => { setReady(true); setShowAd(false); }} />
      {reward != null && <RewardPopup reward={reward} onClose={() => setReward(null)} disableEffects />}
    </div>
  );
}
