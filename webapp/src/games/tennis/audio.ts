import { assets } from './assets';
import { decode } from './render';
import type { Event } from './engine';
export class TennisAudio {
  ctx: AudioContext | null = null;
  gain: GainNode | null = null;
  buffers: Record<string, AudioBuffer> = {};
  enabled = true;
  lastEvent = 0;
  async unlock() {
    if (!this.ctx) {
      const C =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.5;
      this.gain.connect(this.ctx.destination);
      for (const name of ['hit', 'bounce', 'step'] as const) {
        try {
          this.buffers[name] = await this.ctx.decodeAudioData(
            decode(assets[name]).buffer
          );
        } catch {}
      }
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }
  tone(freq: number, duration: number, at = 0, volume = 0.08) {
    if (!this.ctx || !this.gain || !this.enabled) return;
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain(),
      t = c.currentTime + at;
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(this.gain);
    o.start(t);
    o.stop(t + duration);
  }
  sample(name: string, rate = 1) {
    if (!this.ctx || !this.gain || !this.enabled) return;
    const b = this.buffers[name];
    if (!b) {
      this.tone(name === 'hit' ? 260 : 140, 0.07);
      return;
    }
    const node = this.ctx.createBufferSource();
    node.buffer = b;
    node.playbackRate.value = rate;
    node.connect(this.gain);
    node.start();
  }
  crowd() {
    if (!this.ctx || !this.gain || !this.enabled) return;
    const c = this.ctx,
      n = c.createBuffer(1, c.sampleRate * 0.8, c.sampleRate),
      d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2) * 0.055;
    const src = c.createBufferSource(),
      filter = c.createBiquadFilter();
    src.buffer = n;
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    src.connect(filter);
    filter.connect(this.gain);
    src.start();
  }
  events(events: Event[]) {
    for (const e of events) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      if (e.type === 'hit' || e.type === 'serve')
        this.sample('hit', e.type === 'serve' ? 1.3 : 1);
      if (e.type === 'bounce') this.sample('bounce', 1.3);
      if (e.type === 'fault') this.tone(180, 0.12);
      if (e.type === 'point') {
        this.crowd();
        this.tone(e.seat === 0 ? 660 : 330, 0.12);
      }
      if (e.type === 'win') {
        this.crowd();
        [523, 659, 784, 1046].forEach((n, i) =>
          this.tone(n, 0.3, i * 0.14, 0.1)
        );
      }
    }
  }
  dispose() {
    this.ctx?.close().catch(() => {});
  }
}
