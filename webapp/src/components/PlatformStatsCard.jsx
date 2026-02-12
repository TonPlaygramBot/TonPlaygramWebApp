import { useEffect, useMemo, useState } from 'react';
import { FaCoins, FaFireAlt, FaGamepad, FaLayerGroup, FaUsers } from 'react-icons/fa';
import { GiToken } from 'react-icons/gi';

import { getAppStats } from '../utils/api.js';

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

function firstNumber(source, keys) {
  for (const key of keys) {
    const parts = key.split('.');
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
  return null;
}

function formatStat(value) {
  if (value === null) return '—';
  return numberFormatter.format(Math.round(value));
}

function formatCompact(value) {
  if (value === null) return '—';
  return compactFormatter.format(value);
}

export default function PlatformStatsCard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    getAppStats()
      .then((res) => {
        if (mounted) setStats(res || {});
      })
      .catch(() => {
        if (mounted) setStats({});
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const normalizedStats = useMemo(() => {
    const users = firstNumber(stats, ['accounts', 'users', 'totalUsers', 'community.users']);

    const tpcCirculating = firstNumber(stats, [
      'appClaimed',
      'tpcCirculating',
      'circulatingSupply',
      'token.circulating',
      'balances.circulating'
    ]);

    const nftMinted =
      firstNumber(stats, ['nftsCreated', 'nftMinted', 'nftsMinted', 'nft.minted', 'nfts.total']);

    const nftBurned =
      firstNumber(stats, ['nftsBurned', 'nftBurned', 'nft.burned', 'nfts.retired']);

    const activeMatches =
      firstNumber(stats, ['activeUsers', 'activeMatches', 'matchesLive', 'games.active']);

    const socialActions =
      firstNumber(stats, [
        'bundlesSold',
        'socialActions',
        'engagements',
        'social.totalActions',
        'tasksCompleted'
      ]);

    const mintedSupply = firstNumber(stats, ['minted', 'token.minted', 'supply.total']);

    const burnRate = nftMinted && nftBurned && nftMinted > 0 ? (nftBurned / nftMinted) * 100 : 0;

    return {
      users,
      tpcCirculating,
      mintedSupply,
      nftMinted,
      nftBurned,
      activeMatches,
      socialActions,
      burnRate
    };
  }, [stats]);

  const statTiles = [
    {
      label: 'Registered users',
      value: formatStat(normalizedStats.users),
      helper: 'Total accounts on the platform',
      icon: FaUsers,
      iconClass: 'text-sky-300'
    },
    {
      label: 'TPC in circulation',
      value: formatStat(normalizedStats.tpcCirculating),
      helper:
        normalizedStats.tpcCirculating === null
          ? 'Pulled from /api/stats appClaimed'
          : `~${formatCompact(normalizedStats.tpcCirculating)} TPC live`,
      icon: GiToken,
      iconClass: 'text-yellow-300'
    },
    {
      label: 'TPC minted',
      value: formatStat(normalizedStats.mintedSupply),
      helper: 'Lifetime mined + distributed supply',
      icon: FaCoins,
      iconClass: 'text-amber-300'
    },
    {
      label: 'NFTs active',
      value: formatStat(normalizedStats.nftMinted),
      helper: 'NFT gifts currently in wallets',
      icon: FaLayerGroup,
      iconClass: 'text-purple-300'
    },
    {
      label: 'NFTs burned',
      value: formatStat(normalizedStats.nftBurned),
      helper: `${normalizedStats.burnRate.toFixed(1)}% lifecycle burn rate`,
      icon: FaFireAlt,
      iconClass: 'text-orange-300'
    },
    {
      label: 'Live matches',
      value: formatStat(normalizedStats.activeMatches),
      helper: 'Currently online players',
      icon: FaGamepad,
      iconClass: 'text-emerald-300'
    },
    {
      label: 'Bundles sold',
      value: formatStat(normalizedStats.socialActions),
      helper: 'Store purchases recorded in history',
      icon: FaUsers,
      iconClass: 'text-indigo-300'
    }
  ];

  return (
    <section className="relative bg-surface border border-border rounded-xl p-4 overflow-hidden wide-card">
      <img
        src="/assets/icons/snakes_and_ladders.webp"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <div className="relative z-10">
        <div className="mb-3">
          <h3 className="text-lg font-bold text-white text-center">Platform stats</h3>
          <p className="text-xs text-subtext text-center">
            {loading
              ? 'Syncing latest ecosystem metrics...'
              : 'Numbers are sourced from /api/stats with no seeded placeholders.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {statTiles.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-border bg-background/55 p-3">
                <div className="flex items-center gap-2">
                  <Icon className={item.iconClass} />
                  <p className="text-[11px] text-subtext">{item.label}</p>
                </div>
                <p className="mt-2 text-base font-semibold text-white">{item.value}</p>
                <p className="text-[10px] text-subtext mt-1">{item.helper}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
