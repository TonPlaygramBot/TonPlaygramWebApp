import React from 'react';
import { POOL_AVATAR_SIZE_PX } from './poolRoyalHudLayout.js';

type Competitor = { name: string; avatar?: string; score: number };
type Props = {
  player: Competitor;
  opponent: Competitor;
  playerTurn: boolean;
  shooting: boolean;
  finished: boolean;
  inHand: boolean;
  next: string;
  currentBreak: number;
  timer: number | null;
  mode: string;
  portrait?: boolean;
  style?: React.CSSProperties;
  hidden?: boolean;
};

/** Pool Royal's bottom avatar layout, with snooker points under each player. */
export default function SnookerMatchHud({ player, opponent, playerTurn, shooting,
  finished, inHand, next, currentBreak, timer, mode, portrait = true, style, hidden = false }: Props) {
  const visit = finished ? 'Frame complete' : shooting ? 'Balls in play'
    : inHand && playerTurn ? 'Place cue ball in the D'
      : playerTurn ? 'Your visit' : `${opponent.name}'s visit`;
  const ballOn = next === 'red' ? 'Red · 1' : next?.includes('/') ? 'Choose a colour' : next || 'Red';
  const renderPlayer = (person: Competitor, index: number, active: boolean) => (
    <div data-snooker-player={index} data-player-index={index} data-self-player={index === 0 ? 'true' : 'false'}
      className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-full ${active ? 'text-white' : 'text-white/80'}`}
      style={{ boxShadow: active
        ? `0 0 18px rgba(16,185,129,0.32), ${index ? '10' : '-10'}px 0 18px rgba(16,185,129,0.18)`
        : '0 6px 14px rgba(0,0,0,0.35)' }}>
      <div className="flex min-w-0 w-full flex-col">
        <div className="flex min-w-0 items-center gap-1.5">
          <img src={person.avatar || '/assets/icons/profile.svg'} alt={`${person.name} avatar`}
            width={POOL_AVATAR_SIZE_PX} height={POOL_AVATAR_SIZE_PX}
            style={{ width: POOL_AVATAR_SIZE_PX, height: POOL_AVATAR_SIZE_PX }}
            className={`h-10 w-10 shrink-0 rounded-full object-cover transition-all duration-150 ${active ? 'ring-2 ring-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.55)]' : ''}`} />
          <span title={person.name} className={`max-w-[10.5rem] truncate ${portrait ? 'text-[11px]' : 'text-[0.95rem]'} font-semibold tracking-wide`}>
            {person.name}
          </span>
        </div>
        <div className="mt-1 text-xs font-bold text-amber-100 tabular-nums" aria-live="polite" aria-atomic="true"
          aria-label={`${index ? 'Opponent' : 'Your'} points: ${person.score}`}>
          {person.score} <span className="text-[10px] font-medium">pts</span>
        </div>
      </div>
    </div>
  );
  return (
    <section data-snooker-avatar-hud aria-label={`${mode} match score`} aria-hidden={hidden}
      className={`pointer-events-none absolute z-50 flex flex-col items-center transition-opacity duration-200 ${hidden ? 'opacity-0' : 'opacity-100'}`}
      style={style}>
      <div className="mb-1 w-full max-w-[26rem] rounded-xl border border-emerald-400/20 bg-black/70 px-2 py-1 text-[10px] text-white backdrop-blur">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate text-emerald-200" role="status" title={visit}>{visit}</span>
          {playerTurn && !shooting && !finished && timer != null && timer > 0 && (
            <span className={`shrink-0 tabular-nums ${timer <= 10 ? 'font-bold text-amber-300' : 'text-white/65'}`} aria-label={`${timer} seconds remaining`}>{timer}s</span>
          )}
        </div>
        {!finished && <div className="flex min-w-0 items-center justify-between gap-2 text-white/60">
          <span className="min-w-0 truncate" title={`Ball on: ${ballOn}`}>Ball on <strong className="capitalize text-white/90">{ballOn}</strong></span>
          <span className="shrink-0">Break <strong className="text-white">{currentBreak || 0}</strong></span>
        </div>}
      </div>
      <div className={`flex min-w-0 max-w-full items-center justify-center ${portrait ? 'gap-2 px-2 py-1.5 w-full' : 'gap-5 px-4 py-1.5 w-full'} rounded-full border border-emerald-400/40 bg-black/70 text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur`}
        style={{ maxWidth: 'min(26rem, 100%)' }}>
        {renderPlayer(player, 0, playerTurn && !finished)}
        {renderPlayer(opponent, 1, !playerTurn && !finished)}
      </div>
    </section>
  );
}
