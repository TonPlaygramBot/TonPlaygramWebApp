import { Canvas } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Text } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { socket } from '../../utils/socket.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getVisualRoyalGame, type VisualRoyalGame } from './visualRoyalGames';

type MatchState = { scores: Record<string, number>; attempts: Record<string, number>; turn: string; revision: number; winner?: string; players: string[] };

function Ball({ position = [0, 0.5, 0], color = '#fff', scale = 1 }: { position?: [number, number, number]; color?: string; scale?: number }) {
  return <mesh position={position} scale={scale} castShadow><sphereGeometry args={[0.22, 24, 16]} /><meshStandardMaterial color={color} roughness={0.35} /></mesh>;
}

function Scene({ game, pulse }: { game: VisualRoyalGame; pulse: number }) {
  const moving = Math.sin(pulse * 1.7) * 0.45;
  if (game.scene === 'table-tennis') return <group><RoundedBox args={[5, .18, 3]} position={[0, 0, 0]}><meshStandardMaterial color="#075985" /></RoundedBox><mesh position={[0,.45,0]}><boxGeometry args={[5,.6,.05]} /><meshStandardMaterial color="#e2e8f0" wireframe /></mesh><Ball position={[moving, .55, moving * 1.8]} scale={.42} /></group>;
  if (game.scene === 'bowling') return <group><RoundedBox args={[3,.16,7]} position={[0,0,-.5]}><meshStandardMaterial color="#d6a35f" /></RoundedBox>{Array.from({length:10},(_,i)=><mesh key={i} position={[(i%4-1.5)*.45,.45,-2.5+Math.floor(i/4)*.5]}><cylinderGeometry args={[.12,.18,.8,16]} /><meshStandardMaterial color="white" /></mesh>)}<Ball position={[moving,.3,2]} color="#7c3aed" /></group>;
  if (game.scene === 'darts' || game.scene === 'archery') return <group position={[0,1,-1]}>{[2.1,1.6,1.05,.5].map((r,i)=><mesh key={r} position={[0,0,i*.02]}><circleGeometry args={[r,48]} /><meshStandardMaterial color={i%2 ? '#f8fafc' : game.accent} /></mesh>)}<mesh position={[moving,.2,1]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.03,.05,2,8]} /><meshStandardMaterial color="#d1d5db" /></mesh></group>;
  if (game.scene === 'carrom') return <group><RoundedBox args={[5,.25,5]}><meshStandardMaterial color="#d6a96d" /></RoundedBox>{Array.from({length:9},(_,i)=><Ball key={i} position={[(i%3-1)*.5,.25,(Math.floor(i/3)-1)*.5]} color={i%2?'#111827':'#f8fafc'} scale={.7} />)}<Ball position={[moving,.25,1.8]} color="#ef4444" scale={.85} /></group>;
  if (game.scene === 'penalty') return <group><mesh position={[0,1,-2]}><boxGeometry args={[5,2.5,.12]} /><meshStandardMaterial color="white" wireframe /></mesh><Ball position={[moving,.4,.8]} color="white" /><mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[8,9]} /><meshStandardMaterial color="#15803d" /></mesh></group>;
  if (game.scene === 'basketball') return <group><mesh position={[0,2,-2]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.65,.07,12,32]} /><meshStandardMaterial color="#f97316" /></mesh><mesh position={[0,2.6,-2.25]}><boxGeometry args={[2.4,1.5,.12]} /><meshStandardMaterial color="#e2e8f0" /></mesh><Ball position={[moving,.7,1]} color="#ea580c" /></group>;
  return <group>{Array.from({length:4},(_,i)=><group key={i} position={[i%2?1.5:-1.5,.3,i<2?-1.5:1.5]} rotation={[0,i<2?0:Math.PI,0]}><RoundedBox args={[1.2,.35,1.8]}><meshStandardMaterial color={[game.accent,'#22d3ee','#f97316','#84cc16'][i]} /></RoundedBox><Ball position={[-.5,-.05,.65]} color="#111" scale={.7}/><Ball position={[.5,-.05,.65]} color="#111" scale={.7}/></group>)}<mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[2.5,4.5,48]} /><meshStandardMaterial color="#334155" /></mesh></group>;
}

