import React from 'react';
import PoolLiveAvatar from '../../components/PoolLiveAvatar.jsx';
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
  avatarLayout: React.CSSProperties;
};

/** Pool Royal's bottom avatar/points layout, with Snooker visit information above. */
export default function SnookerMatchHud({ player, opponent, playerTurn, shooting,
  finished, inHand, next, currentBreak, timer, mode, portrait = true, avatarLayout }: Props) {
  const visit = finished ? 'Frame complete' : shooting ? 'Balls in play'
    : inHand && playerTurn ? 'Place cue ball in the D'
      : playerTurn ? 'Your visit' : `${opponent.name}'s visit`;
  const ballOn = next === 'red' ? 'Red · 1' : next?.includes('/') ? 'Choose a colour' : next || 'Red';
  const renderPlayer = (person: Competitor, index: number, active: boolean) => (
    <div data-snooker-player={index} data-self-player={index === 0}
      className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-full ${active ? 'text-white' : 'text-white/80'}`}
      style={{ boxShadow: active ? '0 0 18px rgba(16,185,129,0.32)' : '0 6px 14px rgba(0,0,0,0.35)' }}>
      <div className="flex min-w-0 w-full flex-col">
        <div className="flex min-w-0 items-center gap-1.5">
          <PoolLiveAvatar seat={index === 0 ? 'self' : 'opponent'} src={person.avatar || '/assets/icons/profile.svg'} alt={`${person.name} avatar`}
            width={POOL_AVATAR_SIZE_PX} height={POOL_AVATAR_SIZE_PX}
            style={{ width: POOL_AVATAR_SIZE_PX, height: POOL_AVATAR_SIZE_PX }}
            className={`h-10 w-10 shrink-0 rounded-full object-cover transition-all duration-150 ${active ? 'ring-2 ring-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.55)]' : ''}`} />
          <span title={person.name} className={`min-w-0 truncate font-semibold tracking-wide ${portrait ? 'text-[11px]' : 'text-[0.95rem]'}`}>
            {person.name}
          </span>
        </div>
        <div className="mt-1 text-xs font-bold text-amber-100 tabular-nums" aria-live="polite" aria-atomic="true"
          aria-label={`${person.name}: ${person.score} points`}>
          {person.score} points
        </div>
      </div>
    </div>
  );
  return (
    <>
      <section aria-label="Snooker match status" className="pointer-events-none absolute inset-x-2 z-40 mx-auto max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-slate-950/90 text-white shadow-lg backdrop-blur-md"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
        <div className="flex min-h-7 items-center justify-between gap-2 px-3 py-1 text-[11px]">
          <span className="min-w-0 truncate font-semibold text-emerald-200" role="status">{visit}</span>
          {!finished && <span className="shrink-0 text-white/60">Break <strong className="text-white">{currentBreak || 0}</strong></span>}
          {!finished && playerTurn && !shooting && timer != null && timer > 0 && (
            <span className={`shrink-0 tabular-nums ${timer <= 10 ? 'font-bold text-amber-300' : 'text-white/65'}`} aria-label={`${timer} seconds remaining`}>{timer}s</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-1 text-[11px]">
          <span className="min-w-0 truncate text-white/60">{mode}</span>
          {!shooting && !finished && !inHand && <span className="min-w-0 truncate text-white/60">Ball on <strong className="capitalize text-white/90">{ballOn}</strong></span>}
        </div>
      </section>
      <section aria-label="Snooker match score" data-snooker-avatar-hud data-pool-avatar-hud
        className="absolute flex justify-center pointer-events-none z-50" style={avatarLayout}>
        <div className={`pointer-events-none flex min-w-0 max-w-full items-center justify-center rounded-full border border-emerald-400/40 bg-black/70 text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur ${portrait ? 'gap-2 px-2 py-1.5 w-full' : 'gap-7 px-4 py-1.5'}`}
          style={{ maxWidth: 'min(26rem, 100%)' }}>
          {renderPlayer(player, 0, playerTurn && !finished)}
          {renderPlayer(opponent, 1, !playerTurn && !finished)}
        </div>
      </section>
    </>
  );
}
