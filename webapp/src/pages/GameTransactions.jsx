import { useEffect, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { getGameTransactions } from '../utils/api.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';

const GAME_NAME_MAP = {
  snake: 'Snake & Ladder',
  goalrush: 'Goal Rush',
  fallingball: 'Falling Ball',
  pool: 'Pool Royale',
  texas: "Texas Hold'em",
  domino: 'Domino Royal 3D',
  blackjack: 'Black Jack Multiplayer',
  murlan: 'Murlan Royale',
};

function getGameName(slug = '') {
  const entry = Object.entries(GAME_NAME_MAP).find(([key]) => slug?.startsWith(key));
  return entry ? entry[1] : slug;
}

export default function GameTransactions() {
  useTelegramBackButton();
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    getGameTransactions(1000)
      .then((res) => setTransactions(res.transactions || []))
      .catch(() => setTransactions([]));
  }, []);

  const formatValue = (v) =>
    Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const games = transactions.filter((t) => t.game);
  const totalGames = games.length;
  const totalDeposited = games
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const totalPayouts = games
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + Math.abs(t.amount || 0), 0);

  return (
    <div className="relative space-y-4 text-text">
      <h2 className="text-2xl font-bold text-center mt-4">Game Transactions</h2>
      <div className="bg-surface border border-border rounded-xl p-4 shadow-lg space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Total games played</span>
          <span>{totalGames}</span>
        </div>
        <div className="flex justify-between">
          <span>Total payouts</span>
          <span>{formatValue(totalPayouts)}</span>
        </div>
        <div className="flex justify-between">
          <span>Total deposited</span>
          <span>{formatValue(totalDeposited)}</span>
        </div>
      </div>
      <div className="space-y-1 text-sm max-h-[40rem] overflow-y-auto border border-border rounded">
        {transactions.length === 0 && <div className="p-2">No transactions yet.</div>}
        {transactions.map((tx, i) => {
          const avatarSrc = tx.fromPhoto || tx.fromAvatar || tx.photo || '';
          const avatarUrl = avatarSrc ? getAvatarUrl(avatarSrc) : '/assets/icons/profile.svg';
          const gameName = getGameName(tx.game);
          const token = (tx.token || 'TPC').toUpperCase();
          const iconMap = {
            TPC: '/assets/icons/ezgif-54c96d8a9b9236.webp',
            TON: '/assets/icons/TON.webp',
            USDT: '/assets/icons/Usdt.webp',
          };
          const icon = iconMap[token] || `/assets/icons/${token}.webp`;
          const highlightUrl =
            tx.highlightUrl || tx.highlight?.url || tx.highlight || null;
          const highlightCreatedAt =
            tx.highlightCreatedAt || tx.highlight?.createdAt || tx.date || null;
          const highlightExpiresAt =
            tx.highlightExpiresAt ||
            tx.highlight?.expiresAt ||
            (highlightCreatedAt ? new Date(highlightCreatedAt).getTime() + 24 * 60 * 60 * 1000 : null);
          const highlightActive =
            highlightUrl && highlightExpiresAt && Number.isFinite(highlightExpiresAt) && Date.now() < highlightExpiresAt;
          const expiresLabel = highlightExpiresAt
            ? new Date(highlightExpiresAt).toLocaleString(undefined, { hour12: false })
            : null;

          const openHighlight = () => {
            if (!highlightUrl) return;
            window.open(highlightUrl, '_blank', 'noreferrer');
          };

          const downloadHighlight = () => {
            if (!highlightUrl) return;
            const link = document.createElement('a');
            link.href = highlightUrl;
            link.download = `${tx.game || 'game'}-highlight.webm`;
            link.rel = 'noopener';
            document.body.appendChild(link);
            link.click();
            link.remove();
          };
          return (
            <div key={i} className="lobby-tile w-full flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full" />
                <div>
                  <div className="font-semibold">{tx.fromName || tx.fromAccount}</div>
                  {gameName && <div className="text-xs text-subtext">{gameName}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className={tx.amount > 0 ? 'text-green-500' : 'text-red-500'}>
                  {tx.amount > 0 ? '+' : ''}
                  {formatValue(tx.amount)}
                  <img src={icon} alt={token} className="inline w-4 h-4 ml-1" />
                </div>
                <div className="text-xs">
                  {tx.date ? new Date(tx.date).toLocaleString(undefined, { hour12: false }) : ''}
                </div>
                {highlightActive && (
                  <div className="mt-2 space-y-1 text-left">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-200">Highlight</div>
                    <div className="flex flex-wrap justify-end gap-2 text-xs">
                      <button
                        type="button"
                        onClick={openHighlight}
                        className="rounded-lg bg-emerald-500/20 px-2 py-1 font-semibold text-emerald-100 transition hover:bg-emerald-500/40"
                      >
                        Watch
                      </button>
                      <button
                        type="button"
                        onClick={downloadHighlight}
                        className="rounded-lg bg-white/10 px-2 py-1 font-semibold text-white transition hover:bg-white/20"
                      >
                        Download
                      </button>
                    </div>
                    {expiresLabel && (
                      <div className="text-[11px] text-subtext">Available until {expiresLabel}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
