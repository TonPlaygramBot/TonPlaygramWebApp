const players = new Map<HTMLVideoElement, () => void>();

// Feed cards and the fullscreen viewer share this registry. Invalidate pending
// quality-switch resumes as well as pausing the media element itself.
export function registerWallVideo(
  video: HTMLVideoElement,
  interrupt: () => void
) {
  players.set(video, interrupt);
  const play = () => {
    for (const [other, stopResume] of players) {
      if (other === video) continue;
      stopResume();
      other.pause();
    }
  };
  video.addEventListener('play', play);
  return () => {
    video.removeEventListener('play', play);
    players.delete(video);
    if (!video.paused) video.pause();
  };
}
