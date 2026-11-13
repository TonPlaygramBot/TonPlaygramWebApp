export const GHOST_VERSION = 1;
const MAX_SAMPLES = 16000;
const finite = n => typeof n === 'number' && Number.isFinite(n);
// Geometry signature prevents replaying a ghost after a route/physics update.
export function ghostKey(track, kart) {
  let hash = 2166136261;
  for (const p of track.points) for (const v of [p.x, p.z, p.width || track.width])
    hash = Math.imul(hash ^ Math.round(v * 100), 16777619) >>> 0;
  return `racingRoyal.timeTrial.v${GHOST_VERSION}.${track.id}.${hash}.${kart}`;
}
export function loadGhost(storage, key) {
  try {
    const raw = storage?.getItem(key);
    if (!raw || raw.length > 2200000) return null;
    const g = JSON.parse(raw);
    if (g.version !== GHOST_VERSION || !finite(g.time) || g.time <= 0 || g.time > 1500 ||
        !Array.isArray(g.sectors) || g.sectors.length !== 4 || !g.sectors.every(s => finite(s) && s > 0) ||
        Math.abs(g.sectors.reduce((a,b)=>a+b,0)-g.time) > .02 ||
        !Array.isArray(g.samples) || g.samples.length < 2 || g.samples.length > MAX_SAMPLES) return null;
    let previous = -1;
    for (const s of g.samples) {
      if (!Array.isArray(s) || s.length !== 5 || !s.every(finite) || s[0] <= previous || s[0] > g.time + .01 ||
          Math.abs(s[1]) > 1e6 || Math.abs(s[2]) > 1e6 || Math.abs(s[3]) > 1e4 || Math.abs(s[4]) > 1e6) return null;
      previous = s[0];
    }
    if (g.samples[0][0] !== 0 || Math.abs(previous - g.time) > .02) return null;
    return g;
  } catch { return null; }
}
export function sampleGhost(ghost, time) {
  if (!ghost || !finite(time) || time < 0 || time > ghost.time) return null;
  const samples = ghost.samples;
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid][0] > time) hi = mid; else lo = mid; }
  const a = samples[lo], b = samples[hi], t = Math.max(0, Math.min(1, (time - a[0]) / (b[0] - a[0])));
  const yawDelta = Math.atan2(Math.sin(b[3] - a[3]), Math.cos(b[3] - a[3]));
  return { x: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t,
    yaw: a[3] + yawDelta * t, y: a[4] + (b[4] - a[4]) * t };
}
export class GhostRecorder {
  constructor(storage, key, sessionBest) {
    this.storage = storage; this.key = key; this.best = loadGhost(storage, key);
    this.reference = this.best; this.samples = []; this.lap = 0; this.saved = true; this.improved = false;
    if(sessionBest&&(!this.best||sessionBest.ghost.time<this.best.time)){
      this.best=this.reference=sessionBest.ghost;this.saved=sessionBest.saved;
    }
  }
  sample(r, time, force = false) {
    const elapsed = Math.max(0, time - r.lapStartedAt), previous = this.samples.at(-1);
    if (previous && elapsed <= previous[0]) return;
    if (!force && previous && elapsed - previous[0] < .099) return;
    if (this.samples.length >= MAX_SAMPLES) return;
    this.samples.push([elapsed, r.x, r.z, r.yaw, (r.groundY || 0) + (r.jumpHeight || 0)]);
  }
  update(r, time) {
    if (r.lap !== this.lap) {
      const completed = r.telemetry?.lastLap;
      if (this.lap > 0 && completed?.valid && this.samples.length > 1 && this.samples.length < MAX_SAMPLES) {
        const end = [completed.time, r.x, r.z, r.yaw, (r.groundY || 0) + (r.jumpHeight || 0)];
        if (end[0] > this.samples.at(-1)[0]) this.samples.push(end);
        if (!this.best || completed.time < this.best.time) {
          this.best = { version: GHOST_VERSION, time: completed.time, sectors: [...completed.sectors], samples: this.samples };
          this.improved = true;
          try { if (!this.storage) throw Error('Storage unavailable'); this.storage.setItem(this.key, JSON.stringify(this.best)); this.saved = true; }
          catch { this.saved = false; }
        }
      }
      this.lap = r.lap; this.samples = []; this.reference = this.best;
    }
    if (r.lap > 0 && !r.finished) this.sample(r, time);
  }
  split(r) {
    const sectors = r.telemetry?.sectors || [];
    if (!this.reference || !sectors.length || !r.telemetry?.valid) return null;
    return sectors.reduce((a,b)=>a+b,0) - this.reference.sectors.slice(0,sectors.length).reduce((a,b)=>a+b,0);
  }
}
