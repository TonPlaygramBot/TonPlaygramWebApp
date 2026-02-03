import { useState } from 'react';
import gamesCatalog from '../config/gamesCatalog.js';
import { getGameThumbnail } from '../config/gameAssets.js';

export default function ProjectAchievementsCard() {
  const [activeInfo, setActiveInfo] = useState(null);
  const InfoIcon = ({ info, label }) => (
    <button
      type="button"
      onClick={() => setActiveInfo({ title: label, description: info })}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/70 bg-surface/80 text-[10px] font-bold text-muted shadow-sm transition hover:text-foreground"
      aria-label={`Open info about ${label}`}
    >
      i
    </button>
  );

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
    {
      label: '🧾 Wallet transaction history works',
      progress: 100,
      info:
        'Completed: full wallet ledger with timestamped deposits, withdrawals, rewards, and gameplay transfers. Users can filter by type, verify balances per entry, and view confirmations. Audit trail includes session IDs and source tags. Next: exportable statements, CSV download, searchable transaction IDs, and a dispute/chargeback note field.',
    },
    {
      label: '💬 In-chat TPC transfers enabled',
      progress: 100,
      info:
        'Completed: peer-to-peer TPC transfers directly in chat with confirmations, balance updates, and receipts. Includes recipient validation, confirmation step, and rollback on failure. Next: optional transfer limits, scheduled sends, scam-prevention alerts, and transfer memos.',
    },
    {
      label: '🧑‍🤝‍🤝 Friends and inbox chat',
      progress: 100,
      info:
        'Completed: friend list management, direct messaging, and system notifications. Players can add/remove friends, view status, and get delivery receipts with basic presence. Next: group inboxes, mute controls, moderation tools, and friend tags for organization.',
    },
    {
      label: '🎰 Roulette spin live',
      progress: 100,
      info:
        'Completed: roulette minigame with live spin animation, prize resolution, and automated payout tracking. Includes outcome logging and balance updates per spin. Next: daily limits, history view, jackpot events, and transparent odds display.',
    },
    {
      label:
        '🤝 Game invites for 1v1 or group play with Telegram notifications (Android/iOS push notifications after migration)',
      progress: 100,
      info:
        'Completed: 1v1 and group invites with Telegram notifications, match lobby deep links, and invite acceptance tracking. Includes invite status state (sent/accepted/expired). Next: Android/iOS push notifications post-migration, invite expiry rules, and in-app invite reminders.',
    },
    {
      label: '💬 In-game chat enabled',
      progress: 100,
      info:
        'Completed: real-time in-match chat with message delivery, basic emoji, and session persistence across reconnects. Includes message ordering and timestamps. Next: quick chat presets, anti-spam rate limits, mute/report actions, and chat history per match.',
    },
    {
      label: '🕹️ Telegram bot and web app integration',
      progress: 100,
      info:
        'Completed: Telegram bot connected to the web app for login, deep links, and shared account state. Includes one-click login and deep-link routing to tasks. Next: richer bot commands, account linking prompts, maintenance alerts, and bot-driven reminders.',
    },
    {
      label: '🔄 Daily Check-In rewards',
      progress: 100,
      info:
        'Completed: daily check-in streaks with consecutive-day tracking and immediate rewards. Includes streak reset rules and balance confirmation. Next: streak recovery items, calendar view, milestone bonuses, and reminder scheduling.',
    },
    {
      label: '⛏️ Mining system active',
      progress: 100,
      info:
        'Completed: mining accrual timers, claim flows, and reward calculations with time-based caps. Includes claim confirmations and ledger posting. Next: tiered mining boosts, cooldown indicators, anti-abuse monitoring, and boost history.',
    },
    {
      label: '📺 Ad watch rewards',
      progress: 100,
      info:
        'Completed: rewarded ad flow with completion verification and automatic crediting. Includes fallback handling and payout confirmation. Next: ad frequency caps, per-region fill controls, opt-out settings, and reward history.',
    },
    {
      label: '🎯 Social tasks for X, Telegram, TikTok',
      progress: 100,
      info:
        'Completed: social quests for X, Telegram, and TikTok with task completion tracking and payouts. Includes task status tracking and reward logs. Next: proof-of-completion checks, campaign scheduling, anti-fraud validation, and multi-step quest chains.',
    },
    {
      label: '📹 Intro video view rewards',
      progress: 100,
      info:
        'Completed: intro video reward flow with completion detection and payout. Includes view validation and reward logs. Next: multi-language video variants, rewatch limits, and video progress tracking.',
    },
    {
      label: '🎡 Spin & Win wheel',
      progress: 100,
      info:
        'Completed: Spin & Win wheel with randomized prizes, animations, and reward delivery. Includes prize audit log and balance confirmation. Next: seasonal prize pools, rarity odds transparency, and cooldown timers.',
    },
    {
      label: '🍀 Lucky Card prizes',
      progress: 100,
      info:
        'Completed: Lucky Card draws with reveal animation, prize validation, and auto-crediting. Includes draw history and reward audit. Next: limited-time card sets, streak bonuses, and rarity indicators.',
    },
    {
      label: '🎁 NFT gifts',
      progress: 100,
      info:
        'Completed: NFT gift distribution for campaigns, rewards, and partner drops with claim tracking. Includes ownership updates and claim receipts. Next: gift previews, rarity labels, transfer history, and gift collections.',
    },
    {
      label: '🚀 Referral boost: invite more friends to earn more TPC',
      progress: 100,
      info:
        'Completed: referral boosts tied to invited friends, conversion tracking, and bonus payouts. Includes referral status updates and reward logs. Next: referral tiers, invite analytics dashboard, and anti-fraud checks.',
    },
    {
      label: '🛒 NFT marketplace for user listings',
      progress: 100,
      info:
        'Completed: NFT marketplace listings, browsing, and purchases with ownership updates. Includes listing detail view and purchase receipts. Next: seller analytics, floor price view, listing history, and royalty transparency.',
    },
    {
      label: '🏆 Game tournaments live',
      progress: 100,
      info:
        'Completed: tournament brackets, matchmaking, and leaderboard updates. Includes bracket progression and match results tracking. Next: tournament seasons, entry fees, anti-cheat enforcement, and prize transparency.',
    },
    {
      label: '🎁 Tournament winner gifts',
      progress: 100,
      info:
        'Completed: automated gift delivery to winners with audit logs. Includes fulfillment confirmation and delivery receipts. Next: tiered prize pools, on-chain proof of rewards, and claim windows.',
    },
    {
      label: '🏦 Game transactions are public',
      progress: 100,
      info:
        'Completed: public ledger entries for game transactions with verification visibility. Includes transaction detail view and status flags. Next: explorer links, advanced filters, and export for audits.',
    },
    {
      label: '⛏️ Mining transactions are public',
      progress: 100,
      info:
        'Completed: public mining transaction records for auditable rewards and claims. Includes claim IDs and timestamps. Next: explorer deep links, export tools, and per-user history filters.',
    },
  ];

  const roadmapSteps = [
    {
      title: 'Online Connection Fix',
      description:
        'Fixing the online connection is almost done, partly completed with a bit left to finalize.',
      progress: 85,
      info:
        'Done: stability patches for session joins, improved lobby handshakes, and timeout tuning. Implemented retry logic and connection state tracking. Next: finalize reconnection flow, resolve edge-case disconnects, complete QA sign-off, and publish reliability metrics.',
    },
    {
      title: 'Store Item Photos',
      description: 'Upload all necessary photos for the store items.',
      progress: 55,
      info:
        'Done: capture pipeline, size requirements, and initial batches uploaded. Thumbnails are generated with consistent crops. Next: finish remaining catalog, validate thumbnails, add high-res zoom previews, and tag items by category.',
    },
    {
      title: 'Mobile Launch',
      description:
        'Release the Playgram app on Android and iOS with the current 3D game lineup.',
      progress: 70,
      info:
        'Done: Android/iOS builds with core 3D titles and onboarding flow stabilized. Added crash logging and build metadata. Next: store compliance checks, performance tuning, final release submission, and release notes.',
    },
    {
      title: 'Growth & Community',
      description:
        'Gather Telegram group feedback to identify glitches, errors, and malfunctions, then take new feature requests to community votes so every voice is heard.',
      progress: 40,
      info:
        'Done: feedback channels organized and initial bug triage underway. Started weekly summaries and labeled issue categories. Next: formal community voting, monthly roadmap reviews, public issue status updates, and community AMA sessions.',
    },
    {
      title: 'TPC Tokenization',
      description:
        'Mint the official TPC token and finalize token utility across the ecosystem.',
      info:
        'Done: token utility requirements drafted and reward flows scoped. Prepared draft utility matrix for rewards, marketplace, and tournaments. Next: finalize token economics, minting plan, audit process, and in-app utility rollout timeline.',
    },
    {
      title: 'Exchange Readiness',
      description:
        'Begin CEX outreach and prepare DEX liquidity provisioning.',
      info:
        'Done: exchange target list and readiness checklist drafted. Assembled data room requirements and listing prerequisites. Next: compliance docs, liquidity provisioning plan, outreach cadence, and legal review.',
    },
    {
      title: 'CEX + DEX Listings',
      description:
        'List on decentralized exchanges and finalize listings on major CEX partners.',
      info:
        'Done: listing requirements compiled and partner shortlist created. Prepared draft listing timelines and launch comms plan. Next: finalize DEX deployment, complete CEX negotiations, confirm liquidity partners, and announce timelines.',
    },
    {
      title: 'Next Phases',
      description:
        'Post-listing initiatives are in progress and will be announced after CEX/DEX milestones.',
      info:
        'Done: post-listing initiative backlog defined. Prioritized features across gameplay, social, and rewards. Next: unveil new game features, partnerships, platform enhancements, and multi-season roadmap after listings are complete.',
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
      info: `${step.info ?? step.description} Current progress: ${step.progress}%.`,
    }));
  const achievements = [...deliveredAchievements, ...promotedRoadmapAchievements];
  const roadmap = normalizedRoadmapSteps.filter(
    (step) => step.progress < completionThreshold,
  );
  const achievementsProgress = calculateAverageProgress(achievements);
  const roadmapProgress = calculateAverageProgress(normalizedRoadmapSteps);

  const poolVariants = [
    {
      name: '8Ball',
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
  const liveGameDetails = {
    'Snakes & Ladders': {
      info:
        'Classic board game mode is live with turn-based rolls, animated pieces, and rewards tied to match outcomes.',
    },
    Roulette: {
      info:
        'Roulette is fully playable with real-time spin results, payout resolution, and reward delivery.',
    },
    'Pool Royale': {
      info:
        'Pool Royale is in progress with core physics and visuals delivered; multiplayer matchmaking and ranked progression are the next gaps to close.',
    },
    '8Ball': {
      info:
        '8Ball ruleset is live with polished ball physics, AI opponents, and shot timers. Online PvP is next.',
    },
    '9 Ball': {
      info:
        '9 Ball mode is live with accurate rack rules, foul detection, and AI play. Competitive online lobbies remain in progress.',
    },
    'American Billiards': {
      info:
        'American Billiards is available with table physics tuned for the ruleset; ranked matchmaking and tournaments are still planned.',
    },
  };
  const getGameInfo = (game) =>
    liveGameDetails[game.name]?.info
    ?? 'Core gameplay is delivered and playable. Missing pieces are the next multiplayer, progression, and competitive layers.';

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
              className="rounded-lg border border-border/40 bg-surface/90 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{item.label}</span>
                  <InfoIcon info={item.info} label={item.label} />
                </div>
                <span className="text-[10px] font-semibold text-emerald-400">{item.progress}%</span>
              </div>
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
          Pool Royale includes 8Ball, 9 Ball, and American Billiards. All games are fully
          playable (currently local vs AI only).
        </p>
        <div className="grid grid-cols-4 gap-2">
          {liveGameLineup.map((game) => {
            const thumbnail = getGameThumbnail(game.slug);
            return (
              <div
                key={game.name}
                className="relative flex flex-col items-center gap-1 rounded-lg border border-border/50 bg-surface/90 p-2 text-center"
              >
                <div className="absolute right-1 top-1">
                  <InfoIcon info={getGameInfo(game)} label={game.name} />
                </div>
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
              <div className="mt-1 flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <InfoIcon
                  info={`${step.info ?? step.description} Current progress: ${step.progress}%.`}
                  label={step.title}
                />
              </div>
              <p className="text-xs text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
      {activeInfo && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveInfo(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border/70 bg-surface/95 p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{activeInfo.title}</p>
                <p className="mt-2 text-xs text-muted">{activeInfo.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveInfo(null)}
                className="rounded-full border border-border/60 px-2 py-1 text-[10px] font-semibold text-muted transition hover:text-foreground"
                aria-label="Close info dialog"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
