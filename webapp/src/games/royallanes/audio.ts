type RollVoice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
  filter: BiquadFilterNode;
};
/** Gesture-unlocked audio graph. Reused noise/room buffers, bounded rolling voices. */
export class BowlingAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private room: ConvolverNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Map<string, RollVoice>();
  private lastImpact = new Map<string, number>();
  private paused = false;
  enabled = true;
  unlock() {
    if (!this.enabled || this.paused) return;
    try {
      if (!this.context) {
        const ctx = (this.context = new AudioContext());
        this.master = ctx.createGain();
        this.master.gain.value = 0.75;
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.ratio.value = 5;
        this.master.connect(limiter).connect(ctx.destination);
        this.noise = ctx.createBuffer(
          1,
          Math.floor(ctx.sampleRate * 0.5),
          ctx.sampleRate
        );
        const data = this.noise.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < data.length; i++) {
          brown = (brown + Math.random() * 0.16 - 0.08) * 0.97;
          data[i] = brown;
        }
        this.room = ctx.createConvolver();
        const impulse = ctx.createBuffer(
          2,
          Math.floor(ctx.sampleRate * 0.55),
          ctx.sampleRate
        );
        for (let c = 0; c < 2; c++) {
          const a = impulse.getChannelData(c);
          for (let i = 0; i < a.length; i++)
            a[i] =
              (Math.random() * 2 - 1) * Math.exp((-i / a.length) * 9) * 0.11;
        }
        this.room.buffer = impulse;
        const wet = ctx.createGain();
        wet.gain.value = 0.16;
        this.room.connect(wet).connect(this.master);
      }
      void this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional, including on restricted mobile webviews. */
    }
  }
  private transient(
    kind: 'pin' | 'release' | 'step' | 'sweep',
    strength: number,
    pan: number,
    channel: string
  ) {
    const ctx = this.context;
    if (
      !this.enabled ||
      this.paused ||
      !ctx ||
      ctx.state !== 'running' ||
      !this.master ||
      !this.noise
    )
      return;
    const now = ctx.currentTime,
      key = `${channel}:${kind}`;
    if (now - (this.lastImpact.get(key) ?? -1) < 0.045) return;
    this.lastImpact.set(key, now);
    const duration = kind === 'sweep' ? 0.55 : kind === 'pin' ? 0.24 : 0.12;
    const gain = ctx.createGain(),
      panner = ctx.createStereoPanner(),
      filter = ctx.createBiquadFilter();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    const volume =
      Math.max(0.001, Math.min(1, strength)) * (kind === 'pin' ? 0.55 : 0.22);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(panner).connect(this.master);
    if (this.room) panner.connect(this.room);
    filter.type = kind === 'pin' ? 'bandpass' : 'lowpass';
    filter.frequency.value =
      kind === 'pin' ? 1300 + Math.random() * 900 : kind === 'step' ? 480 : 760;
    filter.Q.value = 0.7;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.connect(filter).connect(gain);
    source.start(now);
    source.stop(now + duration);
    if (kind !== 'sweep')
      for (const frequency of kind === 'pin' ? [310, 570, 910] : [95, 170]) {
        const osc = ctx.createOscillator(),
          body = ctx.createGain();
        osc.frequency.setValueAtTime(
          frequency * (0.96 + Math.random() * 0.08),
          now
        );
        body.gain.setValueAtTime(volume * 0.22, now);
        body.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.75);
        osc.connect(body).connect(panner);
        osc.start(now);
        osc.stop(now + duration);
        osc.onended = () => {
          osc.disconnect();
          body.disconnect();
        };
      }
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
  }
  impact(strength = 1, pan = 0, channel = 'main') {
    this.transient('pin', strength, pan, channel);
  }
  release(pan = 0, strength = 1, channel = 'main') {
    this.transient('release', strength, pan, channel);
  }
  step(pan = 0, strength = 0.4, channel = 'main') {
    this.transient('step', strength, pan, channel);
  }
  sweep(pan = 0, strength = 0.4, channel = 'main') {
    this.transient('sweep', strength, pan, channel);
  }
  rolling(
    channel: string,
    speed: number,
    distance: number,
    pan: number,
    active: boolean
  ) {
    const ctx = this.context;
    if (!active || !this.enabled || this.paused) {
      this.stopRolling(channel);
      return;
    }
    if (!ctx || ctx.state !== 'running' || !this.noise || !this.master) return;
    let voice = this.voices.get(channel);
    if (!voice) {
      if (this.voices.size >= 3) return;
      const source = ctx.createBufferSource(),
        gain = ctx.createGain(),
        panner = ctx.createStereoPanner(),
        filter = ctx.createBiquadFilter();
      source.buffer = this.noise;
      source.loop = true;
      filter.type = 'lowpass';
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(panner).connect(this.master);
      source.start();
      voice = { source, gain, pan: panner, filter };
      this.voices.set(channel, voice);
    }
    voice.gain.gain.setTargetAtTime(
      Math.min(0.55, speed / 22) / (1 + distance * 0.07),
      ctx.currentTime,
      0.06
    );
    voice.filter.frequency.setTargetAtTime(
      280 + speed * 70,
      ctx.currentTime,
      0.06
    );
    voice.source.playbackRate.setTargetAtTime(
      0.6 + speed / 13,
      ctx.currentTime,
      0.06
    );
    voice.pan.pan.setTargetAtTime(
      Math.max(-1, Math.min(1, pan)),
      ctx.currentTime,
      0.06
    );
  }
  private stopRolling(channel: string) {
    const voice = this.voices.get(channel);
    if (!voice) return;
    voice.source.stop();
    voice.source.disconnect();
    voice.filter.disconnect();
    voice.gain.disconnect();
    voice.pan.disconnect();
    this.voices.delete(channel);
  }
  setPaused(value: boolean) {
    this.paused = value;
    if (value) {
      for (const key of this.voices.keys()) this.stopRolling(key);
      void this.context?.suspend().catch(() => {});
    } else if (this.enabled && this.context) this.unlock();
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    this.setPaused(this.paused);
    if (!value) {
      for (const key of this.voices.keys()) this.stopRolling(key);
      void this.context?.suspend().catch(() => {});
    } else if (this.context) this.unlock();
  }
  dispose() {
    for (const key of this.voices.keys()) this.stopRolling(key);
    void this.context?.close().catch(() => {});
    this.context = null;
    this.noise = null;
    this.room = null;
    this.master = null;
    this.lastImpact.clear();
  }
}
