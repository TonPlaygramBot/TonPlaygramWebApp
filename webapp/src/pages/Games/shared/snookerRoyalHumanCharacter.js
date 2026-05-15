import { MURLAN_CHARACTER_THEMES } from '../../../config/murlanCharacterThemes.js';

export const SNOOKER_ROYAL_HUMAN_CHARACTER_THEME =
  MURLAN_CHARACTER_THEMES.find((theme) => theme.id === 'rpm-current') ||
  MURLAN_CHARACTER_THEMES[0];

export function buildSnookerRoyalHumanModelUrls(theme = SNOOKER_ROYAL_HUMAN_CHARACTER_THEME) {
  const urls = [
    ...(theme?.modelUrls || []),
    theme?.url,
    ...MURLAN_CHARACTER_THEMES.flatMap((entry) => [
      ...(entry?.modelUrls || []),
      entry?.url
    ]),
    'https://threejs.org/examples/models/gltf/readyplayer.me.glb',
    'https://threejs.org/examples/models/gltf/Xbot.glb',
    'https://threejs.org/examples/models/gltf/Soldier.glb'
  ].filter(Boolean);
  return [...new Set(urls)];
}
