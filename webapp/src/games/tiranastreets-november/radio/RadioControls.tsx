import { useState } from 'react';
import { ALBANIAN_STATIONS } from './stations';
import type { RadioSnapshot } from './VehicleRadio';
import './radio.css';

const STATUS = { off: 'Tap to listen', paused: 'Paused', connecting: 'Connecting…', playing: 'LIVE', blocked: 'Tap to play', unavailable: 'Station unavailable · tap to retry' };
export function RadioControls({ radio, onAction, onVolume }: {
  radio: RadioSnapshot; onAction: (action: string) => void; onVolume: (value: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const station = ALBANIAN_STATIONS.find(s => s.id === radio.station)!;
  return <section className="ts-radio" aria-label="Car radio">
    <div className="ts-radio-row">
      <button aria-label="Previous radio station" onClick={() => onAction('previous')}>‹</button>
      <button className="ts-radio-station" aria-label="Choose radio station" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        <strong>{station.name}</strong><small role="status">{STATUS[radio.status]}</small>
      </button>
      <button aria-label="Next radio station" onClick={() => onAction('next')}>›</button>
      <button aria-label={radio.status === 'playing' || radio.status === 'connecting' ? 'Turn radio off' : 'Play radio'} onClick={() => onAction('toggle')}>{radio.status === 'playing' || radio.status === 'connecting' ? 'Ⅱ' : '▶'}</button>
    </div>
    {expanded && <div className="ts-radio-panel">
      <label>Station<select aria-label="Albanian radio station" value={radio.station} onChange={e => onAction(e.target.value)}>
        {ALBANIAN_STATIONS.map(s => <option key={s.id} value={s.id}>{s.name} · {s.genre}</option>)}
      </select></label>
      <label>Radio volume<input aria-label="Radio volume" type="range" min="0" max="1" step=".05" value={radio.volume} onChange={e => onVolume(Number(e.target.value))}/></label>
      <a href={station.website} target="_blank" rel="noopener noreferrer">Official station ↗</a>
      <button onClick={() => setExpanded(false)}>Done</button>
    </div>}
  </section>;
}
