import { SceneSound } from '../tiranastreets/SceneSound';
/** Battlefield shares the bounded, pause-safe city sound bus. */
export class GameAudio {
  readonly sound = new SceneSound();
  volume = .55;
  start() { this.sound.setVolume(this.volume); void this.sound.unlock().catch(() => {}); }
  setVolume(v: number) { this.volume = v; this.sound.setVolume(v); }
  burst(duration: number, frequency: number, volume: number, type: BiquadFilterType = 'lowpass') { this.sound.burst(duration, frequency, volume, type); }
  tone(frequency: number, duration: number, volume: number, end = frequency) { this.sound.tone(frequency, duration, volume, end); }
  shot() { this.sound.event('shot'); }
  hit() { this.sound.event('hit'); }
  kill() { this.tone(750, .09, .18, 1200); }
  step() { this.sound.event('step'); }
  reload() { this.sound.event('reload'); }
  hurt() { this.burst(.18, 330, .4); this.tone(70, .2, .25, 38); }
  victory() { this.tone(440, .45, .17, 660); this.tone(660, .7, .12, 880); }
  suspend() { this.sound.suspend(); }
  dispose() { this.sound.dispose(); }
}
