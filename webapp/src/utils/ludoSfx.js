// Lightweight procedural SFX inspired by open-source Web Audio patterns (MIT-style oscillator envelopes).
let sharedCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new Ctx();
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

function scheduleTone(ctx, { startAt, duration, fromHz, toHz, volume = 0.4, type = 'triangle' }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fromHz, startAt);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, toHz), startAt + duration);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startAt + Math.min(0.04, duration * 0.45));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function scheduleNoiseBurst(ctx, { startAt, duration, volume = 0.2, bandHz = 1800 }) {
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleCount;
    const contour = 0.45 + 0.55 * Math.sin(Math.PI * t);
    data[i] = (Math.random() * 2 - 1) * contour;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(Math.max(300, bandHz), startAt);
  filter.Q.setValueAtTime(1.2, startAt);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startAt + Math.min(0.03, duration * 0.4));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(startAt);
  source.stop(startAt + duration + 0.01);
}

function scheduleRumble(ctx, { startAt, duration, volume = 0.12, fromHz = 120, toHz = 70 }) {
  scheduleTone(ctx, {
    startAt,
    duration,
    fromHz,
    toHz,
    volume,
    type: 'sawtooth'
  });
}

export function playLudoDiceRollSfx({ volume = 1, muted = false } = {}) {
  if (muted || volume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.004;
  const baseVolume = Math.min(0.58, Math.max(0.2, volume * 0.46));

  // Procedural, source-code-only dice roll SFX (no binary assets), shaped from free Web Audio synthesis patterns.
  scheduleRumble(ctx, {
    startAt: now,
    duration: 0.28,
    volume: baseVolume * 0.3,
    fromHz: 132,
    toHz: 74
  });

  scheduleNoiseBurst(ctx, {
    startAt: now,
    duration: 0.24,
    volume: baseVolume * 0.85,
    bandHz: 1580
  });

  scheduleNoiseBurst(ctx, {
    startAt: now + 0.085,
    duration: 0.18,
    volume: baseVolume * 0.52,
    bandHz: 1120
  });

  const impacts = [0.02, 0.055, 0.09, 0.125, 0.165, 0.205, 0.235];
  impacts.forEach((offset, index) => {
    const decay = Math.max(0.18, 1 - index * 0.11);
    const impactVolume = baseVolume * (0.78 + Math.random() * 0.28) * decay;
    const impactStart = now + offset + (Math.random() - 0.5) * 0.01;
    scheduleTone(ctx, {
      startAt: impactStart,
      duration: 0.038 + Math.random() * 0.026,
      fromHz: 490 - index * 41 + Math.random() * 24,
      toHz: 130 + Math.random() * 46,
      volume: impactVolume,
      type: index % 2 === 0 ? 'triangle' : 'sine'
    });
  });

  scheduleTone(ctx, {
    startAt: now + 0.22,
    duration: 0.14,
    fromHz: 180,
    toHz: 86,
    volume: baseVolume * 0.52,
    type: 'triangle'
  });
}

export function playLudoTokenStepSfx({ volume = 1, muted = false } = {}) {
  if (muted || volume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.004;
  const v = Math.min(0.35, Math.max(0.06, volume * 0.22));
  scheduleTone(ctx, { startAt: now, duration: 0.065, fromHz: 180, toHz: 120, volume: v, type: 'triangle' });
  scheduleTone(ctx, { startAt: now + 0.024, duration: 0.055, fromHz: 240, toHz: 170, volume: v * 0.8, type: 'sine' });
}
