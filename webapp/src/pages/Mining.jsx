import { useEffect, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { getTelegramId } from '../utils/telegram.js';
import { FaCircle } from 'react-icons/fa';
import SpinGame from '../components/SpinGame.jsx';
import MiningCard from '../components/MiningCard.tsx';
import RouletteMini from '../components/RouletteMini.jsx';
import MiningTransactionsCard from '../components/MiningTransactionsCard.jsx';
import { getOnlineCount } from '../utils/api.js';

export default function Mining() {
  useTelegramBackButton();
  try {
    getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    function loadOnline() {
      getOnlineCount().then((d) => setOnlineCount(d.count || 0));
    }
    loadOnline();
    const id = setInterval(loadOnline, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mining-page-content">
        <section className="relative bg-surface border border-border rounded-xl p-4 space-y-3 text-text overflow-hidden wide-card">
          <img
            src="/assets/icons/snakes_and_ladders.webp"
            className="background-behind-board object-cover"
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="flex items-center justify-center gap-2 text-yellow-300">
            <FaCircle className="w-2 h-2" />
            <span className="text-xs uppercase tracking-wide font-semibold">Mining Hub</span>
            <FaCircle className="w-2 h-2" />
          </div>
          <h1 className="text-2xl font-bold text-center text-white text-outline-black">Mine, Boost, Claim</h1>
          <p className="text-sm text-subtext text-center">
            Start a 12-hour mining cycle, increase your reward with referrals, and track progress live.
            Complete check-ins and mini-games below to accelerate your growth.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="bg-black/20 rounded-lg border border-border p-2 text-center">
              <p className="text-subtext">Cycle</p>
              <p className="text-white font-semibold">12 Hours</p>
            </div>
            <div className="bg-black/20 rounded-lg border border-border p-2 text-center">
              <p className="text-subtext">Base Reward</p>
              <p className="text-white font-semibold">Up to 1000 TPG</p>
            </div>
            <div className="bg-black/20 rounded-lg border border-border p-2 text-center">
              <p className="text-subtext">Online Now</p>
              <p className="text-white font-semibold">{onlineCount}</p>
            </div>
          </div>
        </section>

        <section className="space-y-3 wide-card">
          <h2 className="text-lg font-semibold text-white text-outline-black">Core Mining Loop</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {[
              { title: '1) Start', detail: 'Tap Start Mining to begin your 12-hour session.' },
              { title: '2) Boost', detail: 'Invite friends and activate store boosts for faster earnings.' },
              { title: '3) Claim', detail: 'Session auto-finishes in 12h. Restart quickly to keep momentum.' },
            ].map((step) => (
              <div key={step.title} className="bg-surface border border-border rounded-xl p-3">
                <p className="text-white font-semibold">{step.title}</p>
                <p className="text-subtext mt-1">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <MiningCard />
        <MiningTransactionsCard />

        <section className="space-y-3 wide-card">
          <h2 className="text-lg font-semibold text-white text-outline-black">Daily Boost Actions</h2>
          <p className="text-xs text-subtext">
            These actions improve your consistency and help you compound mining rewards every day.
          </p>
          <SpinGame />
          <RouletteMini />
        </section>

    </div>
  );
}
