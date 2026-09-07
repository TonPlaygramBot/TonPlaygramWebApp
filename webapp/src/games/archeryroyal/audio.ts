export class ArcheryAudio {
  private context: AudioContext | null = null;
  private muted = false;

  unlock() {
    this.context ||= new AudioContext();
    void this.context.resume();
  }

  setMuted(value: boolean) { this.muted = value; }

  shot(score = 0) {
    if (this.muted) return;
    this.unlock();
    const context = this.context!;
    const now = context.currentTime;
    const string = context.createOscillator();
    const gain = context.createGain();
    string.type = 'triangle';
    string.frequency.setValueAtTime(170, now);
    string.frequency.exponentialRampToValueAtTime(65, now + .18);
    gain.gain.setValueAtTime(.16, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + .22);
    string.connect(gain).connect(context.destination);
    string.start(now);
    string.stop(now + .23);
    const impact = context.createOscillator();
    const impactGain = context.createGain();
    impact.type = 'sine';
    impact.frequency.value = 80 + score * 7;
    impactGain.gain.setValueAtTime(.001, now);
    impactGain.gain.setValueAtTime(.19, now + .72);
    impactGain.gain.exponentialRampToValueAtTime(.001, now + .9);
    impact.connect(impactGain).connect(context.destination);
    impact.start(now + .72);
    impact.stop(now + .92);
  }

  fanfare() {
    if (this.muted) return;
    this.unlock();
    [523, 659, 784].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const at = this.context!.currentTime + index * .12;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.001, at);
      gain.gain.linearRampToValueAtTime(.09, at + .02);
      gain.gain.exponentialRampToValueAtTime(.001, at + .3);
      oscillator.connect(gain).connect(this.context!.destination);
      oscillator.start(at);
      oscillator.stop(at + .32);
    });
  }

  destroy() { void this.context?.close(); this.context = null; }
}
