import { GAME_TX_WALLET_1, GAME_TX_WALLET_2, MINING_REWARDS_WALLET } from '../utils/constants.js';

export default function ProjectAchievementsCard() {
  const achievements = [
    '🧾 Wallet transaction history works',
    '💬 In-chat TPC transfers enabled',
    '🎲 Snake & Ladder multiplayer game',
    '🧑‍🤝‍🤝 Friends and inbox chat',
    '🕹️ Telegram bot and web app integration',
    '🎲 Crazy Dice Duel mini-game',
    '🪂 Falling Ball mini-game',
    '🥅 Goal Rush multiplayer',
    '🧱 Brick Breaker Royale',
    '🍉 Fruit Slice Royale',
    '🫧 Bubble Pop Royale',
    '💥 Bubble Smash Royale',
    '🧩 Tetris Royale',
    '🎱 8 Poll Royale',
    "🃏 Texas Hold'em",
    '🃏 Black Jack Multiplayer',
    '⚽ Penalty Kick',
    '🂠 Murlan Royale',
    '🔄 Daily Check-In rewards',
    '⛏️ Mining system active',
    '📺 Ad watch rewards',
    '🎯 Social tasks for X, Telegram, TikTok',
    '📹 Intro video view rewards',
    '🎡 Spin & Win wheel',
    '🍀 Lucky Card prizes',
    '🎁 NFT Gifts marketplace',
    `🏦 Game transactions wallet 1: ${GAME_TX_WALLET_1}`,
    `🏦 Game transactions wallet 2: ${GAME_TX_WALLET_2}`,
    `⛏️ Mining rewards wallet: ${MINING_REWARDS_WALLET}`,
  ];

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
      <img
        src="/assets/icons/snakes_and_ladders.webp"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <h3 className="text-lg font-bold text-center">Playgram Achievements</h3>
      <ul className="list-disc pl-6 text-sm space-y-1">
        {achievements.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  );
}
