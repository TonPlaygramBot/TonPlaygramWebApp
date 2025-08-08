'use client';

import type { TableState, StakeTier, PlayerAction } from '../../shared/pokerTypes';
import { BRAND } from '../../lib/config';

const STAKES: StakeTier[] = [100, 500, 1000, 5000, 10000];

interface Props {
  table: TableState;
  onAction: (a: PlayerAction) => void;
  onStart: () => void;
  onStakeChange: (s: StakeTier) => void;
}

export default function HUD({ table, onAction, onStart, onStakeChange }: Props) {
  const you = table.players[0];
  const bot = table.players[1];
  const isYourTurn = table.activePlayerId === you.id;
  const stakeButtons = STAKES.map(s => (
    <button
      key={s}
      onClick={() => onStakeChange(s)}
      className={`px-2 py-1 rounded text-xs border ${
        table.stake === s ? 'bg-[--gold] text-black' : 'bg-transparent text-[--gold]'
      }`}
    >
      {s}
    </button>
  ));

  return (
    <div className="pointer-events-none text-white" style={{ '--gold': BRAND.gold } as any}>
      <div className="absolute top-0 w-full flex flex-col items-center gap-2 p-2 pointer-events-auto">
        <div className="flex gap-2">{stakeButtons}</div>
        <button
          onClick={onStart}
          className="px-4 py-1 bg-[--gold] text-black rounded"
        >
          START
        </button>
        <div className="text-xs opacity-70">Pot: {table.pot} | Room: {table.roomId}</div>
      </div>
      <div className="absolute bottom-0 w-full p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pointer-events-auto">
        <div className="flex justify-between text-sm mb-3">
          <div>Ti: {you.stack}</div>
          <div>Bot: {bot.stack}</div>
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => onAction({ type: 'FOLD' })}
            disabled={!isYourTurn}
            className="flex-1 py-2 rounded bg-[--gold] text-black disabled:opacity-30"
          >
            Fold
          </button>
          <button
            onClick={() => onAction({ type: 'CHECK_CALL' })}
            disabled={!isYourTurn}
            className="flex-1 py-2 rounded bg-[--gold] text-black disabled:opacity-30"
          >
            Check/Call
          </button>
          <button
            onClick={() => onAction({ type: 'RAISE', amount: table.minRaise })}
            disabled={!isYourTurn}
            className="flex-1 py-2 rounded bg-[--gold] text-black disabled:opacity-30"
          >
            Raise
          </button>
        </div>
      </div>
    </div>
  );
}
