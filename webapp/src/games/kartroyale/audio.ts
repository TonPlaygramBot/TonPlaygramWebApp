import type { Frame } from './renderer';
/** Lightweight local Web Audio synthesis: no stream, asset download or autoplay. */
export class KartAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private tire: GainNode | null = null;
  private air: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private lastImpact = 0;
  private lastCrowd = -1;
  muted = false;
  unlock() {
    if (!this.context)
      try {
        const Constructor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const c = (this.context = new Constructor());
        const master = (this.master = c.createGain());
        master.gain.value = this.muted ? 0 : 0.45;
        master.connect(c.destination);
        const oscillator = (this.engine = c.createOscillator()),
          gain = (this.engineGain = c.createGain()),
          filter = c.createBiquadFilter();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 44;
        filter.type = 'lowpass';
        filter.frequency.value = 480;
        gain.gain.value = 0;
        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        oscillator.start();
        this.sources.push(oscillator);
        this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const buffer = this.noise.getChannelData(0);
        let seed = 7141;
        for (let i = 0; i < buffer.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          buffer[i] = seed / 2147483648 - 1;
        }
        const loop = (frequency: number, q: number) => {
          const source = c.createBufferSource(),
            filter = c.createBiquadFilter(),
            g = c.createGain();
          source.buffer = this.noise;
          source.loop = true;
          filter.type = 'bandpass';
          filter.frequency.value = frequency;
          filter.Q.value = q;
          g.gain.value = 0;
          source.connect(filter);
          filter.connect(g);
          g.connect(master);
          source.start();
          this.sources.push(source);
          return g;
        };
        this.tire = loop(1750, 2.8);
        this.air = loop(380, 0.7);
      } catch {
        return;
      }
    this.context?.resume().catch(() => {});
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        m ? 0 : 0.45,
        this.context.currentTime,
        0.025
      );
  }
  update(frame: Frame, active: boolean) {
    if (!this.context) return;
    const c = this.context,
      now = c.currentTime;
    const running = active && !frame.retired && frame.countdown === 0;
    this.engine?.frequency.setTargetAtTime(
      40 + frame.speed * 5.4 + (100 - frame.health) * 0.04,
      now,
      0.08
    );
    this.engineGain?.gain.setTargetAtTime(
      running ? 0.04 + frame.speed * 0.002 : 0,
      now,
      0.08
    );
    this.tire?.gain.setTargetAtTime(
      running && frame.drifting ? Math.min(0.16, frame.speed * 0.008) : 0,
      now,
      0.05
    );
    this.air?.gain.setTargetAtTime(
      running ? frame.speed * 0.0012 : 0,
      now,
      0.08
    );
    if (frame.impactId !== this.lastImpact) {
      if (running && frame.impactId > this.lastImpact) this.crash(frame.impact);
      this.lastImpact = frame.impactId;
    }
    const crowd = Math.floor(frame.time / 16);
    if (running && crowd !== this.lastCrowd) {
      this.lastCrowd = crowd;
      this.burst(0.32, 0.018, 800);
    }
  }
  silence() {
    if (!this.context) return;
    const now = this.context.currentTime;
    [this.engineGain, this.tire, this.air].forEach((g) =>
      g?.gain.setTargetAtTime(0, now, 0.025)
    );
  }
  private burst(duration: number, volume: number, frequency: number) {
    if (this.muted || !this.context || !this.noise || !this.master) return;
    const c = this.context,
      source = c.createBufferSource(),
      g = c.createGain(),
      filter = c.createBiquadFilter(),
      now = c.currentTime;
    source.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    source.start();
    source.stop(now + duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }
  private crash(strength: number) {
    this.burst(
      0.12 + strength * 0.24,
      0.12 + strength * 0.25,
      600 + strength * 2000
    );
    this.beep(62 + strength * 30, 0.1);
  }
  beep(f = 550, d = 0.13) {
    if (this.muted || !this.context || !this.master) return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain(),
      now = c.currentTime;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + d);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(now + d);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  destroy() {
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {}
      s.disconnect();
    });
    this.context?.close().catch(() => {});
    this.context = null;
  }
}
