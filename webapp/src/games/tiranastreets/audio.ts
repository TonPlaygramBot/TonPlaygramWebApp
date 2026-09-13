import type { State, Player } from './shared/engine.mjs';
import { SceneSound } from './SceneSound';
export class CityAudio {
  readonly sound = new SceneSound();
  private seen = 0;

  private footstep = 0;
  private _enabled = true;
  private _volume = 1;
  get enabled() { return this._enabled; }
  set enabled(value: boolean) { this._enabled = value; this.sync(); }
  get volume() { return this._volume; }
  set volume(value: number) { this._volume = value; this.sync(); }
  private sync() { this.sound.setVolume(this.enabled ? this.volume : 0); }
  async unlock() { await this.sound.unlock(); this.sync(); }
  update(speed: number, inCar: boolean) { this.sound.loop('car', 28 + Math.abs(speed) * 3, inCar ? .035 + Math.min(.08, Math.abs(speed) * .001) : 0, 240); }
  city(state: State, p: Player, dt: number, cameraYaw = p.heading, grounded = true, eyeY = 0) {
    if (state.effectSeq < this.seen) { this.seen = 0; this.footstep = 0; }
    this.sound.setListener({ x: p.x, y: eyeY, z: p.z }, cameraYaw);
    for (const event of state.effects) {
      if (event.id <= this.seen) continue;
      this.seen = event.id;
      if ((event.kind === 'reload' || event.kind === 'purchase') && event.owner !== p.id) continue;
      this.sound.event(event.kind, event);
    }
    if (Math.abs(p.speed) > .4 && !p.carId && !p.aircraftId && p.health > 0 && grounded) {
      this.footstep += dt;
      if (this.footstep > (Math.abs(p.speed) > 5 ? .25 : .4)) { this.footstep = 0; this.sound.event('step'); }
    } else this.footstep = 0;
    const distance = state.units.reduce((best, u) => Math.min(best, Math.hypot(p.x - u.x, p.z - u.z)), Infinity);
    this.sound.loop('siren', 630 + Math.sin(state.elapsed * 7) * 190, distance < 130 ? .03 / (1 + distance * .035) : 0, 1600, 'sine');
    const h = state.helicopter, j = state.jet;
    const helicopter = h && h.pilot && (h.health ?? 1) > 0 ? this.sound.spatial(h).gain : 0;
    const jet = j && j.pilot && (j.health ?? 1) > 0 ? this.sound.spatial(j).gain : 0;
    this.sound.loop('rotor', 25, helicopter * (.085 + Math.sin(state.elapsed * 23) * .02), 320, 'triangle');
    this.sound.loop('turbine', 115 + Math.abs(j?.speed ?? 0) * 2, jet * .075, 1800);
  }
  street(kind: string) { if(['door','punch','kick','land','block','melee-hit','loot','objective'].includes(kind))this.sound.event(kind); }
  cue(success = true) { this.sound.tone(success ? 660 : 220, .25, .12, success ? 990 : 110); }
  suspend() { this.sound.suspend(); this.footstep = 0; }
  destroy() { this.sound.dispose(); }
}
