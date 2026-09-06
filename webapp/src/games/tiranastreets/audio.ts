export class CityAudio {
  private context: AudioContext | null = null;
  private engine: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  enabled = true;
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
    }
    if (this.context.state === "suspended") await this.context.resume();
  }
  update(speed: number, inCar: boolean) {
    if (!this.context || !this.gain || !this.engine) return;
    const t = this.context.currentTime;
    this.engine.frequency.setTargetAtTime(28 + Math.abs(speed) * 3, t, 0.1);
    this.gain.gain.setTargetAtTime(
      this.enabled && inCar ? 0.018 + Math.abs(speed) * 0.0008 : 0,
      t,
      0.1,
    );
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
    g.gain.setValueAtTime(0.07, c.currentTime);
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
