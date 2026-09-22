import {graphicsSetting, type GraphicsSetting} from '../graphicsQuality';
import {targetFps, type TargetFps} from '../renderSettings';
export type StreetSettings = {
  targetFps: TargetFps;
  quality: GraphicsSetting;
  fov: number;
  sensitivity: number;
  headBob: number;
  shake: number;
  buttonSize: number;
  opacity: number;
  volume: number;
  aimAssist: boolean;
  aimSensitivity: number;
  joystickDeadzone: number;
  leftHanded: boolean;
  showPerformance: boolean;
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
  aimAssist: false,
  aimSensitivity: .65,
  joystickDeadzone: .08,
  leftHanded: false,
  showPerformance: false
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
      'volume',
      'aimSensitivity',
      'joystickDeadzone'
    ] as const) {
      const bounds = {
        fov: [60, 90],
        sensitivity: [0.4, 2],
        headBob: [0, 1],
        shake: [0, 1],
        buttonSize: [48, 64],
        opacity: [0.3, 1],
        volume: [0, 1],
        aimSensitivity: [.2, 1.2],
        joystickDeadzone: [0, .25]
      }[key];
      if (Number.isFinite(raw[key]))
        s[key] = Math.max(bounds[0], Math.min(bounds[1], raw[key]));
    }
    s.targetFps = targetFps(raw.targetFps);
    s.quality = graphicsSetting(raw.quality);
    s.aimAssist = raw.aimAssist === true;
    s.leftHanded = raw.leftHanded === true;
    s.showPerformance = raw.showPerformance === true;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
