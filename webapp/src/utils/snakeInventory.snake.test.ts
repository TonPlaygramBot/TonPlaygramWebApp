import { beforeEach, describe, expect, it } from 'vitest';
import { getSnakeInventory, isSnakeOptionUnlocked, addSnakeUnlock } from './snakeInventory.js';
import { SNAKE_CAPTURE_WEAPON_OPTIONS, SNAKE_PLAYABLE_CAPTURE_WEAPON_OPTIONS } from '../config/snakeWeaponCatalog.js';

describe('Snake firearm ownership', () => {
  beforeEach(() => window.localStorage.clear());

  it('retains owned firearms across normalization and reload without unlocking other guns', () => {
    window.localStorage.setItem('snakeInventoryByAccount', JSON.stringify({
      player: { captureWeapon: ['slot-10-ak47-gltf', 'polyShotgun01Attack', 'unknown-gun'] }
    }));
    const inventory = getSnakeInventory('player');
    expect(isSnakeOptionUnlocked('captureWeapon', 'ak47VolleyAttack', inventory)).toBe(true);
    expect(isSnakeOptionUnlocked('captureWeapon', 'poly-shotgun-01', inventory)).toBe(true);
    expect(isSnakeOptionUnlocked('captureWeapon', 'slot-16-awp-glb', inventory)).toBe(false);
    expect(inventory.captureWeapon).not.toContain('unknown-gun');
    expect(getSnakeInventory('player').captureWeapon).toEqual(inventory.captureWeapon);
    const playable = SNAKE_PLAYABLE_CAPTURE_WEAPON_OPTIONS.filter(option =>
      isSnakeOptionUnlocked('captureWeapon', option.id, inventory));
    expect(playable.map(option => option.id)).toEqual(expect.arrayContaining(['slot-10-ak47-gltf', 'poly-shotgun-01']));
  });

  it('persists a firearm unlock only for its account', () => {
    addSnakeUnlock('captureWeapon', 'sniperShotAttack', 'owner');
    expect(isSnakeOptionUnlocked('captureWeapon', 'slot-16-awp-glb', getSnakeInventory('owner'))).toBe(true);
    expect(isSnakeOptionUnlocked('captureWeapon', 'slot-16-awp-glb', getSnakeInventory('guest'))).toBe(false);
  });

  it('keeps existing appearance indices and default unlocks stable', () => {
    const previousSlots = ['ukrainianDroneAttack', 'droneAttack', 'missileJavelin', 'helicopterAttack', 'fighterJetAttack'];
    expect(SNAKE_CAPTURE_WEAPON_OPTIONS.map(option => option.id)).toEqual(previousSlots);
    expect(SNAKE_PLAYABLE_CAPTURE_WEAPON_OPTIONS.slice(0, 5).map(option => option.id)).toEqual(previousSlots);
    expect(getSnakeInventory('new-player').captureWeapon.every(id => previousSlots.includes(id))).toBe(true);
  });
});
