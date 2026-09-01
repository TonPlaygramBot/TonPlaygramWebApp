import { useEffect, useMemo, useRef, useState } from 'react';
import ArcadeMatchHeader from '../../components/ArcadeMatchHeader.jsx';
import useArcadeRace from '../../hooks/useArcadeRace.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

const COLORS = ['#22d3ee', '#f472b6', '#facc15', '#a78bfa', '#34d399', '#fb7185'];
const nextColor = () => Math.floor(Math.random() * COLORS.length);

export default function HextrisBattle() {
  useTelegramBackButton();
  const [ring, setRing] = useState(() => Array.from({ length: 6 }, nextColor));
  const [target, setTarget] = useState(nextColor);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [pulse, setPulse] = useState(0);
  const race = useArcadeRace('hextrisbattle', score);
  const finished = lives <= 0 || Boolean(race.endsAt && Date.now() >= race.endsAt);
  const finishSent = useRef(false);

  useEffect(() => {
    if (finished && !finishSent.current) { finishSent.current = true; race.finish(score); }
  }, [finished, race, score]);

  const choose = (index) => {
    if (finished || (race.startsAt && Date.now() < race.startsAt)) return;
    if (ring[index] === target) {
      const gained = 100 + combo * 25;
      setScore((value) => value + gained);
      setCombo((value) => value + 1);
      setRing((values) => values.map((value, position) => position === index ? nextColor() : value));
      setTarget(nextColor());
      setPulse((value) => value + 1);
    } else {
      setCombo(0);
      setLives((value) => Math.max(0, value - 1));
    }
  };

  const positions = useMemo(() => [
    ['left-1/2 top-[2%] -translate-x-1/2', 'visually higher'],
    ['right-[3%] top-[23%]', 'visually upper-right'],
    ['right-[3%] bottom-[23%]', 'visually lower-right'],
    ['bottom-[2%] left-1/2 -translate-x-1/2', 'visually lower'],
    ['left-[3%] bottom-[23%]', 'visually lower-left'],
    ['left-[3%] top-[23%]', 'visually upper-left']
  ], []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#070615] text-white">
      <ArcadeMatchHeader title="Hextris Battle" score={score} opponentScore={race.opponentScore} online={race.online} startsAt={race.startsAt} endsAt={race.endsAt} accent="text-fuchsia-300" />
      <section className="mx-auto max-w-md px-4">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"><span>Lives {'●'.repeat(lives)}<span className="text-white/15">{'●'.repeat(3 - lives)}</span></span><strong className="text-fuchsia-300">Combo ×{combo}</strong></div>
        <p className="mb-4 text-center text-xs text-white/55">Tap the outer hexagon that matches the glowing center color.</p>
        <div className="relative mx-auto aspect-[0.82] w-full max-w-[390px]">
          <div className="absolute inset-[12%] rounded-full border border-fuchsia-300/10 bg-[radial-gradient(circle,rgba(217,70,239,.13),transparent_67%)]" />
          {ring.map((color, index) => (
            <button key={`${index}-${pulse}`} type="button" onClick={() => choose(index)} aria-label={`${positions[index][1]} color`} className={`absolute ${positions[index][0]} grid h-[28%] w-[38%] place-items-center transition active:scale-90`}>
              <span className="block h-20 w-20 rotate-45 rounded-[22px] border-4 shadow-[0_0_28px_currentColor]" style={{ color, borderColor: color, background: `${color}33` }} />
            </button>
          ))}
          <div className="absolute left-1/2 top-1/2 grid h-32 w-32 -translate-x-1/2 -translate-y-1/2 place-items-center">
            <div className="h-24 w-24 rotate-45 rounded-[26px] border-4 bg-black/60 shadow-[0_0_45px_currentColor] transition" style={{ color: COLORS[target], borderColor: COLORS[target], background: `${COLORS[target]}22` }} />
            <span className="absolute text-xs font-black uppercase tracking-widest">Match</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center text-xs text-white/50">A correct match scores 100 points plus a growing combo bonus. A wrong tap removes one life.</div>
      </section>
      {(finished || race.winner) && <div className="fixed inset-x-4 top-1/2 z-30 mx-auto max-w-sm -translate-y-1/2 rounded-3xl border border-fuchsia-300/30 bg-[#130d22]/95 p-7 text-center shadow-2xl"><div className="text-4xl">⬢</div><strong className="mt-3 block text-2xl">{race.online ? String(race.winner) === String(race.accountId) ? 'You win!' : race.winner === 'draw' ? 'Draw!' : 'Opponent wins' : 'Practice complete'}</strong><p className="mt-2 text-white/55">Score {score.toLocaleString()}</p></div>}
    </main>
  );
}
