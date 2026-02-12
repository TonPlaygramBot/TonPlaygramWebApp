import { useEffect, useMemo, useState } from 'react';
import {
  FaBolt,
  FaCoins,
  FaExchangeAlt,
  FaGamepad,
  FaGlobe,
  FaGoogle,
  FaShieldAlt,
  FaTelegram,
  FaUserCheck,
  FaUsers
} from 'react-icons/fa';

import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  getAppStats,
  getDetailedAppStats,
  getGameTransactions,
  getMiningTransactions,
  getPublicTransfers
} from '../utils/api.js';

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1
});

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = Number(value.replace(/[,_\s]/g, ''));
    return Number.isFinite(normalized) ? normalized : null;
  }
  return null;
}

function pickNumber(source, paths, fallback = null) {
  for (const path of paths) {
    const parts = path.split('.');
    let current = source;
    for (const part of parts) {
      if (!current || typeof current !== 'object') {
        current = undefined;
        break;
      }
      current = current[part];
    }
    const parsed = toNumber(current);
    if (parsed !== null) return parsed;
  }
  return fallback;
}

function formatStat(value) {
  if (value === null || value === undefined) return '—';
  return numberFormatter.format(Math.round(value));
}

function formatCompact(value) {
  if (value === null || value === undefined) return '—';
  return compactFormatter.format(value);
}

function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}

function StatCard({ label, value, helper, icon: Icon, iconClass = 'text-sky-300' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Icon className={iconClass} />
        <p className="text-[11px] text-subtext">{label}</p>
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {helper ? <p className="mt-1 text-[10px] leading-snug text-subtext">{helper}</p> : null}
    </div>
  );
}

