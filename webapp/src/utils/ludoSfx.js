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

export function playLudoDiceRollSfx({ volume = 1, muted = false } = {}) {
  if (muted || volume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.005;
  const v = Math.min(0.4, Math.max(0.08, volume * 0.3));
  scheduleTone(ctx, { startAt: now, duration: 0.08, fromHz: 420, toHz: 260, volume: v, type: 'square' });
  scheduleTone(ctx, { startAt: now + 0.06, duration: 0.09, fromHz: 390, toHz: 210, volume: v * 0.9, type: 'square' });
  scheduleTone(ctx, { startAt: now + 0.12, duration: 0.12, fromHz: 300, toHz: 140, volume: v * 0.85, type: 'triangle' });
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
