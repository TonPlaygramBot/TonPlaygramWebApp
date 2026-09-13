import {targetFps, type TargetFps} from '../renderSettings';
export type StreetSettings = {
  targetFps: TargetFps;
  quality: 'auto' | 'high' | 'battery';
  fov: number;
  sensitivity: number;
  headBob: number;
  shake: number;
  buttonSize: number;
  opacity: number;
  volume: number;
  aimAssist: boolean;
};
export const DEFAULT_SETTINGS: StreetSettings = {
  targetFps: 60,
  quality: 'auto',
  fov: 74,
  sensitivity: 1,
  headBob: 0,
  shake: 0.35,
  buttonSize: 54,
  opacity: 0.85,
  volume: 0.6,
  aimAssist: false
};
export function loadSettings(
  storage?: Pick<Storage, 'getItem'>
): StreetSettings {
  try {
    const raw = JSON.parse(
        storage?.getItem('tirana-streets:street-settings:v1') || '{}'
      ),
      s = { ...DEFAULT_SETTINGS };
    for (const key of [
      'fov',
      'sensitivity',
      'headBob',
      'shake',
      'buttonSize',
      'opacity',
      'volume'
    ] as const) {
      const bounds = {
        fov: [60, 90],
        sensitivity: [0.4, 2],
        headBob: [0, 1],
        shake: [0, 1],
        buttonSize: [48, 64],
        opacity: [0.3, 1],
        volume: [0, 1]
      }[key];
      if (Number.isFinite(raw[key]))
        s[key] = Math.max(bounds[0], Math.min(bounds[1], raw[key]));
    }
    s.targetFps = targetFps(raw.targetFps);
    s.quality = raw.quality === 'high' || raw.quality === 'battery' ? raw.quality : 'auto';
    s.aimAssist = raw.aimAssist === true;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
