// Fictional solo-game guardrail: weapon use is an explicit committed event,
// never inferred from equipment, wanted points, or an unarmed hit.
const OFFICERS = new Set(['police','soldier','military']);
export class ArcadeResponse {
  weaponUntil = -Infinity;
  warning = null;

  recordWeaponUse(now) {
    this.weaponUntil = now + 20;
  }
  allowsNpcWeapon(now) {
    return now < this.weaponUntil;
  }
  registerUnarmedHit(now, target) {
    if (!OFFICERS.has(target.kind) || target.health <= 0 || this.allowsNpcWeapon(now)) return false;
    this.warning = {officerId:target.id, until:now+2.5};
    return true;
  }
  update(now, npcs, player) {
    if (player.wanted <= 0 || player.health <= 0 || player.finished || player.failed) this.weaponUntil = -Infinity;
    if (!this.warning) return false;
    const officer = npcs.find(n => n.id === this.warning.officerId && n.health > 0);
    if (now < this.warning.until && officer && Math.hypot(officer.x-player.x,officer.z-player.z) < 5 &&
        player.health > 0 && !player.finished && !player.failed) return true;
    this.warning = null;
    return false;
  }
  holdOfficer(now, officer) {
    if (!OFFICERS.has(officer.kind) || this.allowsNpcWeapon(now) || (officer.motion === 'drive' && !officer.deployed)) return false;
    officer.anim = 'idle';
    officer.speed = 0;
    officer.aimSince = undefined;
    return true;
  }
}
