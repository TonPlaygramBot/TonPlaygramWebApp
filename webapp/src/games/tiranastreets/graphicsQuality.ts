export type GraphicsPreset = 'battery' | 'balanced' | 'high';
export type GraphicsSetting = 'auto' | GraphicsPreset;
export const GRAPHICS_PROFILES = {
  battery: { label: 'Battery saver', pixelRatio: .9, shadows: false, shadowSize: 512, shadowSpan: 64 },
  balanced: { label: 'Balanced', pixelRatio: 1.25, shadows: true, shadowSize: 512, shadowSpan: 76 },
  high: { label: 'High', pixelRatio: 1.8, shadows: true, shadowSize: 1024, shadowSpan: 104 }
} as const;
export function graphicsSetting(value: unknown): GraphicsSetting {
  return value === 'high' || value === 'balanced' || value === 'battery' ? value : value === 'low' ? 'battery' : 'auto';
}
export function devicePreset(device: { cores?: number; memory?: number; pixels?: number; mobile?: boolean }): GraphicsPreset {
  if ((device.cores !== undefined && device.cores <= 4) || (device.memory !== undefined && device.memory <= 4)) return 'battery';
  if (device.mobile || (device.pixels || 0) > 4000000 || !device.cores || device.cores < 8) return 'balanced';
  return 'high';
}
export function currentDevicePreset(): GraphicsPreset {
  if (typeof navigator === 'undefined') return 'balanced';
  return devicePreset({ cores: navigator.hardwareConcurrency,
    memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    pixels: innerWidth * innerHeight * Math.pow(devicePixelRatio || 1, 2),
    mobile: navigator.maxTouchPoints > 0 });
}
/** Two slow windows lower quality; six healthy windows restore it. Hidden tabs
 * and loading screens must not be sampled. Detail changes never remove blocks. */
export class AutomaticGraphics {
  preset: GraphicsPreset;
  private slow = 0;
  private healthy = 0;
  private cooldown = 0;
  constructor(readonly ceiling: GraphicsPreset = currentDevicePreset()) { this.preset = ceiling; }
  reset() { this.preset = this.ceiling; this.slow = this.healthy = this.cooldown = 0; }
  sample(fps: number, target: number): boolean {
    if (!Number.isFinite(fps) || fps <= 0) return false;
    if (this.cooldown > 0) { this.cooldown--; return false; }
    // A 90/120 FPS cap cannot make a 60 Hz panel produce extra frames.
    // Auto quality aims for up to 60 FPS; the selected render cap stays intact.
    const ratio = fps / Math.max(1, Math.min(60, target));
    this.slow = ratio < .78 ? this.slow + 1 : 0;
    this.healthy = ratio >= .97 ? this.healthy + 1 : 0;
    const levels: GraphicsPreset[] = ['battery', 'balanced', 'high'];
    const i = levels.indexOf(this.preset), max = levels.indexOf(this.ceiling);
    const next = this.slow >= 2 ? Math.max(0, i - 1) : this.healthy >= 6 ? Math.min(max, i + 1) : i;
    if (next === i) return false;
    this.preset = levels[next]; this.slow = this.healthy = 0; this.cooldown = 3;
    return true;
  }
}

/** Resolution adjusts before geometry/shadow presets. Samples are two-second
 * active-play windows; a short hitch never lowers quality. Recovery takes three
 * times as long and every step gets a cooldown to avoid resize oscillation.
 * This is native dynamic resolution, not AI upscaling or a texture downgrade. */
export class DynamicResolution {
  scale = 1;
  readonly minimum = .72;
  private slow = 0;
  private healthy = 0;
  private cooldown = 0;
  get atMinimum() { return this.scale <= this.minimum + .001; }
  reset() { this.scale = 1; this.slow = this.healthy = this.cooldown = 0; }
  sample(fps: number, target: number): boolean {
    if (!Number.isFinite(fps) || fps <= 0) return false;
    if (this.cooldown > 0) { this.cooldown--; return false; }
    const ratio = fps / Math.max(1, Math.min(60, target));
    this.slow = ratio < .87 ? this.slow + 1 : 0;
    this.healthy = ratio >= .98 ? this.healthy + 1 : 0;
    const next = this.slow >= 2 ? Math.max(this.minimum, this.scale - .1)
      : this.healthy >= 6 ? Math.min(1, this.scale + .1) : this.scale;
    if (Math.abs(next - this.scale) < .001) return false;
    this.scale = Math.round(next * 100) / 100;
    this.slow = this.healthy = 0;
    this.cooldown = 2;
    return true;
  }
}
