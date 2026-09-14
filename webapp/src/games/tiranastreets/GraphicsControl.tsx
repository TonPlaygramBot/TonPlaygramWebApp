import {GRAPHICS_PROFILES, type GraphicsSetting, type GraphicsPreset} from './graphicsQuality';
export function GraphicsControl({value, resolved, onChange}: {value:GraphicsSetting; resolved?:GraphicsPreset; onChange:(v:GraphicsSetting)=>void}) {
  return <div className="ts-graphics-control"><label>Graphics <select aria-label="Graphics quality" value={value} onChange={e=>onChange(e.target.value as GraphicsSetting)}>
    <option value="auto">Automatic</option>{Object.entries(GRAPHICS_PROFILES).map(([id,p])=><option key={id} value={id}>{p.label}</option>)}
  </select></label><small>{value==='auto' ? `Adapts to your device and frame rate${resolved ? ' · '+GRAPHICS_PROFILES[resolved].label : ''}.` : 'Your selected quality stays fixed.'} Complete blocks remain visible to 2 km.</small></div>;
}
