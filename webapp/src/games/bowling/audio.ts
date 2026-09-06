export function bowlingAudio() {
  let context: AudioContext | null = null,
    enabled = true;
  function tone(
    hz: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine'
  ) {
    if (!enabled || !context || context.state !== 'running') return;
    const o = context.createOscillator(),
      g = context.createGain(),
      t = context.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(hz, t);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(30, hz * 0.55),
      t + duration
    );
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(context.destination);
    o.start(t);
    o.stop(t + duration);
  }
  return {
    unlock() {
      if (!context) context = new AudioContext();
      void context.resume().catch(() => {});
    },
    setEnabled(value: boolean) {
      enabled = value;
    },
    roll() {
      tone(95, 0.35, 0.1, 'triangle');
    },
    pins(count: number) {
      tone(500, Math.min(0.7, 0.15 + count * 0.05), 0.12, 'triangle');
    },
    celebrate() {
      tone(880, 0.35, 0.1);
      setTimeout(() => tone(1174, 0.4, 0.1), 140);
      setTimeout(() => tone(1568, 0.55, 0.1), 280);
    },
    dispose() {
      if (context) void context.close();
      context = null;
    }
  };
}
