import { getGameVolume, isGameMuted } from './sound.js';
let context;
// Original short chimes, synthesized locally: no audio download or third-party samples.
export function prepareGiftAudio() {
  if (isGameMuted()) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context ||= new AudioContext();
    if (context.state === 'suspended') context.resume().catch(() => {});
  } catch { /* Audio must never block checkout. */ }
}
export function playGiftChime(tier = 1) {
  if (isGameMuted() || !context || context.state !== 'running') return;
  try {
    const start = context.currentTime;
    const notes = tier === 3 ? [523.25, 659.25, 783.99, 1046.5] : tier === 2 ? [523.25, 659.25, 783.99] : [659.25, 783.99];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator(), gain = context.createGain();
      const at = start + index * .075;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(getGameVolume() * .08, at + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, at + .3);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(at); oscillator.stop(at + .32);
    });
  } catch { /* Confirmation remains valid even without sound. */ }
}
