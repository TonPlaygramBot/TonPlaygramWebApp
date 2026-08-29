import { useEffect, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { getTelegramId } from '../utils/telegram.js';
import { Clock3, Pickaxe, Rocket, Sparkles, Users, WalletCards, Zap } from 'lucide-react';
import SpinGame from '../components/SpinGame.jsx';
import MiningCard from '../components/MiningCard.tsx';
import RouletteMini from '../components/RouletteMini.jsx';
import MiningTransactionsCard from '../components/MiningTransactionsCard.jsx';
import { getOnlineCount, getReferralInfo } from '../utils/api.js';

export default function Mining() {
  useTelegramBackButton();
  try {
    getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }
  const [onlineCount, setOnlineCount] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [miningBoost, setMiningBoost] = useState(0);

  useEffect(() => {
    function loadOnline() {
      getOnlineCount().then((d) => setOnlineCount(d.count || 0));
    }
    loadOnline();
    const id = setInterval(loadOnline, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    getReferralInfo(getTelegramId()).then((info) => {
      if (!active) return;
      setReferralCount(Number(info?.referralCount || 0));
      setMiningBoost(Number(info?.bonusMiningRate || 0));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <div className="mining-page-content">
        <section className="mining-hero wide-card">
          <div className="mining-hero__glow" aria-hidden="true" />
          <div className="mining-kicker"><Sparkles size={13} /> YOUR MINING HUB</div>
          <div className="mining-hero__title">
            <span><Pickaxe size={25} /></span>
            <div><h1>Mine. Boost. Claim.</h1><p>One tap starts your 12-hour cycle.</p></div>
          </div>
          <div className="mining-quick-stats">
            <div><Clock3 size={17} /><span><strong>12h</strong> cycle</span></div>
            <div><WalletCards size={17} /><span><strong>1,000</strong> TPG max</span></div>
            <div><Zap size={17} /><span><strong>+{(miningBoost * 100).toFixed(0)}%</strong> boost</span></div>
            <div><Users size={17} /><span><strong>{referralCount}</strong> friends invited</span></div>
          </div>
          <p className="mining-online"><i /> {onlineCount} miners online</p>
        </section>

        <section className="mining-loop wide-card" aria-labelledby="mining-loop-title">
          <div className="mining-loop__heading"><span>HOW IT WORKS</span><h2 id="mining-loop-title">Core mining loop</h2></div>
          <div className="mining-loop__steps">
            {[
              { icon: Pickaxe, title: 'Mine', detail: 'Tap to start' },
              { icon: Rocket, title: 'Boost', detail: 'Invite friends' },
              { icon: WalletCards, title: 'Claim', detail: 'Collect TPG' },
            ].map((step, index) => (
              <div className="mining-loop__step" key={step.title}>
                <span className="mining-loop__number">{index + 1}</span>
                <step.icon size={22} />
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
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
