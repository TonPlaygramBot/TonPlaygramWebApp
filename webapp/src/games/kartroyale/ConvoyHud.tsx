import { Crosshair, Rocket, TriangleAlert } from 'lucide-react';
import { formatTime } from './career';
import type { ConvoySummary } from './ConvoyRun';
import './convoy.css';

export function ConvoyHud({ convoy }: { convoy?: ConvoySummary }) {
  return (
    <div className="rr-convoy-hud">
      <div>
        <strong>CONVOY RUN</strong>
        <small>WAVE {convoy?.wave || 1}/{convoy?.totalWaves ?? 3} · {convoy?.destroyed ?? 0} TAKEN OUT</small>
      </div>
      <div className="rr-convoy-condition">
        <span>HULL {convoy?.hull ?? 100}%</span>
        <progress max={100} value={convoy?.hull ?? 100} aria-label="Kart hull" />
      </div>
      <time aria-label="Time remaining">{formatTime(convoy?.seconds ?? 100).split('.')[0]}</time>
    </div>
  );
}

export function ConvoyAim({ warning }: { warning?: boolean }) {
  return warning
    ? <div className="rr-convoy-warning" role="status"><TriangleAlert size={20} /> INCOMING FIRE</div>
    : <div className="rr-convoy-aim" aria-hidden="true"><Crosshair size={22} /></div>;
}

export function ConvoyRocket({ rockets, disabled, onFire }: {
  rockets: number;
  disabled: boolean;
  onFire: () => void;
}) {
  return (
    <button type="button" className="rr-convoy-rocket" disabled={disabled || rockets === 0}
      onClick={onFire} aria-label={`Launch rocket, ${rockets} remaining`}>
      <Rocket size={21} /><b>{rockets}</b>
    </button>
  );
}

export const convoyResult = {
  cleared: 'Convoy stopped',
  wrecked: 'Kart disabled',
  escaped: 'Command truck escaped',
  timeout: 'Time expired',
  active: 'Run ended'
};
