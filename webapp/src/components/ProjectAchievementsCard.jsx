import gamesCatalog from '../config/gamesCatalog.js';
import { getGameThumbnail } from '../config/gameAssets.js';

export default function ProjectAchievementsCard() {
  const achievements = [
    '🧾 Wallet transaction history works',
    '💬 In-chat TPC transfers enabled',
    '🧑‍🤝‍🤝 Friends and inbox chat',
    '🕹️ Telegram bot and web app integration',
    '🔄 Daily Check-In rewards',
    '⛏️ Mining system active',
    '📺 Ad watch rewards',
    '🎯 Social tasks for X, Telegram, TikTok',
    '📹 Intro video view rewards',
    '🎡 Spin & Win wheel',
    '🍀 Lucky Card prizes',
    '🎁 NFT Gifts marketplace',
    '🏦 Game transactions are public',
    '⛏️ Mining transactions are public',
  ];

  const roadmap = [
    {
      title: 'Mobile Launch',
      description:
        'Release the Playgram app on Android and iOS with the current 3D game lineup.',
    },
    {
      title: 'Growth & Community',
      description:
        'Start the marketing campaign and launch an airdrop program for early users.',
    },
    {
      title: 'TPC Tokenization',
      description:
        'Mint the official TPC token and finalize token utility across the ecosystem.',
    },
    {
      title: 'Exchange Readiness',
      description:
        'Begin CEX outreach and prepare DEX liquidity provisioning.',
    },
    {
      title: 'CEX + DEX Listings',
      description:
        'List on decentralized exchanges and finalize listings on major CEX partners.',
    },
    {
      title: 'Next Phases',
      description:
        'Post-listing initiatives are in progress and will be announced after CEX/DEX milestones.',
    },
  ];

  return (
    <div className="relative rounded-2xl border border-border/70 bg-gradient-to-br from-surface/95 via-surface/90 to-surface/80 p-5 shadow-xl shadow-black/5 space-y-6 overflow-hidden wide-card">
      <img
        src="/assets/icons/snakes_and_ladders.webp"
        className="background-behind-board object-cover opacity-30"
        alt=""
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <div className="space-y-2 text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted">Playgram</p>
        <h3 className="text-xl font-semibold">Achievements & Roadmap</h3>
        <p className="text-xs text-muted max-w-[28rem] mx-auto">
          Progress highlights, core game lineup, and the next delivery milestones.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-surface/80 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Delivered Achievements</h4>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted/70">
            live now
          </span>
        </div>
        <ul className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
          {achievements.map((item) => (
            <li key={item} className="rounded-lg border border-border/40 bg-surface/90 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border/60 bg-surface/80 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Live Game Lineup</h4>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted/70">
            full 3D focus
          </span>
        </div>
        <p className="text-xs text-muted">
          Pool Royale includes UK 8 Ball, 9 Ball, and American Billiards.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {gamesCatalog.map((game) => {
            const thumbnail = getGameThumbnail(game.slug);
            return (
              <div
                key={game.name}
                className="flex flex-col items-center gap-1 rounded-lg border border-border/50 bg-surface/90 p-2 text-center"
              >
                <img
                  src={thumbnail || game.image}
                  alt={game.name}
                  className="h-10 w-10 rounded-md object-cover"
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.src = game.image;
                  }}
                />
                <span className="text-[9px] font-semibold text-muted">{game.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Roadmap (Next)</h4>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted/70">
            in progress
          </span>
        </div>
        <ol className="space-y-3 text-xs text-muted">
          {roadmap.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-border/70 bg-surface/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-muted/80">
                  Phase {index + 1}
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted/60">
                  upcoming
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-foreground">{step.title}</p>
              <p className="text-xs text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
