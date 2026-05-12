export class AudioVFXManager {
  private sounds = new Map<string, HTMLAudioElement>();
  add(name: string, url: string, volume = 0.5) { const audio = new Audio(url); audio.volume = volume; this.sounds.set(name, audio); return audio; }
  play(name: string) { const audio = this.sounds.get(name); if (!audio) return; audio.currentTime = 0; void audio.play().catch(() => {}); }
}
