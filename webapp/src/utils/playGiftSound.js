import { giftSounds } from './giftSounds.js';
import { bombSound } from '../assets/soundData.js';
import { getGameVolume } from './sound.js';

export default function playGiftSound(id) {
  const sound = giftSounds[id];
  if (!sound) return;
  if (id === 'laugh_bomb') {
    const bomb = new Audio(bombSound);
    const haha = new Audio(sound);
    bomb.volume = haha.volume = getGameVolume();
    bomb.play().catch(() => {});
    haha.play().catch(() => {});
    setTimeout(() => {
      bomb.pause();
      haha.pause();
    }, 5000);
  } else {
    const audio = new Audio(sound);
    audio.volume = getGameVolume();
    if (id === 'coffee_boost') {
      audio.currentTime = 4;
      audio.play().catch(() => {});
      setTimeout(() => audio.pause(), 4000);
    } else if (id === 'fireworks') {
      audio.play().catch(() => {});
      setTimeout(() => audio.pause(), 5000);
    } else {
      audio.play().catch(() => {});
    }
  }
}
