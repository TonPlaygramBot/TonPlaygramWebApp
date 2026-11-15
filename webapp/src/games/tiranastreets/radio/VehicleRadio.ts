import { ALBANIAN_STATIONS } from './stations';

export type RadioStatus = 'off' | 'paused' | 'connecting' | 'playing' | 'blocked' | 'unavailable';
export type RadioSnapshot = { station: string; enabled: boolean; volume: number; status: RadioStatus };
const KEY = 'tirana-streets:vehicle-radio:v1';

/** One owner for one live stream. play() stays inside the user's gesture; stale
 * promises/events cannot restart a station after exit, pause or a quick switch. */
export class VehicleRadio {
  private audio?: HTMLAudioElement;
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private active = false;
  private dead = false;
  private master = 1;
  private state: RadioSnapshot = { station: ALBANIAN_STATIONS[0].id, enabled: false, volume: .45, status: 'off' };
  constructor(private storage?: Pick<Storage, 'getItem' | 'setItem'>, private makeAudio = () => new Audio()) {
    try {
      const saved = JSON.parse(storage?.getItem(KEY) || '{}');
      if (ALBANIAN_STATIONS.some(s => s.id === saved.station)) this.state.station = saved.station;
      if (Number.isFinite(saved.volume)) this.state.volume = Math.max(0, Math.min(1, saved.volume));
      // Fresh sessions require a tap; preferences never bypass mobile autoplay.
    } catch { /* Private storage is optional. */ }
  }
  snapshot(): RadioSnapshot { return { ...this.state }; }
  private save() {
    try { this.storage?.setItem(KEY, JSON.stringify({ station: this.state.station, volume: this.state.volume })); } catch {}
  }
  setVolume(volume: number) {
    if (!Number.isFinite(volume)) return;
    this.state.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) this.audio.volume = this.state.volume * this.master;
    this.save();
  }
  setContext(active: boolean, master = 1) {
    if (this.dead) return;
    this.master = Number.isFinite(master) ? Math.max(0, Math.min(1, master)) : 1;
    if (this.audio) this.audio.volume = this.state.volume * this.master;
    if (this.active === active) return;
    this.active = active;
    if (!active) { this.stop(); this.state.status = this.state.enabled ? 'paused' : 'off'; }
    else if (this.state.enabled) this.play();
  }
  select(id: string) {
    if (this.dead || !ALBANIAN_STATIONS.some(s => s.id === id)) return;
    this.state.station = id; this.state.enabled = true; this.save(); this.play();
  }
  next(direction = 1) {
    const index = ALBANIAN_STATIONS.findIndex(s => s.id === this.state.station);
    this.select(ALBANIAN_STATIONS[(index + (direction < 0 ? -1 : 1) + ALBANIAN_STATIONS.length) % ALBANIAN_STATIONS.length].id);
  }
  toggle() {
    if (this.dead) return;
    // A blocked/error stream's primary button retries, rather than silently muting.
    if (this.state.enabled && !['blocked', 'unavailable', 'paused'].includes(this.state.status)) {
      this.state.enabled = false; this.stop(); this.state.status = 'off';
    } else { this.state.enabled = true; this.play(); }
  }
  private stop() {
    this.generation++; clearTimeout(this.timer); this.timer = undefined;
    const audio = this.audio; this.audio = undefined;
    if (!audio) return;
    audio.onplaying = audio.onwaiting = audio.onstalled = audio.onerror = audio.onended = null;
    audio.pause(); audio.removeAttribute('src'); audio.load();
  }
  private play() {
    this.stop();
    if (this.dead || !this.state.enabled) return;
    if (!this.active) { this.state.status = 'paused'; return; }
    const audio = this.makeAudio(), generation = this.generation;
    this.audio = audio; audio.preload = 'none';
    audio.volume = this.state.volume * this.master;
    // Native media playback does not require a CORS-enabled WebAudio graph.
    audio.src = ALBANIAN_STATIONS.find(s => s.id === this.state.station)!.stream;
    const current = () => !this.dead && this.active && this.audio === audio && generation === this.generation;
    const fail = (status: RadioStatus) => { if (current()) { this.stop(); this.state.status = status; } };
    const timeout = () => { clearTimeout(this.timer); this.timer = setTimeout(() => fail('unavailable'), 12000); };
    audio.onplaying = () => { if (current()) { clearTimeout(this.timer); this.state.status = 'playing'; } };
    audio.onwaiting = audio.onstalled = () => { if (current()) { this.state.status = 'connecting'; timeout(); } };
    audio.onerror = audio.onended = () => fail('unavailable');
    this.state.status = 'connecting'; timeout();
    try { void audio.play().catch(error => fail(error?.name === 'NotAllowedError' ? 'blocked' : 'unavailable')); }
    catch { fail('unavailable'); }
  }
  dispose() { this.dead = true; this.active = false; this.stop(); this.state.status = 'off'; }
}
