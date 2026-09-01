import { useCallback, useEffect, useRef, useState } from 'react';
import ArcadeMatchHeader from '../../components/ArcadeMatchHeader.jsx';
import useArcadeRace from '../../hooks/useArcadeRace.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

const SIZE = 4;
const emptyBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
const colors = { 0: 'bg-white/[0.07]', 2: 'bg-[#eee4da] text-[#776e65]', 4: 'bg-[#ede0c8] text-[#776e65]', 8: 'bg-[#f2b179]', 16: 'bg-[#f59563]', 32: 'bg-[#f67c5f]', 64: 'bg-[#f65e3b]', 128: 'bg-[#edcf72]', 256: 'bg-[#edcc61]', 512: 'bg-[#edc850]', 1024: 'bg-[#edc53f]', 2048: 'bg-[#edc22e]' };

function addTile(board) {
  const open = [];
  board.forEach((row, y) => row.forEach((value, x) => { if (!value) open.push([y, x]); }));
  if (!open.length) return board;
  const [y, x] = open[Math.floor(Math.random() * open.length)];
  const next = board.map((row) => [...row]);
  next[y][x] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function compress(line) {
  const values = line.filter(Boolean);
  const result = [];
  let gained = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === values[index + 1]) {
      const merged = values[index] * 2;
      result.push(merged); gained += merged; index += 1;
    } else result.push(values[index]);
  }
  while (result.length < SIZE) result.push(0);
  return { line: result, gained };
}

function move(board, direction) {
  let gained = 0;
  let next = emptyBoard();
  for (let axis = 0; axis < SIZE; axis += 1) {
    let line = Array.from({ length: SIZE }, (_, index) => direction === 'left' || direction === 'right' ? board[axis][index] : board[index][axis]);
    if (direction === 'right' || direction === 'down') line.reverse();
    const merged = compress(line); gained += merged.gained;
    if (direction === 'right' || direction === 'down') merged.line.reverse();
    merged.line.forEach((value, index) => {
      if (direction === 'left' || direction === 'right') next[axis][index] = value;
      else next[index][axis] = value;
    });
  }
  const changed = JSON.stringify(next) !== JSON.stringify(board);
  return { board: changed ? addTile(next) : board, gained, changed };
}

export default function Game2048Royale() {
  useTelegramBackButton();
  const [board, setBoard] = useState(() => addTile(addTile(emptyBoard())));
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const touch = useRef(null);
  const race = useArcadeRace('2048royale', score);

  const play = useCallback((direction) => {
    if (over || (race.startsAt && Date.now() < race.startsAt) || (race.endsAt && Date.now() >= race.endsAt)) return;
    setBoard((current) => {
      const result = move(current, direction);
      if (result.changed) setScore((value) => value + result.gained);
      return result.board;
    });
  }, [over, race.endsAt, race.startsAt]);

  useEffect(() => {
    const onKey = (event) => {
      const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
      if (direction) { event.preventDefault(); play(direction); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [play]);

  useEffect(() => {
    if (race.endsAt && Date.now() >= race.endsAt && !over) { setOver(true); race.finish(score); }
  });

  const restart = () => { setBoard(addTile(addTile(emptyBoard()))); setScore(0); setOver(false); };
  return (
    <main className="min-h-screen select-none overflow-hidden bg-[#17130f] text-white touch-none">
      <ArcadeMatchHeader title="2048 Royale" score={score} opponentScore={race.opponentScore} online={race.online} startsAt={race.startsAt} endsAt={race.endsAt} accent="text-amber-300" />
      <section className="mx-auto flex max-w-md flex-col px-4">
        <div className="mb-4 rounded-2xl border border-amber-200/10 bg-amber-100/5 p-3 text-center text-xs text-amber-100/65">Swipe in the visible direction. Merge matching numbers and finish with the highest score.</div>
        <div className="grid aspect-square grid-cols-4 gap-2 rounded-3xl bg-[#6f5d4d] p-2.5 shadow-2xl" onPointerDown={(event) => { touch.current = [event.clientX, event.clientY]; }} onPointerUp={(event) => { if (!touch.current) return; const dx = event.clientX - touch.current[0]; const dy = event.clientY - touch.current[1]; touch.current = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return; play(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up'); }}>
          {board.flat().map((value, index) => <div key={index} className={`grid aspect-square place-items-center rounded-xl text-[clamp(1rem,7vw,2rem)] font-black shadow-inner ${colors[value] || 'bg-[#3c332c] text-amber-200'}`}>{value || ''}</div>)}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <span />
          <button onClick={() => play('up')} className="rounded-2xl bg-white/10 py-3 text-xl" aria-label="Move up">↑</button><span />
          <button onClick={() => play('left')} className="rounded-2xl bg-white/10 py-3 text-xl" aria-label="Move left">←</button>
          <button onClick={() => play('down')} className="rounded-2xl bg-white/10 py-3 text-xl" aria-label="Move down">↓</button>
          <button onClick={() => play('right')} className="rounded-2xl bg-white/10 py-3 text-xl" aria-label="Move right">→</button>
        </div>
        {!race.online && <button onClick={restart} className="mt-4 rounded-xl border border-amber-300/25 py-3 text-sm font-bold text-amber-200">New practice board</button>}
        {(over || race.winner) && <div className="fixed inset-x-4 top-1/2 z-30 mx-auto max-w-sm -translate-y-1/2 rounded-3xl border border-amber-300/30 bg-[#211a13]/95 p-6 text-center shadow-2xl"><strong className="text-2xl">{race.online ? String(race.winner) === String(race.accountId) ? 'You win!' : race.winner === 'draw' ? 'Draw!' : 'Opponent wins' : 'Round complete'}</strong><p className="mt-2 text-amber-100/65">Final score: {score.toLocaleString()}</p></div>}
      </section>
    </main>
  );
}
