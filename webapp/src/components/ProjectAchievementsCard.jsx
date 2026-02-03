import { useState } from 'react';
import gamesCatalog from '../config/gamesCatalog.js';
import { getGameThumbnail } from '../config/gameAssets.js';

export default function ProjectAchievementsCard() {
  const [expandedInfo, setExpandedInfo] = useState({ type: null, key: null });
  const handleToggleInfo = (type, key) => {
    setExpandedInfo((current) => {
      if (current.type === type && current.key === key) {
        return { type: null, key: null };
      }
      return { type, key };
    });
  };
  const InfoIcon = ({ infoType, infoKey, label }) => (
    <button
      type="button"
      onClick={() => handleToggleInfo(infoType, infoKey)}
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
        'Completed: a full wallet ledger with timestamped deposits, withdrawals, rewards, and gameplay transfers. Each entry shows transaction type, source, and balance delta so audits are straightforward. Next: exportable statements (CSV/PDF), searchable transaction IDs, and advanced filters (date range, amount, source) with quick presets.',
    },
    {
      label: '💬 In-chat TPC transfers enabled',
      progress: 100,
      info:
        'Completed: peer-to-peer TPC transfers directly in chat with confirmations, balance updates, and receipts for each send. Status updates are embedded in the conversation for traceability. Next: optional transfer limits, scheduled sends, and scam-prevention alerts with receiver verification and risk checks.',
    },
    {
      label: '🧑‍🤝‍🤝 Friends and inbox chat',
      progress: 100,
      info:
        'Completed: friend list management, direct messaging, and system notifications. Players can add/remove friends, view online status, and receive delivery receipts with timestamps. Next: group inboxes, mute controls, and moderation tools (report, block, admin roles) with escalation workflows.',
    },
    {
      label: '🎰 Roulette spin live',
      progress: 100,
      info:
        'Completed: roulette minigame with live spin animation, prize resolution, and automated payout tracking. Spin results and rewards are logged per session for transparency. Next: daily limits, player history view, and jackpot events with capped exposure and published odds.',
    },
    {
      label:
        '🤝 Game invites for 1v1 or group play with Telegram notifications (Android/iOS push notifications after migration)',
      progress: 100,
      info:
        'Completed: 1v1 and group invites with Telegram notifications, match lobby deep links, and invite acceptance tracking. Invites show sender, mode, and time for clear context. Next: Android/iOS push notifications post-migration, invite expiry rules, and anti-spam throttling with rate limits.',
    },
    {
      label: '💬 In-game chat enabled',
      progress: 100,
      info:
        'Completed: real-time in-match chat with message delivery, basic emoji, and session persistence. Chat state remains visible during gameplay with delivery indicators. Next: quick chat presets, anti-spam rate limits, and mute/report actions with moderator review.',
    },
    {
      label: '🕹️ Telegram bot and web app integration',
      progress: 100,
      info:
        'Completed: Telegram bot connected to the web app for login, deep links, and shared account state. The bot can route users into specific screens and notify about matches. Next: richer bot commands, account linking prompts, and maintenance alerts with status banners.',
    },
    {
      label: '🔄 Daily Check-In rewards',
      progress: 100,
      info:
        'Completed: daily check-in streaks with consecutive-day tracking and immediate rewards. Reward claims update balances instantly with streak status. Next: streak recovery items, calendar view, and milestone bonuses with tiered payouts and previewed rewards.',
    },
    {
      label: '⛏️ Mining system active',
      progress: 100,
      info:
        'Completed: mining accrual timers, claim flows, and reward calculations. Users can start, wait, and claim with clear countdowns and balance updates. Next: tiered mining boosts, cooldown indicators, and anti-abuse monitoring with anomaly detection.',
    },
    {
      label: '📺 Ad watch rewards',
      progress: 100,
      info:
        'Completed: rewarded ad flow with completion verification and automatic crediting. Failed or interrupted ads do not pay out, and attempts are logged. Next: ad frequency caps, per-region fill controls, and opt-out settings with user consent.',
    },
    {
      label: '🎯 Social tasks for X, Telegram, TikTok',
      progress: 100,
      info:
        'Completed: social quests for X, Telegram, and TikTok with task completion tracking and payouts. Each task logs completion and reward status with timestamps. Next: proof-of-completion checks, campaign scheduling, and anti-fraud validation.',
    },
    {
      label: '📹 Intro video view rewards',
      progress: 100,
      info:
        'Completed: intro video reward flow with completion detection and payout. Users see clear progress and completion status tied to rewards. Next: multi-language video variants and rewatch limits with retention analytics.',
    },
    {
      label: '🎡 Spin & Win wheel',
      progress: 100,
      info:
        'Completed: Spin & Win wheel with randomized prizes, animations, and reward delivery. Reward outcomes are logged per spin for auditability. Next: seasonal prize pools and rarity odds transparency.',
    },
    {
      label: '🍀 Lucky Card prizes',
      progress: 100,
      info:
        'Completed: Lucky Card draws with reveal animation, prize validation, and auto-crediting. Prize history is tracked per user with timestamps. Next: limited-time card sets and streak bonuses.',
    },
    {
      label: '🎁 NFT gifts',
      progress: 100,
      info:
        'Completed: NFT gift distribution for campaigns, rewards, and partner drops with claim tracking. Users can see claim status, ownership, and drop source. Next: gift previews, rarity labels, and transfer history.',
    },
    {
      label: '🚀 Referral boost: invite more friends to earn more TPC',
      progress: 100,
      info:
        'Completed: referral boosts tied to invited friends, conversion tracking, and bonus payouts. Each referral shows status and reward value. Next: referral tiers, invite analytics, and anti-fraud checks with flagged patterns.',
    },
    {
      label: '🛒 NFT marketplace for user listings',
      progress: 100,
      info:
        'Completed: NFT marketplace listings, browsing, and purchases with ownership updates. Listings show price, owner, and availability with clear ownership changes. Next: seller analytics, floor price view, and listing history.',
    },
    {
      label: '🖼️ Store catalog photo set finalized',
      progress: 85,
      info:
        'In progress: most catalog photos are aligned, but some thumbnails still fall back to placeholders (notably chess pieces and other legacy items). Next: locate original captures for every remaining item, refresh the missing thumbnails, and re-verify lighting parity for the zoom previews.',
    },
    {
      label: '🏆 Game tournaments live',
      progress: 100,
      info:
        'Completed: tournament brackets, matchmaking, and leaderboard updates. Players can join, play, and see standings with match results. Next: tournament seasons, entry fees, and anti-cheat enforcement.',
    },
    {
      label: '🎁 Tournament winner gifts',
      progress: 100,
      info:
        'Completed: automated gift delivery to winners with audit logs. Winners receive confirmations and reward receipts. Next: tiered prize pools and on-chain proof of rewards.',
    },
    {
      label: '🏦 Game transactions are public',
      progress: 100,
      info:
        'Completed: public ledger entries for game transactions with verification visibility. Users can confirm IDs and timestamps per match. Next: explorer links and advanced filters.',
    },
    {
      label: '⛏️ Mining transactions are public',
      progress: 100,
      info:
        'Completed: public mining transaction records for auditable rewards and claims. Claim history stays visible with reward amounts. Next: explorer deep links and export tools.',
    },
  ];

  const roadmapSteps = [
    {
      title: 'Online Connection Fix',
      description:
        'Fixing the online connection is almost done, partly completed with a bit left to finalize.',
      progress: 85,
      info:
        'Done: stability patches for session joins, improved lobby handshakes, and timeout tuning. Sessions are more stable in high-latency cases with fewer mid-match drops. Next: finalize reconnection flow, resolve edge-case disconnects, and complete QA sign-off with load testing.',
      nextActions: [
        'Finalize reconnection flow for dropped sessions.',
        'Resolve edge-case disconnects across high-latency tests.',
        'Complete QA sign-off with load testing coverage.',
      ],
    },
    {
      title: 'Store Item Photos',
      description: 'Finalize the full store catalog photo set and keep image metadata aligned.',
      progress: 85,
      info:
        'In progress: the photo set is mostly complete, but several thumbnails are still missing originals (chess pieces and other legacy items). We need to locate the source images, update thumbnails, and re-check lighting match across zoom previews.',
      nextActions: [
        'Locate original renders for chess pieces and other missing thumbnails.',
        'Regenerate thumbnails from the original captures and verify metadata.',
        'Confirm lighting parity between the zoom preview and store thumbnails.',
      ],
    },
    {
      title: 'Mobile Launch',
      description:
        'Release the Playgram app on Android and iOS with the current 3D game lineup.',
      progress: 70,
      info:
        'Done: Android/iOS builds with core 3D titles and onboarding flow stabilized. Initial crash fixes are in place and device coverage is expanding. Next: store compliance checks, performance tuning, and final release submission with staged rollout.',
      nextActions: [
        'Finish store compliance checks and policy requirements.',
        'Tune performance for mid-range devices.',
        'Submit release builds with staged rollout plan.',
      ],
    },
    {
      title: 'Growth & Community',
      description:
        'Gather Telegram group feedback to identify glitches, errors, and malfunctions, then take new feature requests to community votes so every voice is heard.',
      progress: 40,
      info:
        'Done: feedback channels organized and initial bug triage underway. Top issues are tagged and routed to owners. Next: formal community voting, monthly roadmap reviews, and public issue status updates with resolution targets.',
      nextActions: [
        'Launch formal community voting for feature requests.',
        'Run monthly roadmap review cadence.',
        'Publish public issue status with resolution targets.',
      ],
    },
    {
      title: 'TPC Tokenization',
      description:
        'Mint the official TPC token and finalize token utility across the ecosystem.',
      info:
        'Done: token utility requirements drafted and reward flows scoped. Utility includes rewards, purchases, and marketplace use cases with compliance checks. Next: finalize token economics, minting plan, and in-app utility rollout timeline.',
      nextActions: [
        'Finalize token economics and minting plan.',
        'Lock the in-app utility rollout timeline.',
        'Confirm compliance checks for rewards and purchases.',
      ],
    },
    {
      title: 'Exchange Readiness',
      description:
        'Begin CEX outreach and prepare DEX liquidity provisioning.',
      info:
        'Done: exchange target list and readiness checklist drafted. Initial compliance requirements are outlined and owners assigned. Next: compliance docs, liquidity provisioning plan, and outreach cadence.',
      nextActions: [
        'Complete compliance documentation package.',
        'Define DEX liquidity provisioning plan.',
        'Set outreach cadence for CEX partners.',
      ],
    },
    {
      title: 'CEX + DEX Listings',
      description:
        'List on decentralized exchanges and finalize listings on major CEX partners.',
      info:
        'Done: listing requirements compiled and partner shortlist created. Pre-listing timelines are being estimated with dependency mapping. Next: finalize DEX deployment, complete CEX negotiations, and announce timelines.',
      nextActions: [
        'Finalize DEX deployment and liquidity launch.',
        'Complete CEX negotiations and agreements.',
        'Announce public listing timelines.',
      ],
    },
    {
      title: 'Next Phases',
      description:
        'Post-listing initiatives are in progress and will be announced after CEX/DEX milestones.',
      info:
        'Done: post-listing initiative backlog defined. Items include new game features, partnerships, and platform enhancements with owners. Next: unveil full roadmap after listings are complete.',
      nextActions: [
        'Finalize post-listing initiative owners.',
        'Prepare full roadmap announcement package.',
        'Sequence new game features and partnerships.',
      ],
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
                  <InfoIcon infoType="achievement" infoKey={item.label} label={item.label} />
                </div>
                <span className="text-[10px] font-semibold text-emerald-400">
                  {item.progress}%
                </span>
              </div>
              {expandedInfo.type === 'achievement' && expandedInfo.key === item.label && (
                <p className="mt-2 text-[11px] leading-relaxed text-muted">{item.info}</p>
              )}
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
            const gameInfo = getGameInfo(game);
            return (
              <div
                key={game.name}
                className="relative flex flex-col items-center gap-1 rounded-lg border border-border/50 bg-surface/90 p-2 text-center"
              >
                <div className="absolute right-1 top-1">
                  <InfoIcon infoType="game" infoKey={game.name} label={game.name} />
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
                {expandedInfo.type === 'game' && expandedInfo.key === game.name && (
                  <p className="text-[9px] leading-relaxed text-muted/80">{gameInfo}</p>
                )}
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
                <div>
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-xs text-muted">{step.description}</p>
                  {step.nextActions?.length ? (
                    <div className="mt-2 rounded-lg border border-border/50 bg-surface/80 px-2 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted/70">
                        Next actions
                      </p>
                      <ul className="mt-1 space-y-1 text-[11px] text-muted">
                        {step.nextActions.map((action) => (
                          <li key={action} className="flex gap-2">
                            <span className="text-emerald-400">•</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <InfoIcon
                  infoType="roadmap"
                  infoKey={step.title}
                  label={step.title}
                />
              </div>
              {expandedInfo.type === 'roadmap' && expandedInfo.key === step.title && (
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  {step.info ?? step.description} Current progress: {step.progress}%.
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
