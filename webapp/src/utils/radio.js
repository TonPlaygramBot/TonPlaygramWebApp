const player = new Audio();
player.preload = 'none';
player.loop = true;

export const stations = [
  { name: 'Capital FM (London)', url: 'https://media-ssl.musicradio.com/CapitalMP3' },
  { name: 'Paris Jazz Café', url: 'https://radiospinner.com/radio/paris-jazz-cafe/stream' },
  { name: '103.5 KTU (New York)', url: 'https://n12a-e2.revma.ihrhls.com/zc2743' },
  { name: 'J1 Radio (Tokyo)', url: 'https://j1.stream/hi.mp3' },
  { name: 'Top Albania Radio', url: 'https://live.topalbaniaradio.com:8000/live.mp3' },
];

let current = '';

export function play(url) {
  if (url && player.src !== url) {
    player.src = url;
    current = url;
  }
  player.play().catch(() => {});
}

export function pause() {
  player.pause();
}

export function stop() {
  player.pause();
  player.currentTime = 0;
}

export function getCurrent() {
  return current;
}

export function setVolume(v) {
  player.volume = v;
}

export function getVolume() {
  return player.volume;
}

export default player;
