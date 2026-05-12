export class AudioVFXManager {
  safePlay(audio: HTMLAudioElement) { void audio.play().catch(() => undefined); }
}
