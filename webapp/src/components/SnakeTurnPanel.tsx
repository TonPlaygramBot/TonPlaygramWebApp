import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  canRoll: boolean; rolling: boolean; moving: boolean; waiting: boolean;
  message: ReactNode; result: number | null; position: number; finalTile: number;
  seconds: number; playerName: string; onRoll: () => void;
  diceCount?: number; finished?: boolean; offline?: boolean; setup?: boolean;
};

const PIP_POSITIONS: Record<number, number[][]> = {
  1: [[12, 12]],
  2: [[6, 6], [18, 18]],
  3: [[6, 6], [12, 12], [18, 18]],
  4: [[6, 6], [18, 6], [6, 18], [18, 18]],
  5: [[6, 6], [18, 6], [12, 12], [6, 18], [18, 18]],
  6: [[6, 6], [18, 6], [6, 12], [18, 12], [6, 18], [18, 18]]
};

function DieFace({ value }: { value: number }) {
  return <svg className="snake-die-pips" width={28} height={28} viewBox="0 0 24 24" aria-hidden="true">
    {PIP_POSITIONS[value].map(([cx, cy], index) => <circle key={index} cx={cx} cy={cy} r={2.1} fill="currentColor" />)}
  </svg>;
}

export default function SnakeTurnPanel({ canRoll, rolling, moving, waiting, message, result,
  position, finalTile, seconds, playerName, onRoll, diceCount = 1, finished = false,
  offline = false, setup = false }: Props) {
  const isFinished = finished || position >= finalTile;
  const active = canRoll && !rolling && !moving && !waiting && !setup && !offline && !isFinished;
  const remaining = Math.max(0, finalTile - position);
  const count = Number.isFinite(diceCount) ? Math.max(1, Math.floor(diceCount)) : 1;
  const clockSeconds = Number.isFinite(seconds) ? Math.max(0, Math.min(15, seconds)) : 0;
  const shownResult = Number.isInteger(result) && Number(result) > 0 ? Number(result) : null;
  const hint = isFinished ? 'Finish reached' : offline ? 'Waiting for a connection'
    : waiting ? 'Waiting for the table to fill' : setup ? 'Highest opening roll starts'
      : position === 0 ? 'Roll a 6 to enter' : remaining <= count * 6
        ? `Exact ${count > 1 ? 'total' : 'roll'}: ${remaining} to finish` : 'A 6 gives you another roll';
  const status = offline ? 'Reconnecting…' : isFinished ? 'You finished!' : waiting ? 'Waiting for players'
    : setup ? 'Choosing the first player' : rolling ? 'Rolling…'
      : moving ? message || 'Moving…' : active ? message || 'Your turn' : `${playerName}’s turn`;
  return (
    <section className="flex items-center justify-center gap-2" aria-label="Turn controls">
      {shownResult || rolling ? (
        <div className="shrink-0 text-white" role="img" aria-label={rolling ? 'Die rolling' : shownResult ? `Rolled ${shownResult}${count > 1 || shownResult > 6 ? ' in total' : ''}` : 'Die ready'}>
          {rolling ? <LoaderCircle size={24} aria-hidden="true" /> : shownResult ? (
            shownResult <= 6 && count === 1 ? <DieFace value={shownResult} /> : <span className="snake-roll-total">{shownResult}<small>Total</small></span>
          ) : null}
        </div>
      ) : null}
      <div className="min-w-0" role="status" aria-live="polite" aria-atomic="true">
        <div className="break-words">{status}</div>
        {(active || isFinished) && <div className="text-[11px] text-white/75">{hint}</div>}
      </div>
      <button type="button" className={`snake-roll-button pointer-events-auto min-h-[44px] shrink-0 rounded-lg border border-white/20 bg-white/10 px-2 text-xs font-semibold text-white hover:bg-white/20 focus-visible:outline focus-visible:outline-white ${active ? '' : 'sr-only'}`}
        onClick={onRoll} disabled={!active}>
        {count > 1 ? 'Roll dice' : 'Roll die'}
        {active && <span className="snake-turn-seconds ml-1 tabular-nums text-white/75" aria-label={`${Math.ceil(clockSeconds)} seconds left`}>{Math.ceil(clockSeconds)}s</span>}
      </button>
      {active && <div className="sr-only" role="progressbar" aria-label="Time remaining in your turn"
        aria-valuemin={0} aria-valuemax={15} aria-valuenow={Math.ceil(clockSeconds)} />}
    </section>
  );
}
