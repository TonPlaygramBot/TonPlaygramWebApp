export class BowlingAudio {
  private context: AudioContext | null = null;
  enabled = true;
  private lastImpact = 0;
  unlock() {
    if (!this.enabled) return;
    this.context ??= new AudioContext();
    void this.context.resume().catch(() => {});
  }
  impact(strength = 1) {
    if (!this.enabled || !this.context || this.context.state !== 'running')
      return;
    const now = this.context.currentTime;
    if (now - this.lastImpact < 0.06) return;
    this.lastImpact = now;
    const length = 0.18;
    const buffer = this.context.createBuffer(
      1,
      this.context.sampleRate * length,
      this.context.sampleRate
    );
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++)
      channel[i] =
        (Math.random() * 2 - 1) * Math.exp((-i / channel.length) * 8);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 820 + Math.random() * 900;
    filter.Q.value = 0.9;
    const gain = this.context.createGain();
    gain.gain.value = 0.34 * strength;
    source.connect(filter).connect(gain).connect(this.context.destination);
    source.start();
    const osc = this.context.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.11);
    const body = this.context.createGain();
    body.gain.setValueAtTime(0.22 * strength, now);
    body.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(body).connect(this.context.destination);
    osc.start();
    osc.stop(now + 0.16);
  }
  roll() {
    if (!this.enabled || !this.context) return;
    const ctx = this.context;
    const seconds = 2.4;
    const buffer = ctx.createBuffer(
      1,
      ctx.sampleRate * seconds,
      ctx.sampleRate
    );
    const c = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < c.length; i++) {
      last = (last + Math.random() * 0.2 - 0.1) * 0.94;
      c[i] = last;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    source.connect(gain).connect(ctx.destination);
    source.start();
  }
  celebrate() {
    if (!this.enabled || !this.context) return;
    [440, 554.37, 659.25].forEach((f, i) => {
      const t = this.context!.currentTime + i * 0.1;
      const o = this.context!.createOscillator();
      const g = this.context!.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(g).connect(this.context!.destination);
      o.start(t);
      o.stop(t + 0.5);
    });
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    if (!value) void this.context?.suspend();
    else this.unlock();
  }
  dispose() {
    void this.context?.close();
    this.context = null;
  }
}
