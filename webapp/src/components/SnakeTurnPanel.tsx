import { Dice5, Flag, LoaderCircle } from 'lucide-react';
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
  const detail = offline ? 'Rejoining your match' : isFinished ? 'Watch the race to the finish'
    : waiting ? 'Get ready to play' : setup ? 'Rolling for turn order' : active
      ? `Tap to throw ${count > 1 ? 'your dice' : 'your die'}` : rolling ? 'Waiting for the die to land'
        : moving ? 'Follow your token' : 'Waiting for your turn';
  return (
    <section className="snake-turn-panel" aria-label="Turn controls">
      <div className="snake-turn-meta">
        <span><Flag size={14} aria-hidden="true" />{position === 0 ? 'At start' : `${position} / ${finalTile}`}
          {count > 1 && !isFinished && <span className="snake-bonus-dice">{count} dice</span>}
        </span>
        <span>{hint}</span>
      </div>
      <div className="snake-turn-main">
        <div className={`snake-roll-result ${rolling ? 'is-rolling' : ''}`} role="img" aria-label={rolling ? 'Die rolling' : shownResult ? `Rolled ${shownResult}${count > 1 || shownResult > 6 ? ' in total' : ''}` : 'Die ready'}>
          {rolling ? <LoaderCircle size={24} aria-hidden="true" /> : shownResult ? (
            shownResult <= 6 && count === 1 ? <DieFace value={shownResult} /> : <span className="snake-roll-total">{shownResult}<small>Total</small></span>
          ) : <Dice5 size={26} aria-hidden="true" />}
        </div>
        <div className="snake-turn-copy" role="status" aria-live="polite" aria-atomic="true">
          <strong>{status}</strong>
          <span className="snake-turn-detail">{detail}</span>
        </div>
        <button type="button" className="snake-roll-button" onClick={onRoll} disabled={!active}>
          <span>{offline ? 'Offline' : isFinished ? 'Finished' : rolling ? 'Rolling' : moving ? 'Moving' : count > 1 ? 'Roll dice' : 'Roll die'}</span>
          {active && <span className="snake-turn-seconds" aria-label={`${Math.ceil(clockSeconds)} seconds left`}>{Math.ceil(clockSeconds)}s</span>}
        </button>
      </div>
      <div className="snake-turn-clock" role={active ? 'progressbar' : undefined} aria-hidden={!active || undefined} aria-label={active ? 'Time remaining in your turn' : undefined} aria-valuemin={active ? 0 : undefined} aria-valuemax={active ? 15 : undefined} aria-valuenow={active ? Math.ceil(clockSeconds) : undefined}>
        <span style={{ width: `${active ? clockSeconds / 15 * 100 : 0}%` }} data-urgent={active && clockSeconds <= 5} />
      </div>
    </section>
  );
}
