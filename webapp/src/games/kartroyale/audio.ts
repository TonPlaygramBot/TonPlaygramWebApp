export class KartAudio {
  private engine: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  muted = true;
  unlock() {
    if (!this.engine) {
      this.engine = new Audio('/assets/sounds/race-care-151963.mp3');
      this.engine.loop = true;
      this.engine.volume = 0.18;
    }
    if (!this.context)
      try {
        this.context = new AudioContext();
      } catch {}
    this.context?.resume().catch(() => {});
    if (!this.muted) this.engine.play().catch(() => {});
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.engine) {
      this.engine.muted = m;
      if (m) this.engine.pause();
      else this.unlock();
    }
  }
  update(speed: number, active: boolean) {
    if (!this.engine) return;
    this.engine.playbackRate = 0.65 + speed / 36;
    this.engine.volume = active && !this.muted ? 0.08 + speed / 320 : 0;
  }
  beep(f = 550, d = 0.13) {
    if (this.muted || !this.context) return;
    const o = this.context.createOscillator(),
      g = this.context.createGain(),
      now = this.context.currentTime;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + d);
    o.connect(g);
    g.connect(this.context.destination);
    o.start();
    o.stop(now + d);
  }
  destroy() {
    this.engine?.pause();
    if (this.engine) this.engine.src = '';
    this.context?.close().catch(() => {});
  }
}
