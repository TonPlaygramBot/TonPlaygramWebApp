/** Short synthesized paddle, table, net and crowd sounds; no downloads. */
export class TableTennisAudio {
  ctx: AudioContext | null = null;
  enabled = true;
  unlock() {
    if (!this.ctx) {
      const C =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (C) this.ctx = new C();
    }
    void this.ctx?.resume();
  }
  play(type: string) {
    const c = this.ctx;
    if (!c || !this.enabled || c.state !== 'running') return;
    const t = c.currentTime,
      g = c.createGain();
    g.connect(c.destination);
    if (type === 'hit' || type === 'bounce' || type === 'serve') {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(
        type === 'hit' ? 1050 : type === 'bounce' ? 660 : 420,
        t
      );
      o.frequency.exponentialRampToValueAtTime(180, t + 0.05);
      g.gain.setValueAtTime(type === 'hit' ? 0.13 : 0.075, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.09);
    } else if (type === 'point' || type === 'win') {
      for (let n = 0; n < 3; n++) {
        const o = c.createOscillator(),
          v = c.createGain();
        o.frequency.value = [440, 554, 659][n];
        v.gain.setValueAtTime(0.001, t);
        v.gain.setValueAtTime(0.06, t + n * 0.09);
        v.gain.exponentialRampToValueAtTime(0.001, t + n * 0.09 + 0.25);
        o.connect(v);
        v.connect(c.destination);
        o.start(t + n * 0.09);
        o.stop(t + n * 0.09 + 0.3);
      }
      const b = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate),
        d = b.getChannelData(0);
      for (let n = 0; n < d.length; n++)
        d[n] = (Math.random() * 2 - 1) * 0.025 * (1 - n / d.length);
      const s = c.createBufferSource();
      s.buffer = b;
      s.connect(g);
      g.gain.value = 0.6;
      s.start();
    }
  }
  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
