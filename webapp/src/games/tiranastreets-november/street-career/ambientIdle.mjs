// A deterministic offset per actor; replaying the same scene does not depend on
// load order or share a single animation clock across nearby stopped people.
export function ambientIdlePhase(seed) {
  return (seed >>> 0) / 0x100000000;
}

export function plainCivilianIdle(n) {
  return n.kind === 'civilian' && n.health > 0 && !n.weapon &&
    (n.motion === 'walk' || n.motion === 'idle' || n.motion === 'play') &&
    (!n.anim || n.anim === 'idle' || n.anim === 'walk');
}

/** Brief, untargeted ambient glances. The viewer, traffic and NPC logic have no
 * inputs here, and returning to neutral is continuous at each interval edge. */
export function ambientGlance(seed, seconds) {
  if (!Number.isFinite(seconds)) return 0;
  const pace = 5.6 + ((seed >>> 13) % 18) / 10;
  const shifted = Math.max(0, seconds) + ambientIdlePhase(seed) * pace;
  const cycle = Math.floor(shifted / pace);
  const within = shifted - cycle * pace;
  if (within >= 1.6) return 0;
  const ease = Math.sin(Math.PI * within / 1.6);
  const sign = ((cycle + (seed >>> 9)) % 2) ? 1 : -1;
  return sign * (.13 + ((seed >>> 21) % 8) * .01) * ease * ease;
}
