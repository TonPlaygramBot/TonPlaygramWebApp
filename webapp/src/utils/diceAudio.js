import { getGameVolume } from './sound.js'

export const DICE_SFX_PRESETS = Object.freeze([
  { id: 'classic-wood', label: 'Classic Wood' },
  { id: 'marble-rattle', label: 'Marble Rattle' },
  { id: 'metallic-clack', label: 'Metallic Clack' },
  { id: 'soft-felt', label: 'Soft Felt' },
  { id: 'arcade-pop', label: 'Arcade Pop' }
])

let sharedCtx = null

function getAudioCtx () {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!sharedCtx) sharedCtx = new Ctx()
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {})
  }
  return sharedCtx
}

function tick (ctx, time, frequency, duration, type = 'square', gain = 0.18) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, time)
  amp.gain.setValueAtTime(0.0001, time)
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), time + 0.004)
  amp.gain.exponentialRampToValueAtTime(0.0001, time + duration)
  osc.connect(amp)
  amp.connect(ctx.destination)
  osc.start(time)
  osc.stop(time + duration + 0.01)
}

function noiseBurst (ctx, time, duration = 0.035, gain = 0.1, highpass = 450) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let i = 0; i < channel.length; i += 1) channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length)

  const src = ctx.createBufferSource()
  src.buffer = buffer
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = highpass
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(gain, time)
  amp.gain.exponentialRampToValueAtTime(0.0001, time + duration)
  src.connect(hp)
  hp.connect(amp)
  amp.connect(ctx.destination)
  src.start(time)
}

function playPreset (ctx, presetId, volume) {
  const now = ctx.currentTime + 0.01
  const v = Math.max(0.02, Math.min(1, volume))
  switch (presetId) {
    case 'marble-rattle':
      tick(ctx, now, 680, 0.045, 'triangle', 0.14 * v)
      tick(ctx, now + 0.035, 740, 0.05, 'triangle', 0.12 * v)
      noiseBurst(ctx, now + 0.01, 0.03, 0.06 * v, 700)
      break
    case 'metallic-clack':
      tick(ctx, now, 920, 0.035, 'sawtooth', 0.1 * v)
      tick(ctx, now + 0.022, 480, 0.06, 'square', 0.08 * v)
      noiseBurst(ctx, now, 0.025, 0.05 * v, 1200)
      break
    case 'soft-felt':
      tick(ctx, now, 320, 0.08, 'sine', 0.12 * v)
      tick(ctx, now + 0.028, 260, 0.09, 'sine', 0.1 * v)
      noiseBurst(ctx, now + 0.014, 0.035, 0.03 * v, 300)
      break
    case 'arcade-pop':
      tick(ctx, now, 540, 0.03, 'square', 0.12 * v)
      tick(ctx, now + 0.04, 820, 0.025, 'triangle', 0.1 * v)
      tick(ctx, now + 0.07, 620, 0.02, 'square', 0.08 * v)
      break
    case 'classic-wood':
    default:
      tick(ctx, now, 430, 0.055, 'triangle', 0.14 * v)
      tick(ctx, now + 0.03, 360, 0.05, 'triangle', 0.1 * v)
      noiseBurst(ctx, now + 0.008, 0.028, 0.05 * v, 520)
      break
  }
}

export function createDiceRollAudio ({ muted = false, presetId = 'classic-wood' } = {}) {
  return {
    muted,
    volume: getGameVolume(),
    currentTime: 0,
    pause () {},
    play () {
      if (this.muted) return Promise.resolve()
      const ctx = getAudioCtx()
      if (!ctx) return Promise.resolve()
      playPreset(ctx, presetId, this.volume)
      return Promise.resolve()
    }
  }
}
