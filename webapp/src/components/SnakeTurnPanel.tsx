import { Dice5, Flag, LoaderCircle, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  canRoll: boolean; rolling: boolean; moving: boolean; waiting: boolean;
  message: ReactNode; result: number | null; position: number; finalTile: number;
  seconds: number; playerName: string; onRoll: () => void;
};

export default function SnakeTurnPanel({ canRoll, rolling, moving, waiting, message, result,
  position, finalTile, seconds, playerName, onRoll }: Props) {
  const hint = position === 0 ? 'Roll a 6 to enter' : finalTile - position <= 6
    ? `Roll ${finalTile - position} to finish` : 'A 6 gives you another roll';
  const status = waiting ? 'Waiting for players' : rolling ? 'Rolling…'
    : moving ? message || 'Moving…' : canRoll ? message || 'Your turn' : `${playerName}’s turn`;
  return (
    <section className="snake-turn-panel" aria-label="Turn controls">
      <div className="snake-turn-meta">
        <span><Flag size={14} aria-hidden="true" />{position === 0 ? 'At start' : `${position} / ${finalTile}`}</span>
        <span>{hint}</span>
      </div>
      <div className="snake-turn-main">
        <div className={`snake-roll-result ${rolling ? 'is-rolling' : ''}`} aria-label={rolling ? 'Die rolling' : result ? `Rolled ${result}` : 'Die ready'}>
          {rolling ? <LoaderCircle size={24} aria-hidden="true" /> : result ?? <Dice5 size={26} aria-hidden="true" />}
        </div>
        <div className="snake-turn-copy" role="status" aria-live="polite" aria-atomic="true">
          <strong>{status}</strong>
          <span>{canRoll ? 'Tap to throw your die' : moving ? 'Follow your token' : 'Race to the top'}</span>
        </div>
        <button type="button" className="snake-roll-button" onClick={onRoll} disabled={!canRoll}>
          <span>{rolling ? 'Rolling' : moving ? 'Moving' : 'Roll die'}</span>
          {!rolling && !moving && <ArrowUpRight size={18} aria-hidden="true" />}
        </button>
      </div>
      <div className="snake-turn-clock" role="progressbar" aria-label="Time remaining in turn" aria-valuemin={0} aria-valuemax={15} aria-valuenow={Math.ceil(seconds)}>
        <span style={{ width: `${canRoll ? Math.max(0, Math.min(100, seconds / 15 * 100)) : 0}%` }} data-urgent={seconds <= 5} />
      </div>
    </section>
  );
}
