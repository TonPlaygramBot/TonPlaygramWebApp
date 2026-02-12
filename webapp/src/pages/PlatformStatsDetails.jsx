import { useEffect, useMemo, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { getAppStats, getDetailedAppStats } from '../utils/api.js';

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function stat(value) {
  return numberFormatter.format(Number(value) || 0);
}

export default function PlatformStatsDetails() {
  useTelegramBackButton();
  const [stats, setStats] = useState(null);
  const [detailed, setDetailed] = useState(null);

  useEffect(() => {
    getAppStats().then(setStats).catch(() => setStats({}));
    getDetailedAppStats()
      .then((data) => setDetailed(data || {}))
      .catch(() => setDetailed({ summary: {}, suspiciousPreview: [] }));
  }, []);

  const summary = detailed?.summary || {};
  const suspiciousPreview = detailed?.suspiciousPreview || [];

  const cards = useMemo(
    () => [
      { label: 'Authentic accounts', value: summary.authenticAccounts ?? stats?.accounts ?? 0 },
      { label: 'Telegram accounts', value: summary.telegramAccounts ?? stats?.telegramAccounts ?? 0 },
      { label: 'Google accounts', value: summary.googleAccounts ?? stats?.googleAccounts ?? 0 },
      { label: 'Unauthenticated accounts (active)', value: summary.unauthenticatedAccounts ?? stats?.unauthenticatedAccounts ?? 0 },
      { label: 'Banned accounts', value: summary.bannedAccounts ?? stats?.bannedAccounts ?? 0 },
      { label: 'Active users now', value: stats?.activeUsers ?? 0 }
    ],
    [summary, stats]
  );

  return (
    <div className="space-y-4 text-text pb-4">
      <h2 className="text-2xl font-bold text-center mt-4">Platform Stats Details</h2>
      <p className="text-xs text-subtext text-center">
        Home now only counts authentic Telegram/Google accounts. Any guest-only accounts should be moved into the banned pool.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {cards.map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-surface p-3">
            <p className="text-[11px] text-subtext">{item.label}</p>
            <p className="text-lg font-semibold text-white mt-1">{stat(item.value)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-3">
        <h3 className="font-semibold text-white">Suspicious accounts preview</h3>
        <p className="text-xs text-subtext mt-1">
          These accounts have no Telegram/Google identity and should be reviewed with
          <code className="mx-1">POST /api/admin/accounts/cleanup-fake</code>
          (preview first, then execute with API token).
        </p>
        <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
          {suspiciousPreview.length === 0 ? (
            <p className="text-xs text-subtext">No suspicious guest accounts detected.</p>
          ) : (
            suspiciousPreview.map((row) => (
              <div key={row.accountId} className="rounded-md border border-border bg-background/40 p-2 text-xs">
                <div className="text-white font-semibold break-all">{row.accountId}</div>
                <div className="text-subtext">Created: {row.createdAt ? new Date(row.createdAt).toLocaleString() : 'unknown'}</div>
                <div className="text-subtext">
                  Balance: {stat(row.balance)} • Tx: {stat(row.transactionCount)} • NFTs: {stat(row.nftCount)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
