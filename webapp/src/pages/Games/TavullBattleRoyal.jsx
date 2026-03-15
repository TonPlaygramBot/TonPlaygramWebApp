import { useMemo, useState } from 'react';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

const TOTAL_POINTS = 24;
const HOME_WHITE = [18, 19, 20, 21, 22, 23];
const HOME_BLACK = [0, 1, 2, 3, 4, 5];

const initialBoard = () => {
  const points = Array.from({ length: TOTAL_POINTS }, () => ({ side: null, count: 0 }));
  const place = (index, side, count) => {
    points[index] = { side, count };
  };
  place(0, 'black', 2);
  place(11, 'black', 5);
  place(16, 'black', 3);
  place(18, 'black', 5);
  place(23, 'white', 2);
  place(12, 'white', 5);
  place(7, 'white', 3);
  place(5, 'white', 5);
  return points;
};

const rollDie = () => Math.floor(Math.random() * 6) + 1;

const opponent = (side) => (side === 'white' ? 'black' : 'white');

const cloneState = (state) => ({
  points: state.points.map((p) => ({ ...p })),
  bar: { ...state.bar },
  borneOff: { ...state.borneOff }
});

const hasAllInHome = (state, side) => {
  const home = side === 'white' ? HOME_WHITE : HOME_BLACK;
  if (state.bar[side] > 0) return false;
  return state.points.every((point, index) => {
    if (point.side !== side) return true;
    return home.includes(index);
  });
};

const moveDistance = (side, from, to) => (side === 'white' ? to - from : from - to);

const entryFromBar = (side, die) => (side === 'white' ? die - 1 : TOTAL_POINTS - die);

const canBearOff = (state, side, from, die) => {
  if (!hasAllInHome(state, side)) return false;
  if (side === 'white') {
    const target = from + die;
    if (target === TOTAL_POINTS) return true;
    if (target < TOTAL_POINTS) return false;
    for (let idx = 18; idx < from; idx += 1) {
      if (state.points[idx].side === side && state.points[idx].count > 0) return false;
    }
    return true;
  }
  const target = from - die;
  if (target === -1) return true;
  if (target > -1) return false;
  for (let idx = 5; idx > from; idx -= 1) {
    if (state.points[idx].side === side && state.points[idx].count > 0) return false;
  }
  return true;
};

const isLegalMove = (state, side, from, die) => {
  if (state.bar[side] > 0 && from !== 'bar') return null;
  if (from === 'bar') {
    if (state.bar[side] <= 0) return null;
    const to = entryFromBar(side, die);
    const target = state.points[to];
    if (target.side === opponent(side) && target.count > 1) return null;
    return { from: 'bar', to, die, bearOff: false };
  }

  const point = state.points[from];
  if (point.side !== side || point.count <= 0) return null;
  const to = side === 'white' ? from + die : from - die;

  if (to < 0 || to >= TOTAL_POINTS) {
    if (!canBearOff(state, side, from, die)) return null;
    return { from, to: 'off', die, bearOff: true };
  }

  const target = state.points[to];
  if (target.side === opponent(side) && target.count > 1) return null;
  return { from, to, die, bearOff: false };
};

const legalMovesForDie = (state, side, die) => {
  const result = [];
  if (state.bar[side] > 0) {
    const move = isLegalMove(state, side, 'bar', die);
    if (move) result.push(move);
    return result;
  }

  for (let i = 0; i < TOTAL_POINTS; i += 1) {
    const move = isLegalMove(state, side, i, die);
    if (move) result.push(move);
  }
  return result;
};

const applyMove = (state, side, move) => {
  const next = cloneState(state);
  if (move.from === 'bar') {
    next.bar[side] -= 1;
  } else {
    next.points[move.from].count -= 1;
    if (next.points[move.from].count === 0) next.points[move.from].side = null;
  }

  if (move.bearOff) {
    next.borneOff[side] += 1;
    return next;
  }

  const target = next.points[move.to];
  const foe = opponent(side);
  if (target.side === foe && target.count === 1) {
    next.bar[foe] += 1;
    target.side = side;
    target.count = 1;
    return next;
  }

  if (!target.side) {
    target.side = side;
    target.count = 1;
  } else {
    target.count += 1;
  }
  return next;
};

const consumeDie = (dice, used) => {
  const index = dice.indexOf(used);
  if (index === -1) return dice;
  return [...dice.slice(0, index), ...dice.slice(index + 1)];
};

const pointLabel = (index) => index + 1;

