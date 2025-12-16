import { useEffect, useRef, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { getGameTransactions } from '../utils/api.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';
import { getActiveHighlights } from '../utils/highlightStorage.js';

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
  const [highlights, setHighlights] = useState([]);
  const highlightUrlsRef = useRef({});

  useEffect(() => {
    getGameTransactions(1000)
      .then((res) => setTransactions(res.transactions || []))
      .catch(() => setTransactions([]));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadHighlights = async () => {
      try {
        const active = await getActiveHighlights();
        if (cancelled) return;
        const urlMap = {};
        const decorated = active.map((entry) => {
          const url = URL.createObjectURL(entry.blob);
          urlMap[entry.id] = url;
          return { ...entry, url };
        });
        Object.values(highlightUrlsRef.current).forEach((href) => URL.revokeObjectURL(href));
        highlightUrlsRef.current = urlMap;
        setHighlights(decorated);
      } catch (err) {
        console.warn('Unable to load highlights', err);
        setHighlights([]);
      }
    };

    loadHighlights();

    return () => {
      cancelled = true;
      Object.values(highlightUrlsRef.current).forEach((href) => URL.revokeObjectURL(href));
    };
  }, []);

  const formatValue = (v) =>
    Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatExpiresIn = (expiresAt) => {
    const remaining = Math.max(0, expiresAt - Date.now());
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    if (hours <= 0) return `${minutes}m left`;
    return `${hours}h ${minutes}m left`;
  };

  const HIGHLIGHT_WINDOW_MS = 24 * 60 * 60 * 1000;

  const findHighlightForTx = (tx) => {
    if (!tx?.game) return null;
    const txTime = tx.date ? new Date(tx.date).getTime() : Date.now();
    return (
      highlights.find(
        (entry) => entry.game === tx.game && Math.abs(txTime - entry.createdAt) <= HIGHLIGHT_WINDOW_MS
      ) || null
    );
  };

  const downloadHighlight = (entry) => {
    if (!entry?.blob) return;
    const filename = `${entry.game || 'game'}-highlight-${entry.quality || 'hd'}.webm`;
    const url = entry.url || URL.createObjectURL(entry.blob);
    const tg = window?.Telegram?.WebApp;

    const trigger = (href) => {
      const link = document.createElement('a');
      link.href = href;
      link.download = filename;
      link.rel = 'noopener';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      link.remove();
    };

    if (tg?.downloadFile) {
      tg.downloadFile({ url, file_name: filename });
    } else if (tg?.openLink) {
      tg.openLink(url, { try_instant_view: false });
    }

    trigger(url);

    if (!entry.url) {
      URL.revokeObjectURL(url);
    }
  };

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
          const highlight = findHighlightForTx(tx);
          return (
            <div key={i} className="lobby-tile w-full flex justify-between items-center">
              <div className="flex w-full flex-col gap-2">
                <div className="flex items-center justify-between">
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
                  </div>
                </div>
                {highlight && (
                  <div className="w-full space-y-2 rounded-lg border border-border bg-surface/80 p-2">
                    <div className="flex items-center justify-between text-xs text-subtext">
                      <span>
                        Highlight ready — {highlight.quality?.toUpperCase?.() || 'HD'} · expires in{' '}
                        {formatExpiresIn(highlight.expiresAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => downloadHighlight(highlight)}
                        className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text transition hover:border-emerald-400 hover:text-emerald-300"
                      >
                        Download
                      </button>
                    </div>
                    <video
                      controls
                      playsInline
                      src={highlight.url}
                      className="h-48 w-full rounded-md border border-border bg-black object-contain"
                    />
                    {highlight.metadata?.playerName && highlight.metadata?.opponentName && (
                      <div className="text-[11px] text-subtext">
                        {highlight.metadata.playerName} vs {highlight.metadata.opponentName}
                      </div>
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
