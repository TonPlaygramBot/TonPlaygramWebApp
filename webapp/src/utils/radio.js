const player = new Audio();
player.preload = 'none';
player.loop = true;

export const stations = [
  { name: 'Capital FM (London)', url: 'https://media-ssl.musicradio.com/CapitalMP3' },
  { name: 'FIP Radio (Paris)', url: 'https://icecast.radiofrance.fr/fip-hifi.aac' },
  { name: 'WNYC-FM (New York)', url: 'https://fm939.wnyc.org/wnycfm.aac' },
  { name: 'LISTEN.moe KPOP', url: 'https://listen.moe/kpop/stream' },
  { name: 'NPO Radio 1 (Netherlands)', url: 'http://icecast.omroep.nl/radio1-bb-mp3' },
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
