/** Gesture-unlocked, RPM-driven engine and filtered water audio; no network audio. */
export class JetskiAudio {
  context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private water: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private enabled = true;
  async unlock() {
    try {
      if (!this.context) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        const ctx: AudioContext = new AC();
        this.context = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = 0.22;
        this.master.connect(ctx.destination);
        this.engine = ctx.createOscillator();
        this.engine.setPeriodicWave(
          ctx.createPeriodicWave(
            new Float32Array([0, 0, 0, 0, 0, 0, 0]),
            new Float32Array([0, 1, 0.5, 0.22, 0.14, 0.07, 0.03])
          )
        );
        this.engineGain = ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engine.connect(this.engineGain).connect(this.master);
        this.engine.start();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
          data = buffer.getChannelData(0);
        let pink = 0;
        for (let i = 0; i < data.length; i++) {
          pink = 0.97 * pink + 0.03 * (Math.random() * 2 - 1);
          data[i] = pink * 5;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        this.filter = ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 1300;
        this.water = ctx.createGain();
        this.water.gain.value = 0;
        noise.connect(this.filter).connect(this.water).connect(this.master);
        noise.start();
      }
      await this.context.resume();
    } catch {
      /* Audio support must never block a race. */
    }
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        value ? 0.22 : 0,
        this.context.currentTime,
        0.06
      );
  }
  update(speed: number, throttle: boolean, boost: boolean, active: boolean) {
    if (
      !this.context ||
      !this.engine ||
      !this.engineGain ||
      !this.water ||
      !this.filter
    )
      return;
    const t = this.context.currentTime;
    this.engine.frequency.setTargetAtTime(
      42 + speed * 3.8 + (throttle ? 15 : 0) + (boost ? 22 : 0),
      t,
      0.08
    );
    this.engineGain.gain.setTargetAtTime(
      active ? 0.22 + (throttle ? 0.16 : 0) : 0,
      t,
      0.12
    );
    this.water.gain.setTargetAtTime(
      active ? Math.min(0.8, speed / 45) : 0,
      t,
      0.12
    );
    this.filter.frequency.setTargetAtTime(800 + speed * 85, t, 0.12);
  }
  cue(kind: 'gate' | 'splash' | 'count' | 'finish') {
    if (!this.context || !this.master || !this.enabled) return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain(),
      t = c.currentTime;
    o.type = kind === 'splash' ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(
      kind === 'splash'
        ? 130
        : kind === 'finish'
          ? 880
          : kind === 'gate'
            ? 660
            : 440,
      t
    );
    o.frequency.exponentialRampToValueAtTime(
      kind === 'splash' ? 35 : kind === 'finish' ? 1320 : 880,
      t + 0.18
    );
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(t + 0.34);
  }
  close() {
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
