import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { socket } from '../../utils/socket.js';
import { RESTORED_ARCADE_GAMES } from '../../config/restoredArcadeGames.js';

const COLORS = ['#22d3ee', '#f472b6', '#fbbf24', '#4ade80', '#a78bfa'];
const randomTargets = (slug, count = 14) => Array.from({ length: count }, (_, id) => ({
  id, x: 8 + Math.random() * 84, y: 12 + Math.random() * 72,
  color: COLORS[Math.floor(Math.random() * COLORS.length)], bomb: slug === 'fruitslice' && Math.random() < .16
}));

export default function RestoredArcadeGame() {
  const { game } = useParams();
  const config = RESTORED_ARCADE_GAMES[game];
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tableId = params.get('table') || '';
  const online = params.get('mode') === 'online' && tableId;
  const [score, setScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [seconds, setSeconds] = useState(60);
  const [targets, setTargets] = useState(() => randomTargets(game));
  const [finished, setFinished] = useState(false);
  const boardRef = useRef(null);

  useEffect(() => {
    if (finished) return undefined;
    const timer = setInterval(() => setSeconds((value) => {
      if (value <= 1) { setFinished(true); return 0; }
      return value - 1;
    }), 1000);
    return () => clearInterval(timer);
  }, [finished]);

  useEffect(() => {
    if (!online) return undefined;
    const onAction = (payload) => {
      if (payload.tableId === tableId && payload.gameType === game) setOpponentScore(payload.score);
    };
    socket.on('arcadeAction', onAction);
    return () => socket.off('arcadeAction', onAction);
  }, [game, online, tableId]);

  useEffect(() => {
    if (!online) return;
    socket.emit('arcadeAction', { tableId, gameType: game, score, status: finished ? 'finished' : 'playing' });
  }, [finished, game, online, score, tableId]);

  useEffect(() => {
    if (game !== 'bubblesmash' && game !== 'fallingball') return undefined;
    const motion = setInterval(() => setTargets((items) => items.map((item) => ({ ...item, y: item.y > 88 ? 8 : item.y + (game === 'fallingball' ? 3 : -1.8) }))), 180);
    return () => clearInterval(motion);
  }, [game]);

  const hit = useCallback((target) => {
    if (finished) return;
    setScore((value) => Math.max(0, value + (target.bomb ? -25 : 10)));
    setTargets((items) => items.map((item) => item.id === target.id ? { ...item, x: 8 + Math.random() * 84, y: 10 + Math.random() * 75, color: COLORS[Math.floor(Math.random() * COLORS.length)] } : item));
  }, [finished]);

  const result = useMemo(() => score === opponentScore ? 'Draw' : score > opponentScore ? 'You win!' : 'Rival wins', [opponentScore, score]);
  if (!config) return null;
  return (
    <main className="mx-auto flex min-h-[82vh] max-w-md flex-col px-2 py-3 text-white" style={{ '--arcade-accent': config.accent }}>
      <header className="mb-2 flex items-center justify-between rounded-2xl bg-slate-950/90 px-3 py-2">
        <button onClick={() => navigate(`/games/${game}/lobby`)} aria-label="Leave game">←</button>
        <div className="text-center"><h1 className="text-sm font-black">{config.name}</h1><p className="text-[10px] text-white/60">{online ? 'LIVE 1V1' : 'PRACTICE'}</p></div>
        <strong className="tabular-nums">{seconds}s</strong>
      </header>
      <div className="mb-2 grid grid-cols-2 gap-2 text-center text-xs font-bold">
        <div className="rounded-xl bg-cyan-500/20 p-2" data-self-player="true"><span aria-label="You" className="avatar mr-2">🙂</span>You {score}</div>
        <div className="rounded-xl bg-fuchsia-500/20 p-2"><span className="avatar mr-2">🎮</span>Rival {opponentScore}</div>
      </div>
      <section ref={boardRef} className="relative flex-1 touch-none overflow-hidden rounded-[2rem] border-2 bg-slate-950 shadow-2xl" style={{ borderColor: config.accent, minHeight: '60vh' }} aria-label={`${config.name} play field`}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '10% 8%' }} />
        {targets.map((target) => <button key={target.id} onPointerDown={() => hit(target)} aria-label={target.bomb ? 'Bomb' : 'Game target'} className="absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-lg active:scale-75" style={{ left: `${target.x}%`, top: `${target.y}%`, background: target.bomb ? '#111827' : target.color, boxShadow: `0 0 20px ${target.color}` }}>{target.bomb ? '💣' : game === 'fruitslice' ? '🍊' : game === 'tetrisroyale' ? '▦' : '●'}</button>)}
        {finished ? <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/90 p-6 text-center"><div><p className="text-4xl font-black">{online ? result : 'Time!'}</p><p className="mt-2 text-xl">Score {score}</p><button className="mt-5 rounded-full bg-primary px-6 py-3 font-bold text-black" onClick={() => window.location.reload()}>Play again</button></div></div> : null}
      </section>
      <p className="mt-2 text-center text-xs text-white/60">{config.instruction}</p>
    </main>
  );
}
