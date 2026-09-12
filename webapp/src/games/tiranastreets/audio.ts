import type { State, Player } from "./shared/engine.mjs";
import { WEAPON_BY_ID } from "./shared/weapons.mjs";
export class CityAudio {
  private context: AudioContext | null = null;
  private engine: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private seen = 0;
  private lastTime = 0;
  private footstep = 0;
  private siren: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = true;
  volume = 1;
  private voices = 0;
  async unlock() {
    if (!this.context) {
      const Context = window.AudioContext;
      this.context = new Context();
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.context.destination);
      this.engine = this.context.createOscillator();
      this.engine.type = "sawtooth";
      const filter = this.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 220;
      this.engine.connect(filter);
      filter.connect(this.gain);
      this.engine.start();
      this.siren = this.context.createOscillator();
      this.siren.type = "sine";
      this.sirenGain = this.context.createGain();
      this.sirenGain.gain.value = 0;
      this.siren.connect(this.sirenGain);
      this.sirenGain.connect(this.context.destination);
      this.siren.start();
      this.noise = this.context.createBuffer(
        1,
        this.context.sampleRate,
        this.context.sampleRate,
      );
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.context.state === "suspended") await this.context.resume();
  }
  update(speed: number, inCar: boolean) {
    if (!this.context || !this.gain || !this.engine) return;
    const t = this.context.currentTime;
    this.sirenGain?.gain.setTargetAtTime(0, t, 0.1);
    this.engine.frequency.setTargetAtTime(28 + Math.abs(speed) * 3, t, 0.1);
    this.gain.gain.setTargetAtTime(
      this.enabled && inCar ? (0.018 + Math.abs(speed) * 0.0008)*this.volume : 0,
      t,
      0.1,
    );
  }
  private burst(duration: number, frequency: number, volume: number, pan = 0) {
    if (!this.context || !this.noise || !this.enabled || this.voices >= 10) return;
    this.voices++;
    const c = this.context,
      source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain(),
      stereo = c.createStereoPanner();
    source.buffer = this.noise;
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(Math.max(0.0001, volume * this.volume), c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    stereo.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(filter);
    filter.connect(gain);
    gain.connect(stereo);
    stereo.connect(c.destination);
    source.onended = () => {
      this.voices=Math.max(0,this.voices-1);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      stereo.disconnect();
    };
    source.start();
    source.stop(c.currentTime + duration);
  }
  city(state: State, p: Player, dt: number) {
    if (state.effectSeq < this.seen) this.seen = 0;
    this.lastTime = state.elapsed;
    const fresh = state.effects.filter((e) => e.id > this.seen);
    for (const event of fresh) {
      this.seen = Math.max(this.seen, event.id);
      const distance = Math.hypot(p.x - event.x, p.z - event.z);
      if (distance > 100) continue;
      const volume = 0.14 / (1 + distance * 0.1),
        pan =
          ((event.x - p.x) * Math.cos(p.heading) -
            (event.z - p.z) * Math.sin(p.heading)) /
          35;
      if (event.kind === "shot") {
        const w = WEAPON_BY_ID.get(event.weapon);
        this.burst(
          w?.category === "shotgun" ? 0.23 : 0.1,
          w?.category === "sidearm" ? 2600 : 1400,
          volume,
          pan,
        );
      } else if (event.kind === "explosion")
        this.burst(0.55, 280, volume * 2, pan);
      else if (event.kind === "reload" && event.owner === p.id) {
        this.burst(0.08, 3400, 0.065);
      } else if (event.kind === "purchase" && event.owner === p.id) this.cue();
      else if (event.kind === "hit") this.burst(0.08, 350, volume * 0.45, pan);
    }
    if (p.speed > 0.4 && !p.carId && p.health > 0) {
      this.footstep += dt;
      if (this.footstep > (p.speed > 5 ? 0.25 : 0.4)) {
        this.footstep = 0;
        this.burst(0.065, 500, 0.028);
      }
    }
    if (this.context && this.siren && this.sirenGain) {
      const distance = state.units.reduce(
          (best, u) => Math.min(best, Math.hypot(p.x - u.x, p.z - u.z)),
          Infinity,
        ),
        t = this.context.currentTime;
      this.siren.frequency.setTargetAtTime(
        630 + Math.sin(t * 7) * 190,
        t,
        0.05,
      );
      this.sirenGain.gain.setTargetAtTime(
        this.enabled && distance < 130 ? 0.023*this.volume / (1 + distance * 0.035) : 0,
        t,
        0.08,
      );
    }
  }
  street(kind:string) {
    if(kind==='door')this.burst(.12,480,.05);
    if(kind==='punch'||kind==='kick')this.burst(.1,850,.035);
    if(kind==='land')this.burst(.12,300,.04);
    if(kind==='block'||kind==='melee-hit')this.burst(.09,250,.08);
    if(kind==='loot'||kind==='objective')this.cue();
  }
  cue(success = true) {
    if (!this.context || !this.enabled) return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(success ? 660 : 220, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      success ? 990 : 110,
      c.currentTime + 0.17,
    );
    g.gain.setValueAtTime(.07*this.volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.26);
  }
  destroy() {
    void this.context?.close();
    this.context = null;
  }
}
