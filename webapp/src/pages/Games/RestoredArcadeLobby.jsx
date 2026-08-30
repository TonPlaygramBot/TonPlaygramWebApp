import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { socket } from '../../utils/socket.js';
import { ensureAccountId, getPlayerId } from '../../utils/telegram.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { RESTORED_ARCADE_GAMES } from '../../config/restoredArcadeGames.js';

export default function RestoredArcadeLobby() {
  const { game } = useParams();
  const config = RESTORED_ARCADE_GAMES[game];
  const navigate = useNavigate();
  useTelegramBackButton();
  const [stake, setStake] = useState(10);
  const [status, setStatus] = useState('Choose a mode');
  const [searching, setSearching] = useState(false);

  useEffect(() => { ensureAccountId().catch(() => {}); }, []);

  const playSolo = () => navigate(`/games/${game}?mode=solo`);
  const findMatch = async () => {
    if (searching) return;
    setSearching(true);
    setStatus('Finding an online rival…');
    try {
      const accountId = await ensureAccountId();
      socket.connect();
      socket.emit('register', { accountId });
      socket.emit('seatTable', {
        gameType: game, stake, maxPlayers: 2, tpcAccountNumber: accountId,
        playerName: localStorage.getItem('telegramUsername') || String(getPlayerId()),
        avatar: loadAvatar() || '', mode: 'online', token: 'TPG', ready: true
      }, (result) => {
        if (!result?.success) {
          setSearching(false);
          setStatus(`Could not join: ${result?.error || 'try again'}`);
          return;
        }
        if (result.started) navigate(`/games/${game}?mode=online&table=${encodeURIComponent(result.tableId)}`);
        else setStatus('Seat secured. Waiting for rival…');
      });
      const onStart = ({ tableId }) => navigate(`/games/${game}?mode=online&table=${encodeURIComponent(tableId)}`);
      socket.once('gameStart', onStart);
    } catch {
      setSearching(false);
      setStatus('Sign in to start online matchmaking.');
    }
  };

  if (!config) return null;
  return (
    <main className="mx-auto min-h-[78vh] max-w-md space-y-5 px-3 py-4 text-text">
      <GameLobbyHeader title={config.name} subtitle="Restored classic • portrait edition" />
      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 text-center shadow-2xl">
        <div className="text-7xl" aria-hidden="true">{config.icon}</div>
        <p className="mt-3 text-sm text-subtext">{config.instruction}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="rounded-2xl bg-white/10 px-3 py-4 font-bold" onClick={playSolo}>Practice</button>
          <button className="rounded-2xl bg-primary px-3 py-4 font-bold text-black" onClick={findMatch} disabled={searching}>Online 1v1</button>
        </div>
        <label className="mt-5 block text-left text-xs font-semibold uppercase tracking-wider text-subtext">Online stake</label>
        <select className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 p-3" value={stake} onChange={(event) => setStake(Number(event.target.value))}>
          {[10, 50, 100, 500].map((value) => <option key={value} value={value}>{value} TPG</option>)}
        </select>
        <p className="mt-4 min-h-5 text-sm text-primary" role="status">{status}</p>
      </section>
    </main>
  );
}