export default function TavullBattleRoyal() {
  useTelegramBackButton();

  const [state, setState] = useState(() => ({
    points: initialBoard(),
    bar: { white: 0, black: 0 },
    borneOff: { white: 0, black: 0 }
  }));
  const [turn, setTurn] = useState('white');
  const [dice, setDice] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [status, setStatus] = useState('Roll dice to start Backgammon Royal.');

  const winner = useMemo(() => {
    if (state.borneOff.white >= 15) return 'white';
    if (state.borneOff.black >= 15) return 'black';
    return null;
  }, [state.borneOff.black, state.borneOff.white]);

  const availableMoves = useMemo(() => {
    if (!dice.length || turn !== 'white' || winner) return [];
    const all = [];
    dice.forEach((die) => {
      legalMovesForDie(state, 'white', die).forEach((move) => {
        all.push({ ...move, key: `${move.from}-${move.to}-${die}` });
      });
    });
    return all;
  }, [dice, state, turn, winner]);

  const doAIMoves = (startState, startDice) => {
    let aiState = startState;
    let aiDice = [...startDice];

    while (aiDice.length) {
      const options = aiDice.flatMap((die) => legalMovesForDie(aiState, 'black', die).map((move) => ({ move, die })));
      if (!options.length) break;
      const choice = options[Math.floor(Math.random() * options.length)];
      aiState = applyMove(aiState, 'black', choice.move);
      aiDice = consumeDie(aiDice, choice.die);
    }

    setState(aiState);
    setDice([]);
    setTurn('white');
    setSelectedPoint(null);
    setStatus('AI turn finished. Roll dice.');
  };

  const rollDice = () => {
    if (winner) return;
    if (dice.length) return;
    const d1 = rollDie();
    const d2 = rollDie();
    const rolled = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
    setDice(rolled);

    if (turn === 'white') {
      setStatus(`You rolled ${rolled.join(', ')}.`);
      return;
    }
    doAIMoves(state, rolled);
  };

  const playMove = (move) => {
    if (turn !== 'white' || winner) return;
    const nextState = applyMove(state, 'white', move);
    const nextDice = consumeDie(dice, move.die);
    setState(nextState);
    setDice(nextDice);
    setSelectedPoint(null);

    if (nextState.borneOff.white >= 15) {
      setStatus('You win Backgammon Royal!');
      return;
    }

    if (!nextDice.length) {
      setTurn('black');
      setStatus('AI rolling...');
      const d1 = rollDie();
      const d2 = rollDie();
      const aiDice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
      doAIMoves(nextState, aiDice);
    } else {
      setStatus(`Move played. Remaining dice: ${nextDice.join(', ')}.`);
    }
  };

  const handlePointClick = (index) => {
    if (turn !== 'white' || !dice.length || winner) return;
    setSelectedPoint((prev) => (prev === index ? null : index));
  };

  const filteredMoves = selectedPoint == null ? [] : availableMoves.filter((move) => move.from === selectedPoint || (selectedPoint === 'bar' && move.from === 'bar'));

  const topRow = state.points.slice(12, 24);
  const bottomRow = state.points.slice(0, 12);

  return (
    <div className="min-h-screen bg-[#0b1020] px-4 py-5 text-white">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-2xl font-bold">Backgammon Royal</h1>
        <p className="text-sm text-white/70">Refactored from Tavull Battle Royal into a Backgammon board/rules flow inspired by the Unity backgammon project.</p>

        <div className="grid gap-2 rounded-2xl border border-white/15 bg-white/5 p-3 text-sm sm:grid-cols-4">
          <div>Turn: <strong>{turn === 'white' ? 'You' : 'AI'}</strong></div>
          <div>Dice: <strong>{dice.length ? dice.join(', ') : '-'}</strong></div>
          <div>Bar (You/AI): <strong>{state.bar.white}/{state.bar.black}</strong></div>
          <div>Borne off (You/AI): <strong>{state.borneOff.white}/{state.borneOff.black}</strong></div>
        </div>

        <div className="space-y-2 rounded-2xl border border-amber-200/30 bg-gradient-to-br from-[#3a1f07] to-[#1b1109] p-3">
          <div className="grid grid-cols-12 gap-1">
            {topRow.map((point, idx) => {
              const boardIndex = idx + 12;
              const isSelected = selectedPoint === boardIndex;
              return (
                <button
                  key={boardIndex}
                  type="button"
                  onClick={() => handlePointClick(boardIndex)}
                  className={`h-20 rounded-md border text-xs ${isSelected ? 'border-cyan-300 bg-cyan-600/30' : 'border-white/10 bg-black/20'}`}
                >
                  <div>{pointLabel(boardIndex)}</div>
                  <div>{point.count > 0 ? `${point.side === 'white' ? '⚪' : '⚫'} x${point.count}` : '-'}</div>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-12 gap-1">
            {bottomRow.map((point, idx) => {
              const boardIndex = idx;
              const isSelected = selectedPoint === boardIndex;
              return (
                <button
                  key={boardIndex}
                  type="button"
                  onClick={() => handlePointClick(boardIndex)}
                  className={`h-20 rounded-md border text-xs ${isSelected ? 'border-cyan-300 bg-cyan-600/30' : 'border-white/10 bg-black/20'}`}
                >
                  <div>{pointLabel(boardIndex)}</div>
                  <div>{point.count > 0 ? `${point.side === 'white' ? '⚪' : '⚫'} x${point.count}` : '-'}</div>
                </button>
              );
            })}
          </div>
        </div>

        {filteredMoves.length > 0 && (
          <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
            <p className="mb-2 text-sm text-white/75">Available moves from point {selectedPoint + 1}:</p>
            <div className="flex flex-wrap gap-2">
              {filteredMoves.map((move) => (
                <button
                  key={move.key}
                  type="button"
                  onClick={() => playMove(move)}
                  className="rounded-lg border border-emerald-300/40 bg-emerald-600/20 px-3 py-2 text-sm"
                >
                  Die {move.die}: {move.to === 'off' ? 'Bear off' : `to ${move.to + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={rollDice}
            disabled={Boolean(dice.length) || Boolean(winner)}
            className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-900 disabled:opacity-40"
          >
            Roll Dice
          </button>
          <p className="text-sm text-white/70">{winner ? `${winner === 'white' ? 'You' : 'AI'} won.` : status}</p>
        </div>
      </div>
    </div>
  );
}
