import { CAPTURE_ANIMATION_OPTIONS } from '../config/ludoBattleOptions.js';

export const CAPTURE_WEAPON_OPTIONS = Object.freeze(
  CAPTURE_ANIMATION_OPTIONS.map((option) => ({
    id: option.id,
    label: option.label,
    thumbnail: option.thumbnail
  }))
);

export const LEGACY_CAPTURE_WEAPON_ID_MAP = Object.freeze({
  drone: 'droneAttack',
  fighter: 'fighterJetAttack',
  helicopter: 'helicopterAttack',
  supportTruck: 'grenadeBlastAttack',
  javelin: 'missileJavelin'
});

export const SNAKE_CAPTURE_WEAPON_KIND_MAP = Object.freeze({
  fighterJetAttack: 'fighter',
  droneAttack: 'drone',
  helicopterAttack: 'helicopter',
  grenadeBlastAttack: 'supportTruck',
  missileJavelin: 'javelin'
});

export function normalizeCaptureWeaponId(value, fallback = 'fighterJetAttack') {
  if (!value) return fallback;
  return LEGACY_CAPTURE_WEAPON_ID_MAP[value] || value;
}

export function normalizeSnakeCaptureWeaponKind(weaponType = 'fighter') {
  return SNAKE_CAPTURE_WEAPON_KIND_MAP[weaponType] || weaponType || 'fighter';
}
