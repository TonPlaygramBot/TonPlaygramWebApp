import { useEffect, useMemo, useRef, useState } from 'react';
import { Client, Room } from '@colyseus/sdk';
import { useNavigate } from 'react-router-dom';
import { ensureAccountId, getTelegramFirstName, getTelegramPhotoUrl } from '../../utils/telegram.js';

type Player = { sessionId: string; accountId: string; name: string; avatar: string; ready: boolean; connected: boolean };
type LobbySnapshot = { players: Player[]; phase: string; invitationCode: string; countdownEndsAt: number; minPlayers: number; maxPlayers: number };
const EMPTY: LobbySnapshot = { players: [], phase: 'idle', invitationCode: '', countdownEndsAt: 0, minPlayers: 2, maxPlayers: 2 };
const ENDPOINT = import.meta.env.VITE_CHESS_COLYSEUS_URL || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:2567`;

function snapshot(state: any): LobbySnapshot {
  const players: Player[] = [];
  state?.players?.forEach?.((p: any, sessionId: string) => players.push({ sessionId, accountId: p.accountId, name: p.name, avatar: p.avatar, ready: p.ready, connected: p.connected }));
  return { players, phase: state?.phase || 'waiting', invitationCode: state?.invitationCode || '', countdownEndsAt: state?.countdownEndsAt || 0, minPlayers: 2, maxPlayers: 2 };
}

const newCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export default function ChessMultiplayerLobby() {
  const navigate = useNavigate();
  const client = useMemo(() => new Client(ENDPOINT), []);
  const roomRef = useRef<Room>();
  const startedAt = useRef(0);
  const [roomType, setRoomType] = useState<'public' | 'private'>('public');
  const [inviteCode, setInviteCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'joined' | 'reconnecting' | 'error'>('idle');
  const [message, setMessage] = useState('Choose a room to start matchmaking.');
  const [lobby, setLobby] = useState(EMPTY);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const accountId = localStorage.getItem('accountId') || localStorage.getItem('tpcAccountId') || '';
  const me = lobby.players.find((p) => p.accountId === accountId);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (startedAt.current) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      setCountdown(lobby.countdownEndsAt ? Math.max(0, Math.ceil((lobby.countdownEndsAt - Date.now()) / 1000)) : 0);
    }, 250);
    return () => window.clearInterval(timer);
  }, [lobby.countdownEndsAt]);

  useEffect(() => () => { roomRef.current?.leave(true); }, []);

  const bindRoom = (room: Room) => {
    roomRef.current = room;
    sessionStorage.setItem('chessColyseusReconnectToken', room.reconnectionToken);
    room.onStateChange((state) => setLobby(snapshot(state)));
    room.onMessage('match_start', (payload) => {
      sessionStorage.removeItem('chessColyseusReconnectToken');
      navigate(`/games/chessbattleroyal?mode=online&colyseusRoomId=${encodeURIComponent(payload.roomId)}&accountId=${encodeURIComponent(accountId)}`);
    });
    room.onLeave((code) => {
      roomRef.current = undefined;
      if (code !== 1000 && status !== 'idle') setStatus('reconnecting');
    });
    setStatus('joined');
    setMessage('Waiting for opponent');
    setLobby(snapshot(room.state));
  };

  const authOptions = async () => {
    const resolved = await ensureAccountId();
    return {
      accountId: String(resolved || accountId),
      name: getTelegramFirstName() || 'Player',
      avatar: getTelegramPhotoUrl() || '',
      initData: window.Telegram?.WebApp?.initData || ''
    };
  };

  const join = async (createPrivate = false) => {
    setStatus('connecting'); setMessage('Contacting the authoritative matchmaker…'); setLobby(EMPTY);
    try {
      const identity = await authOptions();
      const visibility = roomType;
      const code = visibility === 'private' ? (createPrivate ? newCode() : inviteCode.trim().toUpperCase()) : '';
      if (visibility === 'private' && !code) throw new Error('Enter an invitation code.');
      const room = await client.joinOrCreate('chess_lobby', { ...identity, visibility, invitationCode: code });
      setInviteCode(code); startedAt.current = Date.now(); bindRoom(room);
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Unable to join matchmaking.');
    }
  };

  const reconnect = async () => {
    const token = sessionStorage.getItem('chessColyseusReconnectToken');
    if (!token) return;
    setStatus('reconnecting'); setMessage('Restoring your seat (30 second window)…');
    try { bindRoom(await client.reconnect(token)); } catch { sessionStorage.removeItem('chessColyseusReconnectToken'); setStatus('error'); setMessage('Your reconnect window expired. Join again.'); }
  };

  useEffect(() => { void reconnect(); }, []);

  const leave = async () => {
    await roomRef.current?.leave(true); roomRef.current = undefined; sessionStorage.removeItem('chessColyseusReconnectToken');
    startedAt.current = 0; setElapsed(0); setLobby(EMPTY); setStatus('idle'); setMessage('Matchmaking cancelled.');
  };

  const connectedPlayers = lobby.players.filter((player) => player.connected).length;
  const matchmakingStatus = connectedPlayers >= 2 ? '2/2 players' : 'Waiting for opponent';

  return (
    <section className="mx-auto w-full max-w-md space-y-4 rounded-[28px] border border-cyan-300/20 bg-[#07111f]/95 p-4 shadow-2xl" aria-label="Chess multiplayer lobby">
      <div className="flex items-center justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[.28em] text-cyan-300">Real-time arena</p><h2 className="text-xl font-black text-white">Multiplayer Lobby</h2></div>
        <span className={`h-3 w-3 rounded-full ${status === 'joined' ? 'bg-emerald-400' : status === 'error' ? 'bg-red-400' : 'bg-amber-300 animate-pulse'}`} />
      </div>

      {status === 'idle' || status === 'error' ? <>
        <div className="grid grid-cols-2 gap-2">
          {(['public', 'private'] as const).map((kind) => <button key={kind} onClick={() => setRoomType(kind)} className={`rounded-2xl border p-3 text-left ${roomType === kind ? 'border-cyan-300 bg-cyan-300/15 text-white' : 'border-white/10 bg-white/5 text-white/55'}`}><b className="block capitalize">{kind} room</b><span className="text-[11px]">{kind === 'public' ? 'Quick Match' : 'Invite friends'}</span></button>)}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">Match size <b className="float-right text-white">2 players</b></div>
        {roomType === 'private' && <label className="block text-xs text-white/60">Invitation code<input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase())} placeholder="ENTER CODE" className="mt-1 w-full rounded-xl border border-white/10 bg-[#050b14] p-3 text-center font-mono text-lg tracking-[.2em] text-white" /></label>}
        <div className="grid grid-cols-2 gap-2">
          {roomType === 'private' && <button onClick={() => void join(true)} className="rounded-xl border border-cyan-300/40 bg-cyan-300/10 p-3 font-bold text-cyan-200">Create private</button>}
          <button onClick={() => void join(false)} className={`${roomType === 'public' ? 'col-span-2' : ''} rounded-xl bg-cyan-300 p-3 font-black text-[#04101d]`}>{roomType === 'public' ? 'Quick Match' : 'Join code'}</button>
        </div>
      </> : <>
        <div className="rounded-xl bg-cyan-300/10 p-3 text-center"><b className="block text-sm text-cyan-200">{matchmakingStatus}</b><span className="text-xs text-white/60">{Math.min(connectedPlayers, 2)}/2 players</span></div>
        <div className="grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-white/5 p-2"><b className="block text-lg text-white">{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</b><span className="text-[10px] text-white/45">WAITING</span></div><div className="rounded-xl bg-white/5 p-2"><b className="block text-lg text-amber-300">{countdown || '—'}</b><span className="text-[10px] text-white/45">START</span></div></div>
        {lobby.invitationCode && <button onClick={() => navigator.clipboard?.writeText(lobby.invitationCode)} className="w-full rounded-xl border border-dashed border-cyan-300/40 p-2 font-mono tracking-[.25em] text-cyan-200">{lobby.invitationCode} · COPY</button>}
        <div className="space-y-2">{Array.from({length:lobby.maxPlayers}, (_, i) => lobby.players[i] || null).map((p, i) => <div key={p?.sessionId || i} className="flex min-h-12 items-center gap-3 rounded-xl border border-white/5 bg-white/[.04] px-3">{p ? <><div className="h-8 w-8 overflow-hidden rounded-full bg-cyan-900">{p.avatar && <img src={p.avatar} className="h-full w-full object-cover" alt="" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{p.name}{p.accountId === accountId ? ' (You)' : ''}</p><p className="text-[10px] text-white/40">{p.connected ? 'Connected' : 'Reconnecting…'}</p></div><b className={`text-xs ${p.ready ? 'text-emerald-400' : 'text-amber-200'}`}>{p.ready ? 'READY' : 'WAITING'}</b></> : <span className="text-xs text-white/25">Searching for player {i + 1}…</span>}</div>)}</div>
        <button disabled={!me || status !== 'joined'} onClick={() => roomRef.current?.send('ready', !me?.ready)} className={`w-full rounded-2xl p-4 text-lg font-black ${me?.ready ? 'bg-emerald-400 text-emerald-950' : 'bg-cyan-300 text-[#04101d]'} disabled:opacity-40`}>{me?.ready ? 'READY ✓' : 'READY'}</button>
        <button onClick={() => void leave()} className="w-full py-2 text-sm text-white/45">Cancel matchmaking</button>
      </>}
      <p role="status" className="text-center text-xs text-white/55">{message}</p>
    </section>
  );
}
