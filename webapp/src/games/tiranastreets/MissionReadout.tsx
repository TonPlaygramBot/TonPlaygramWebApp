import './mission-readout.css';
export type MissionReadoutProps = {
  label: string;
  eyebrow: string;
  title: string;
  detail?: string;
  progress?: number;
  remaining?: number | null;
  meta?: string[];
  hint?: string;
  contested?: boolean;
};
/** Shared live mission status. Keep transient input and the render loop outside React. */
export function MissionReadout({label, eyebrow, title, detail, progress, remaining, meta, hint, contested = false}: MissionReadoutProps) {
  const timed = typeof remaining === 'number' && Number.isFinite(remaining);
  const ratio = typeof progress === 'number' && Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : undefined;
  return <div className={`ts-mission-readout${contested ? ' is-contested' : ''}`} role="group" aria-label={label}>
    <div className="ts-mission-heading"><small>{eyebrow}</small>{timed && <time aria-label={`${Math.max(0, Math.ceil(remaining))} seconds remaining`}>{Math.max(0, Math.ceil(remaining))}s</time>}</div>
    <strong>{title}</strong>
    {detail && <p>{detail}</p>}
    {ratio !== undefined && <progress aria-label={`${label} progress`} max={1} value={ratio}/>}
    {meta && meta.length > 0 && <div className="ts-mission-meta">{meta.map((item, index) => <span key={`${index}-${item}`}>{item}</span>)}</div>}
    {hint && <small className="ts-mission-hint">{hint}</small>}
  </div>;
}