export default function PlatformStatsDetails() {
  useTelegramBackButton();

  const [stats, setStats] = useState(null);
  const [detailed, setDetailed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameTransactions, setGameTransactions] = useState([]);
  const [miningTransactions, setMiningTransactions] = useState([]);
  const [transferTransactions, setTransferTransactions] = useState([]);
  const [transferTotalCount, setTransferTotalCount] = useState(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    let mounted = true;

    const safePayload = (result, fallback) => {
      if (result.status !== 'fulfilled') return fallback;
      if (!result.value || typeof result.value !== 'object') return fallback;
      if (result.value.error) return fallback;
      return result.value;
    };

    Promise.allSettled([
      getAppStats(),
      getDetailedAppStats(),
      getGameTransactions(200),
      getMiningTransactions(200),
      getPublicTransfers(200)
    ])
      .then(([statsRes, detailRes, gamesRes, miningRes, transferRes]) => {
        if (!mounted) return;
        setStats(safePayload(statsRes, {}));
        setDetailed(safePayload(detailRes, { summary: {}, suspiciousPreview: [] }));
        setGameTransactions(safePayload(gamesRes, { transactions: [] }).transactions || []);
        setMiningTransactions(safePayload(miningRes, { transactions: [] }).transactions || []);
        const transferPayload = safePayload(transferRes, { transactions: [], totalCount: null });
        setTransferTransactions(transferPayload.transactions || []);
        const parsedTransferTotal = toNumber(transferPayload.totalCount);
        setTransferTotalCount(parsedTransferTotal);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const summary = detailed?.summary || {};
  const suspiciousPreview = Array.isArray(detailed?.suspiciousPreview) ? detailed.suspiciousPreview : [];

  const normalized = useMemo(() => {
    const totalUsers =
      pickNumber(stats, ['totalUsers', 'users', 'community.users']) ??
      pickNumber(stats, ['accounts']) ??
      pickNumber(summary, ['authenticAccounts']) ??
      pickNumber(stats, ['totalUsers', 'accounts', 'users', 'community.users']);
    const telegramUsers =
      pickNumber(summary, ['telegramAccounts']) ??
      pickNumber(stats, [
      'telegramAccounts',
      'usersByProvider.telegram',
      'accountsByProvider.telegram'
    ]);
    const googleUsers =
      pickNumber(summary, ['googleAccounts']) ??
      pickNumber(stats, [
      'googleAccounts',
      'usersByProvider.google',
      'accountsByProvider.google'
    ]);

    const authenticatedUsers =
      pickNumber(summary, ['authenticAccounts']) ??
      pickNumber(stats, ['authenticAccounts']) ??
      (telegramUsers !== null && googleUsers !== null ? telegramUsers + googleUsers : null);

    const guestUsers =
      pickNumber(summary, ['unauthenticatedAccounts']) ??
      pickNumber(stats, ['unauthenticatedAccounts']) ??
      (totalUsers !== null && authenticatedUsers !== null ? Math.max(totalUsers - authenticatedUsers, 0) : null);

    const bannedUsers =
      pickNumber(summary, ['bannedAccounts']) ?? pickNumber(stats, ['bannedAccounts']);

    const activeUsers = pickNumber(stats, ['activeUsers', 'users.active']);

    const circulatingTpc = pickNumber(stats, [
      'appClaimed',
      'tpcCirculating',
      'circulatingSupply',
      'token.circulating'
    ]);

    const mintedTpc = pickNumber(stats, ['minted', 'token.minted', 'supply.total']);

    const bundleSales = pickNumber(stats, [
      'bundlesSold',
      'socialActions',
      'engagements',
      'social.totalActions',
      'tasksCompleted'
    ]);

    const liveGames = pickNumber(stats, ['activeMatches', 'games.active', 'matchesLive']);
    const gamesPlayed = pickNumber(stats, ['gamesPlayed', 'matchesPlayed', 'games.total', 'matches.total']);

    const transferCount = pickNumber(stats, [
      'transferCount',
      'transfers',
      'transactions.total',
      'wallet.transfersCount'
    ]);
    const transferVolume = pickNumber(stats, [
      'transferVolume',
      'transfersAmount',
      'transactions.volume',
      'wallet.transfersVolume'
    ]);

    const nftMinted = pickNumber(stats, ['nftsCreated', 'nftMinted', 'nftsMinted', 'nfts.total']);
    const nftBurned = pickNumber(stats, ['nftsBurned', 'nftBurned', 'nfts.retired']);

    const gameTransactions = pickNumber(stats, ['gameTransactions']);
    const gameVolume = pickNumber(stats, ['gameVolume']);
    const miningTransactionsCount = pickNumber(stats, ['miningTransactions']);
    const miningVolume = pickNumber(stats, ['miningVolume']);
    const integrityGap = pickNumber(stats, ['integrity.ledgerGap']);

    const userActivityRatio =
      totalUsers > 0 && activeUsers !== null ? (activeUsers / totalUsers) * 100 : null;
    const authCoverage =
      totalUsers > 0 && authenticatedUsers !== null ? (authenticatedUsers / totalUsers) * 100 : null;
    const burnRate = nftMinted > 0 && nftBurned !== null ? (nftBurned / nftMinted) * 100 : null;

    return {
      totalUsers,
      telegramUsers,
      googleUsers,
      authenticatedUsers,
      guestUsers,
      bannedUsers,
      activeUsers,
      userActivityRatio,
      authCoverage,
      circulatingTpc,
      mintedTpc,
      bundleSales,
      liveGames,
      gamesPlayed,
      transferCount,
      transferVolume,
      nftMinted,
      nftBurned,
      gameTransactions,
      gameVolume,
      miningTransactionsCount,
      miningVolume,
      integrityGap,
      burnRate
    };
  }, [stats, summary]);

  const topCards = [
    {
      label: 'Registered users',
      value: formatStat(normalized.totalUsers),
      helper: `${formatStat(normalized.telegramUsers)} Telegram • ${formatStat(normalized.googleUsers)} Google`,
      icon: FaUsers,
      iconClass: 'text-sky-300'
    },
    {
      label: 'Live users now',
      value: formatStat(normalized.activeUsers),
      helper: `${formatPercent(normalized.userActivityRatio)} of community online`,
      icon: FaBolt,
      iconClass: 'text-emerald-300'
    },
    {
      label: 'TPC in circulation',
      value: formatStat(normalized.circulatingTpc),
      helper: `≈ ${formatCompact(normalized.circulatingTpc)} TPC`,
      icon: FaCoins,
      iconClass: 'text-yellow-300'
    },
    {
      label: 'Games in progress',
      value: formatStat(normalized.liveGames),
      helper: normalized.gamesPlayed ? `${formatStat(normalized.gamesPlayed)} total games played` : 'Total games played unavailable',
      icon: FaGamepad,
      iconClass: 'text-indigo-300'
    }
  ];

  const operationsCards = [
    {
      label: 'Transfers made',
      value: formatStat(normalized.transferCount),
      helper:
        normalized.transferVolume === null
          ? 'Transfer volume not provided by API'
          : `${formatCompact(normalized.transferVolume)} TPC moved`,
      icon: FaExchangeAlt,
      iconClass: 'text-cyan-300'
    },
    {
      label: 'Bundles sold',
      value: formatStat(normalized.bundleSales),
      helper: 'Store conversion count (bundle purchases)',
      icon: FaGlobe,
      iconClass: 'text-violet-300'
    },
    {
      label: 'Ledger integrity gap',
      value: formatStat(normalized.integrityGap),
      helper: 'Minted-from-ledger minus claimed distribution',
      icon: FaShieldAlt,
      iconClass: 'text-amber-300'
    },
    {
      label: 'NFT lifecycle',
      value: `${formatStat(normalized.nftMinted)} / ${formatStat(normalized.nftBurned)}`,
      helper: `${formatPercent(normalized.burnRate)} burned from minted supply`,
      icon: FaShieldAlt,
      iconClass: 'text-orange-300'
    }
  ];


  const formatValue = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const transactionHighlights = useMemo(() => {
    const gameVolume = gameTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);
    const miningVolume = miningTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);
    const transferVolumeLive = transferTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

    return {
      gameCount: gameTransactions.length,
      miningCount: miningTransactions.length,
      transferCount: transferTotalCount ?? transferTransactions.length,
      gameVolume,
      miningVolume,
      transferVolumeLive,
      transferPreview: transferTransactions.slice(0, 8)
    };
  }, [gameTransactions, miningTransactions, transferTransactions, transferTotalCount]);

  const trustCards = [
    {
      label: 'Authenticated accounts',
      value: formatStat(normalized.authenticatedUsers),
      helper: `${formatPercent(normalized.authCoverage)} identity coverage`,
      icon: FaUserCheck,
      iconClass: 'text-emerald-300'
    },
    {
      label: 'Guest accounts',
      value: formatStat(normalized.guestUsers),
      helper: 'Accounts without Telegram/Google identity',
      icon: FaUsers,
      iconClass: 'text-yellow-300'
    },
    {
      label: 'Banned accounts',
      value: formatStat(normalized.bannedUsers),
      helper: 'Restricted from ranking and gameplay',
      icon: FaShieldAlt,
      iconClass: 'text-rose-300'
    }
  ];

  return (
    <div className="space-y-4 pb-4 text-text">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4">
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-36 w-36 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative z-10">
          <h2 className="text-center text-2xl font-bold text-white">Platform Intelligence Center</h2>
          <p className="mt-2 text-center text-xs text-slate-200/90">
            Fully transparent operations snapshot across users, transfers, games, token flow, and trust controls.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        {topCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      <section className="rounded-xl border border-white/10 bg-surface/80 p-3">
        <h3 className="text-sm font-semibold text-white">Operations & economy</h3>
        <p className="mt-1 text-[11px] text-subtext">
          Core flow visibility from wallet movement, store conversions, and NFT lifecycle health.
        </p>
        <div className="mt-3 space-y-2">
          {operationsCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      </section>


      <section className="rounded-xl border border-white/10 bg-surface/80 p-3">
        <h3 className="text-sm font-semibold text-white">Transactions intelligence feed</h3>
        <p className="mt-1 text-[11px] text-subtext">
          Live rollup of game rewards, mining rewards, and user-to-user wallet transfers.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <StatCard
            label="Game transactions"
            value={formatStat(normalized.gameTransactions ?? transactionHighlights.gameCount)}
            helper={`${formatValue(normalized.gameVolume ?? transactionHighlights.gameVolume)} TPC moved`}
            icon={FaGamepad}
            iconClass="text-indigo-300"
          />
          <StatCard
            label="Mining transactions"
            value={formatStat(normalized.miningTransactionsCount ?? transactionHighlights.miningCount)}
            helper={`${formatValue(normalized.miningVolume ?? transactionHighlights.miningVolume)} TPC rewarded`}
            icon={FaBolt}
            iconClass="text-emerald-300"
          />
          <StatCard
            label="User transfers"
            value={formatStat(transactionHighlights.transferCount)}
            helper={`${formatValue(transactionHighlights.transferVolumeLive)} TPC sent`}
            icon={FaExchangeAlt}
            iconClass="text-cyan-300"
          />
        </div>
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
          {transactionHighlights.transferPreview.length === 0 ? (
            <p className="rounded-md border border-white/10 bg-black/20 p-3 text-xs text-subtext">
              No public wallet transfers detected yet.
            </p>
          ) : (
            transactionHighlights.transferPreview.map((tx, index) => (
              <div key={`${tx.fromAccount}-${tx.toAccount}-${tx.date || index}`} className="rounded-md border border-white/10 bg-black/20 p-2 text-xs">
                <div className="font-semibold text-white">
                  {(tx.fromName || tx.fromAccount || 'Unknown')} → {(tx.toName || tx.toAccount || 'Unknown')}
                </div>
                <div className="text-subtext">
                  {formatValue(tx.amount)} {(tx.token || 'TPC').toUpperCase()} • {tx.date ? new Date(tx.date).toLocaleString(undefined, { hour12: false }) : 'unknown date'}
                </div>
                {tx.note ? <div className="text-subtext">Note: {tx.note}</div> : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-surface/80 p-3">
        <h3 className="text-sm font-semibold text-white">Trust & account integrity</h3>
        <div className="mt-3 space-y-2">
          {trustCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
          <div className="rounded-xl border border-dashed border-white/20 bg-black/20 p-3 text-[11px] text-subtext">
            <div className="flex items-center gap-2 text-white">
              <FaTelegram className="text-sky-300" />
              <FaGoogle className="text-rose-300" />
              <span>Identity mix is continuously monitored.</span>
            </div>
            <p className="mt-2">
              Guest-only accounts are included in this audit panel and can be reviewed before cleanup actions.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-surface/80 p-3">
        <h3 className="font-semibold text-white">Suspicious accounts preview</h3>
        <p className="mt-1 text-xs text-subtext">
          Accounts without linked Telegram/Google identity for manual audit before admin cleanup.
        </p>
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {suspiciousPreview.length === 0 ? (
            <p className="rounded-md border border-white/10 bg-black/20 p-3 text-xs text-subtext">
              No suspicious guest accounts detected in current snapshot.
            </p>
          ) : (
            suspiciousPreview.map((row) => (
              <div
                key={row.accountId}
                className="rounded-md border border-white/10 bg-black/20 p-2 text-xs"
              >
                <div className="break-all font-semibold text-white">{row.accountId}</div>
                <div className="text-subtext">
                  Created: {row.createdAt ? new Date(row.createdAt).toLocaleString() : 'unknown'}
                </div>
                <div className="text-subtext">
                  Balance: {formatStat(row.balance)} • Tx: {formatStat(row.transactionCount)} • NFTs:{' '}
                  {formatStat(row.nftCount)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <p className="text-center text-[11px] text-subtext">
        {loading ? 'Syncing live platform telemetry…' : 'Telemetry synced. Counts are sourced from persisted ledger aggregates with computed ratios.'}
      </p>
    </div>
  );
}
