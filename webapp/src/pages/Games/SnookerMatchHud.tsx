import React from 'react';

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
};

/** A persistent match view that fits a 320px portrait screen without hiding the table. */
export default function SnookerMatchHud({ player, opponent, playerTurn, shooting,
  finished, inHand, next, currentBreak, timer, mode }: Props) {
  const visit = finished ? 'Frame complete' : shooting ? 'Balls in play'
    : inHand && playerTurn ? 'Place cue ball in the D'
      : playerTurn ? 'Your visit' : `${opponent.name}'s visit`;
  const ballOn = next === 'red' ? 'Red · 1' : next?.includes('/') ? 'Choose a colour' : next || 'Red';
  const renderPlayer = (person: Competitor, index: number, active: boolean) => (
    <div data-snooker-player={index} className={`flex min-w-0 items-center gap-2 ${index ? 'flex-row-reverse text-right' : ''}`}>
      <img src={person.avatar || '/assets/icons/profile.svg'} alt="" width={32} height={32}
        className={`h-8 w-8 shrink-0 rounded-full border-2 object-cover ${active ? 'border-emerald-300' : 'border-white/20'}`} />
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold text-white/90">{person.name}</p>
        <p className={`text-[11px] uppercase tracking-wider ${active ? 'text-emerald-300' : 'text-white/40'}`}>
          {active ? 'At table' : 'Waiting'}
        </p>
      </div>
    </div>
  );
  return (
    <section aria-label="Snooker match score" className="pointer-events-none absolute inset-x-2 z-40 mx-auto max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-slate-950/90 text-white shadow-lg backdrop-blur-md"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2.5">
        {renderPlayer(player, 0, playerTurn && !finished)}
        <div className="min-w-[76px] text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/80">{mode}</p>
          <p className="whitespace-nowrap text-[23px] font-bold leading-tight tabular-nums" aria-label={`${player.name} ${player.score}, ${opponent.name} ${opponent.score}`}>
            {player.score}<span className="mx-1.5 text-sm font-normal text-white/30">:</span>{opponent.score}
          </p>
        </div>
        {renderPlayer(opponent, 1, !playerTurn && !finished)}
      </div>
      <div className="flex min-h-7 items-center justify-between gap-2 border-t border-white/10 bg-white/[0.03] px-3 py-1 text-[11px]">
        <span className="min-w-0 truncate font-medium text-emerald-200" role="status">{visit}</span>
        {!finished && <span className="shrink-0 text-white/60">Break <strong className="text-white">{currentBreak || 0}</strong></span>}
        {playerTurn && !shooting && timer != null && timer > 0 && (
          <span className={`shrink-0 tabular-nums ${timer <= 10 ? 'font-bold text-amber-300' : 'text-white/65'}`} aria-label={`${timer} seconds remaining`}>{timer}s</span>
        )}
      </div>
      {!shooting && !finished && !inHand && (
        <div className="flex items-center justify-between gap-2 border-t border-white/5 px-3 py-1 text-[11px]">
          <span className="min-w-0 truncate text-white/60">Ball on <strong className="capitalize text-white/90">{ballOn}</strong></span>
          <span className="shrink-0" aria-label="Guides: white aiming path, gold object ball, cyan cue ball">
            <span className="text-white/80">━ Aim</span><span className="ml-2 text-amber-300">━ Object</span><span className="ml-2 text-cyan-300">┄ Cue</span>
          </span>
        </div>
      )}
    </section>
  );
}
