import { FRAME_RATES, targetFps, type TargetFps } from './renderSettings';
export function FrameRateControl({value, onChange}: {value: TargetFps; onChange: (value: TargetFps) => void}) {
  return <div className="ts-frame-rate">
    <label>Frame rate <select aria-label="Target frame rate" value={value} onChange={e => onChange(targetFps(Number(e.target.value)))}>
      {FRAME_RATES.map(fps => <option key={fps} value={fps}>{fps} FPS · {fps} Hz target</option>)}
    </select></label>
    <small>Maximum frame rate. Your display and device determine the FPS you can reach.</small>
  </div>;
}
