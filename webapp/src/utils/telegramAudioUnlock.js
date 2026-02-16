export function isTelegramWebView() {
  return typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp);
}

let unlocked = false;

export async function unlockTelegramAudio() {
  if (unlocked) return true;
  if (typeof window === 'undefined') return false;

  // Unlock WebAudio
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    try {
      const ctx = new AudioContextClass();
      await ctx.resume?.();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
      src.stop?.(0);
      unlocked = true;
      return true;
    } catch {
      // ignore
    }
  }

  // Fallback: HTMLAudio element
  try {
    const audio = new Audio();
    audio.muted = true;
    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
    await audio.play();
    audio.pause();
    unlocked = true;
    return true;
  } catch {
    return false;
  }
}
