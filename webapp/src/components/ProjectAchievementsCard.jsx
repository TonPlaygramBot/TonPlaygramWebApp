import gamesCatalog from '../config/gamesCatalog.js';
import { getGameThumbnail } from '../config/gameAssets.js';

export default function ProjectAchievementsCard() {
  const completionThreshold = 90;
  const calculateAverageProgress = (items) => {
    if (!items.length) {
      return 0;
    }

    const totalProgress = items.reduce(
      (sum, item) => sum + Math.min(Math.max(item.progress ?? 0, 0), 100),
      0,
    );
    return Math.round(totalProgress / items.length);
  };
  const deliveredAchievements = [
    { label: '🧾 Wallet transaction history works', progress: 100 },
    { label: '💬 In-chat TPC transfers enabled', progress: 100 },
    { label: '🧑‍🤝‍🤝 Friends and inbox chat', progress: 100 },
    { label: '🎰 Roulette spin live', progress: 100 },
    {
      label:
        '🤝 Game invites for 1v1 or group play with Telegram notifications (Android/iOS push notifications after migration)',
      progress: 100,
    },
    { label: '💬 In-game chat enabled', progress: 100 },
    { label: '🕹️ Telegram bot and web app integration', progress: 100 },
    { label: '🔄 Daily Check-In rewards', progress: 100 },
    { label: '⛏️ Mining system active', progress: 100 },
    { label: '📺 Ad watch rewards', progress: 100 },
    { label: '🎯 Social tasks for X, Telegram, TikTok', progress: 100 },
    { label: '📹 Intro video view rewards', progress: 100 },
    { label: '🎡 Spin & Win wheel', progress: 100 },
    { label: '🍀 Lucky Card prizes', progress: 100 },
    { label: '🎁 NFT gifts', progress: 100 },
    {
      label: '🚀 Referral boost: invite more friends to earn more TPC',
      progress: 100,
    },
    { label: '🛒 NFT marketplace for user listings', progress: 100 },
    { label: '🏆 Game tournaments live', progress: 100 },
    { label: '🎁 Tournament winner gifts', progress: 100 },
    { label: '🏦 Game transactions are public', progress: 100 },
    { label: '⛏️ Mining transactions are public', progress: 100 },
  ];

  const roadmapSteps = [
    {
      title: 'Online Connection Fix',
      description:
        'Fixing the online connection is almost done, partly completed with a bit left to finalize.',
      progress: 85,
    },
    {
      title: 'Store Item Photos',
      description: 'Upload all necessary photos for the store items.',
      progress: 55,
    },
    {
      title: 'Mobile Launch',
      description:
        'Release the Playgram app on Android and iOS with the current 3D game lineup.',
      progress: 70,
    },
    {
      title: 'Growth & Community',
      description:
        'Gather Telegram group feedback to identify glitches, errors, and malfunctions, then take new feature requests to community votes so every voice is heard.',
      progress: 40,
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
  const normalizedRoadmapSteps = roadmapSteps.map((step) => ({
    ...step,
    progress: step.progress ?? 0,
  }));
  const promotedRoadmapAchievements = normalizedRoadmapSteps
    .filter((step) => step.progress >= completionThreshold)
    .map((step) => ({
      label: `✅ ${step.title}`,
      progress: step.progress,
    }));
  const achievements = [...deliveredAchievements, ...promotedRoadmapAchievements];
  const roadmap = normalizedRoadmapSteps.filter(
    (step) => step.progress < completionThreshold,
  );
  const achievementsProgress = calculateAverageProgress(achievements);
  const roadmapProgress = calculateAverageProgress(normalizedRoadmapSteps);

  const poolVariants = [
    {
      name: 'UK 8 Pool',
      image: '/assets/icons/8ballrack.png',
    },
    {
      name: '9 Ball',
      image: '/assets/icons/9ballrack.png',
    },
    {
      name: 'American Billiards',
      image: '/assets/icons/American%20Billiards%20.png',
    },
  ];

  const liveGameLineup = [
    ...gamesCatalog.filter((game) => game.slug !== 'poolroyale'),
    ...poolVariants,
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
          <div className="flex items-center gap-2 text-[10px] font-semibold text-emerald-400">
            <span className="uppercase tracking-[0.2em] text-muted/70">live now</span>
            <span>{achievementsProgress}%</span>
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/15">
          <div
            className="h-1.5 rounded-full bg-emerald-500"
            style={{ width: `${achievementsProgress}%` }}
          />
        </div>
        <ul className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
          {achievements.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-surface/90 px-3 py-2"
            >
              <span>{item.label}</span>
              <span className="text-[10px] font-semibold text-emerald-400">{item.progress}%</span>
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
          Pool Royale includes UK 8 Ball, 9 Ball, and American Billiards. All games are fully
          playable (currently local vs AI only).
        </p>
        <div className="grid grid-cols-4 gap-2">
          {liveGameLineup.map((game) => {
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
          <div className="flex items-center gap-2 text-[10px] font-semibold text-emerald-400">
            <span className="uppercase tracking-[0.2em] text-muted/70">in progress</span>
            <span>{roadmapProgress}%</span>
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/15">
          <div
            className="h-1.5 rounded-full bg-emerald-500"
            style={{ width: `${roadmapProgress}%` }}
          />
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
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/15">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500"
                    style={{ width: `${step.progress}%` }}
                  />
                </div>
                <div className="text-[10px] font-semibold text-emerald-400">
                  {step.progress}% complete ✔️
                </div>
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
