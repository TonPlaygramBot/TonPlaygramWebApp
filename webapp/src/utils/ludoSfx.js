let sharedCtx = null;
const LUDO_DICE_ROLL_SOUND_URL = '/assets/sounds/u_qpfzpydtro-dice-142528.mp3';
let ludoDiceRollAudio = null;

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
  if (typeof Audio === 'undefined') return;
  if (!ludoDiceRollAudio) {
    ludoDiceRollAudio = new Audio(LUDO_DICE_ROLL_SOUND_URL);
    ludoDiceRollAudio.preload = 'auto';
  }
  ludoDiceRollAudio.volume = 1;
  ludoDiceRollAudio.currentTime = 0;
  ludoDiceRollAudio.play().catch(() => {});
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
