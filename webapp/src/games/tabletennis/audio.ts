/** Responsive synthesized foley. No streamed music or audio asset downloads. */
export class TableTennisAudio {
  ctx: AudioContext | null = null;
  enabled = true;
  private noise: AudioBuffer | null = null;
  unlock() {
    if (!this.ctx) {
      const C =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (C) this.ctx = new C();
    }
    void this.ctx?.resume().catch(() => {});
  }
  play(type: string, intensity = 0.5, pan = 0) {
    const c = this.ctx;
    if (!c || !this.enabled || c.state !== 'running') return;
    if (
      !['hit', 'bounce', 'serve', 'net', 'point', 'win', 'swish'].includes(type)
    )
      return;
    const t = c.currentTime;
    const volume = c.createGain();
    const stereo = c.createStereoPanner();
    stereo.pan.value = Math.max(-0.8, Math.min(0.8, pan));
    volume.connect(stereo);
    stereo.connect(c.destination);
    const power = Math.max(0.1, Math.min(1, intensity));
    const duration =
      type === 'win'
        ? 0.8
        : type === 'point'
          ? 0.45
          : type === 'net'
            ? 0.16
            : 0.1;
    volume.gain.setValueAtTime(
      (type === 'hit' ? 0.15 : 0.09) * (0.5 + power * 0.5),
      t
    );
    volume.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const oscillator = c.createOscillator();
    oscillator.type = type === 'net' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(
      type === 'hit'
        ? 1100 + power * 300
        : type === 'bounce'
          ? 750
          : type === 'net'
            ? 140
            : 440,
      t
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      type === 'point' || type === 'win' ? 880 : 110,
      t + duration
    );
    oscillator.connect(volume);
    if (type !== 'swish') {
      oscillator.start(t);
      oscillator.stop(t + duration);
    }
    if (!this.noise) {
      this.noise = c.createBuffer(
        1,
        Math.ceil(c.sampleRate * 0.8),
        c.sampleRate
      );
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const noise = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    noise.buffer = this.noise;
    filter.type = 'bandpass';
    filter.frequency.value =
      type === 'swish' ? 1800 : type === 'net' ? 350 : 2500;
    filter.Q.value = 0.8;
    gain.gain.value =
      type === 'swish' ? 0.7 : type === 'point' || type === 'win' ? 0.9 : 0.3;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(volume);
    noise.start(t);
    noise.stop(t + duration);
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      gain.disconnect();
      oscillator.disconnect();
      volume.disconnect();
      stereo.disconnect();
    };
  }
  dispose() {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.noise = null;
  }
}
