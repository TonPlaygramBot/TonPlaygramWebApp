// Runtime bookkeeping stays out of saves and network snapshots. Hashing the
// actor ID spreads distant work over time without randomizing gameplay.
const clocks = new WeakMap();
export function scheduledActorStep(actor, now, dt, interval = 0) {
  if (!Number.isFinite(now) || !Number.isFinite(dt) || dt <= 0) return 0;
  let clock = clocks.get(actor);
  if (!clock) {
    let hash = 2166136261;
    for (const c of String(actor.id)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    clock = { pending: 0, phase: ((hash >>> 0) % 1024 + .5) / 1024, last: now - dt };
    clocks.set(actor, clock);
  }
  if(now<clock.last)clock.pending=0;
  clock.last=now;
  clock.pending += dt;
  // Nearby actors immediately consume all time since their previous update.
  // Distant actors cross different interval boundaries, avoiding herd spikes.
  if (interval > 0 && Math.floor((now + clock.phase * interval + 1e-8) / interval) ===
      Math.floor((now - dt + clock.phase * interval + 1e-8) / interval)) return 0;
  const step = clock.pending;
  clock.pending = 0;
  return step;
}
