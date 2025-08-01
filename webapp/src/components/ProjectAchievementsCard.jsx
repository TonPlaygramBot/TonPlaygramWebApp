import { Link } from 'react-router-dom';

export default function ProjectAchievementsCard() {
  const achievements = [
    '🔐 Smart-contract store live with auto-delivery',
    '🚀 TPC deployed on TON network',
    '🧾 Wallet transaction history works',
    '💬 In-chat TPC transfers enabled',
    '🎲 Snake & Ladder multiplayer game',
    '🧑‍🤝‍🤝 Friends and inbox chat',
    '🕹️ Telegram bot and web app integration',
    '🎲 Crazy Dice Duel mini-game',
    '🔄 Daily Check-In rewards',
    '⛏️ Mining system active',
    '📺 Ad watch rewards',
    '🎯 Social tasks for X, Telegram, TikTok',
    '📹 Intro video view rewards',
    '🎡 Spin & Win wheel',
    '🍀 Lucky Card prizes',
    '🎁 NFT Gifts marketplace',
  ];

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <h3 className="text-lg font-bold text-center">TonPlaygram Achievements</h3>
      <ul className="list-disc pl-6 text-sm space-y-1">
        {achievements.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <Link
        to="/tokenomics"
        className="mx-auto block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow text-center"
      >
        View More
      </Link>
    </div>
  );
}