export default function VisualRoyalGamePage() {
  const { game = '' } = useParams(); const config = useMemo(() => getVisualRoyalGame(game), [game]);
  const [query] = useSearchParams(); const navigate = useNavigate();
  useTelegramBackButton(config ? `/games/${config.slug}/royal-lobby` : '/games');
  const mode = query.get('mode') || 'ai'; const tableId = query.get('tableId') || ''; const accountId = query.get('accountId') || 'you';
  const [state, setState] = useState<MatchState>({ scores: { you: 0, ai: 0 }, attempts: { you: 0, ai: 0 }, turn: 'you', revision: 0, players: ['you','ai'] });
  const [pulse, setPulse] = useState(0); const [message, setMessage] = useState('Aim, then use the large action button below.');
  useEffect(() => { const timer = window.setInterval(() => setPulse(performance.now()/1000), 50); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!config || mode !== 'online' || !tableId) return;
    const onState = (payload: { tableId: string; state: MatchState }) => { if (payload.tableId === tableId) setState(payload.state); };
    socket.on('visualRoyalState', onState); socket.emit('joinVisualRoyalTable', { tableId, accountId });
    return () => { socket.off('visualRoyalState', onState); };
  }, [accountId, config, mode, tableId]);
  const play = useCallback(() => { if (!config || state.winner) return; const accuracy = .35 + Math.random() * .65;
    if (mode === 'online') { socket.emit('visualRoyalAction', { tableId, accountId, action: { accuracy, power: .75 } }, (result: { success?: boolean; error?: string }) => !result?.success && setMessage(result?.error || 'Action rejected')); return; }
    const points = Math.max(1, Math.round(accuracy * (config.scene === 'basketball' ? 3 : 10)));
    setState((previous) => { const attempts = (previous.attempts.you || 0) + 1; const aiAttempts = attempts; const scores = { you: (previous.scores.you || 0) + points, ai: (previous.scores.ai || 0) + Math.ceil(Math.random()*8) }; const ended = attempts >= config.target; return { ...previous, scores, attempts: {you:attempts,ai:aiAttempts}, revision: previous.revision+1, winner: ended ? (scores.you >= scores.ai ? 'you':'ai') : undefined }; });
    setMessage(`${points} points!`);
  }, [accountId, config, mode, state.winner, tableId]);
  if (!config) return <div className="p-6">Game not found.</div>;
  return <main className="relative min-h-[100dvh] overflow-hidden bg-[#030712] text-white">
    <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 p-4"><button onClick={() => navigate(`/games/${config.slug}/royal-lobby`)} aria-label="Back" className="rounded-full bg-black/50 p-3">←</button><div className="text-center"><h1 className="font-black">{config.title}</h1><p className="text-xs text-white/60">{mode === 'online' ? 'Online match' : 'Practice vs AI'}</p></div><span className="text-2xl">{config.icon}</span></header>
    <div className="h-[68dvh]"><Canvas shadows camera={{ position: [0,5.8,8.4], fov: 45 }} dpr={[1,1.5]}><color attach="background" args={['#07111f']} /><fog attach="fog" args={['#07111f', 10, 22]} /><ambientLight intensity={1.4}/><directionalLight castShadow intensity={2} position={[4,8,5]}/><Scene game={config} pulse={pulse}/><Text position={[0,3,-2]} fontSize={.4} color={config.accent}>{config.objective}</Text><OrbitControls target={[0, 0, 0]} enablePan={false} minDistance={6} maxDistance={11} maxPolarAngle={1.55}/></Canvas></div>
    <section className="absolute inset-x-0 bottom-0 rounded-t-[2rem] border-t border-white/10 bg-slate-950/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between"><div><span className="text-xs text-white/50">YOU</span><strong className="block text-3xl" style={{color:config.accent}}>{state.scores[accountId] ?? state.scores.you ?? 0}</strong></div><p className="max-w-[48%] text-center text-xs text-white/70">{state.winner ? `${state.winner === accountId || state.winner === 'you' ? 'You win!' : 'Opponent wins'}` : message}</p><div className="text-right"><span className="text-xs text-white/50">RIVAL</span><strong className="block text-3xl">{Object.entries(state.scores).find(([id]) => id !== accountId && id !== 'you')?.[1] ?? state.scores.ai ?? 0}</strong></div></div>
      <button onClick={play} disabled={Boolean(state.winner) || (mode === 'online' && state.turn !== accountId)} style={{background:config.accent}} className="mx-auto mt-4 block w-full max-w-md rounded-2xl py-4 text-lg font-black text-slate-950 shadow-lg disabled:opacity-40">{state.winner ? 'Match complete' : config.action}</button>
    </section>
  </main>;
}
