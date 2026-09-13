export type SoundPoint = { x: number; y?: number; z: number };
import {LUDO_CAPTURE_MISSILE_LAUNCH_SOUND_URL,LUDO_CAPTURE_MISSILE_IMPACT_SOUND_URL} from '../../utils/ludoSfx.js';
type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[]; clean: () => void };
type Loop = { source: OscillatorNode; gain: GainNode; filter: BiquadFilterNode };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Shared Ludo missile samples and local synthesis on one bounded spatial bus. */
export class SceneSound {
  readonly maxVoices = 24;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Set<Voice>();
  private loops = new Map<string, Loop>();
  private listener: SoundPoint = { x: 0, y: 0, z: 0 };
  private yaw = 0;
  private gain = 1;
  private paused = true;
  private disposed = false;
  private sampleAbort = new AbortController();
  private samples = new Map<string, AudioBuffer>();
  private sampleBytes = new Map(['launch','impact'].map((key,index)=>[key,fetch([LUDO_CAPTURE_MISSILE_LAUNCH_SOUND_URL,LUDO_CAPTURE_MISSILE_IMPACT_SOUND_URL][index],{signal:this.sampleAbort.signal}).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null)]));
  get activeVoices() { return this.voices.size; }
  async unlock() {
    if (this.disposed) return;
    if (!this.context) {
      const Context = globalThis.AudioContext;
      if (!Context) return;
      const c = this.context = new Context();
      this.master = c.createGain(); this.master.gain.value = 0;
      this.compressor = c.createDynamicsCompressor();
      this.compressor.threshold.value = -18; this.compressor.ratio.value = 6;
      this.master.connect(this.compressor).connect(c.destination);
      this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      for(const [key,request] of this.sampleBytes)void request.then(bytes=>bytes?c.decodeAudioData(bytes):null).then(buffer=>{if(buffer&&!this.disposed)this.samples.set(key,buffer);}).catch(()=>{});
    }
    this.paused = false;
    await this.context.resume();
    if (!this.paused && !this.disposed) this.setVolume(this.gain);
  }
  setVolume(value: number) {
    this.gain = Number.isFinite(value) ? clamp(value, 0, 1) : 0;
    const c = this.context;
    if (c && this.master) {
      this.master.gain.cancelScheduledValues(c.currentTime);
      this.master.gain.setTargetAtTime(this.paused ? 0 : this.gain * .55, c.currentTime, .025);
    }
    if (!this.gain) this.stopVoices();
  }
  setListener(position: SoundPoint, yaw: number) { this.listener = { ...position }; this.yaw = yaw; }
  spatial(at?: SoundPoint) {
    if (!at) return { gain: 1, pan: 0, delay: 0 };
    const dx = at.x - this.listener.x, dz = at.z - this.listener.z;
    const distance = Math.hypot(dx, dz, (at.y ?? 0) - (this.listener.y ?? 0));
    return { gain: distance > 300 ? 0 : 1 / (1 + distance * .065),
      pan: clamp((dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw)) / Math.max(12, distance), -1, 1),
      delay: Math.min(.8, distance / 343) };
  }
  private play(duration: number, frequency: number, volume: number, at?: SoundPoint,
    tone = false, end = frequency, type: BiquadFilterType = 'lowpass', offset = 0) {
    const c = this.context, space = this.spatial(at);
    if (!c || !this.master || !this.noise || this.paused || this.disposed || !this.gain || c.state !== 'running' || !space.gain || this.voices.size >= this.maxVoices) return;
    const source = tone ? c.createOscillator() : c.createBufferSource();
    const filter = c.createBiquadFilter(), gain = c.createGain(), pan = c.createStereoPanner();
    const now = c.currentTime + space.delay + offset;
    if (tone) {
      const oscillator = source as OscillatorNode;
      oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    } else (source as AudioBufferSourceNode).buffer = this.noise;
    filter.type = type; filter.frequency.value = tone ? 16000 : frequency;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.linearRampToValueAtTime(Math.max(.0001, volume * space.gain), now + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    pan.pan.value = space.pan;
    source.connect(filter).connect(gain).connect(pan).connect(this.master);
    const voice: Voice = { source, nodes: [source, filter, gain, pan], clean: () => {} };
    voice.clean = () => { if (!this.voices.delete(voice)) return; voice.nodes.forEach(n => n.disconnect()); };
    source.onended = voice.clean; this.voices.add(voice);
    source.start(now); source.stop(now + duration + .015);
  }
  burst(duration: number, frequency: number, volume: number, type: BiquadFilterType = 'lowpass', at?: SoundPoint) { this.play(duration, frequency, volume, at, false, frequency, type); }
  tone(frequency: number, duration: number, volume: number, end = frequency, at?: SoundPoint) { this.play(duration, frequency, volume, at, true, end); }
  private sample(key:string,at?:SoundPoint) {
    const c=this.context,buffer=this.samples.get(key),space=this.spatial(at);
    if(!c||!this.master||!buffer||this.paused||this.disposed||!this.gain||c.state!=='running'||!space.gain||this.voices.size>=this.maxVoices)return false;
    const source=c.createBufferSource(),gain=c.createGain(),pan=c.createStereoPanner();source.buffer=buffer;gain.gain.value=space.gain;pan.pan.value=space.pan;
    source.connect(gain).connect(pan).connect(this.master);
    const voice:Voice={source,nodes:[source,gain,pan],clean:()=>{}};
    voice.clean=()=>{if(!this.voices.delete(voice))return;voice.nodes.forEach(n=>n.disconnect());};source.onended=voice.clean;this.voices.add(voice);source.start(c.currentTime+space.delay);return true;
  }
  event(kind: string, at?: SoundPoint) {
    if (kind === 'shot') { this.burst(.12, 2200, .33, 'lowpass', at); this.tone(135, .12, .2, 42, at); }
    else if (kind === 'missile' || kind === 'launch') { if(!this.sample('launch',at)){this.burst(.7, 1100, .45, 'bandpass', at); this.tone(160, .32, .2, 55, at);} }
    else if (['blast', 'explosion', 'vehicle-explosion'].includes(kind)) {
      if(this.sample('impact',at))return;
      this.burst(1.2, 430, .65, 'lowpass', at); this.tone(85, .65, .45, 24, at);
      this.play(.8, 1500, .18, at, false, 1500, 'lowpass', .16);
    } else if (kind === 'fracture') { this.burst(.55, 1900, .33, 'bandpass', at); this.play(1.25, 450, .3, at, false, 450, 'lowpass', .12); }
    else if (kind === 'ignite' || kind === 'fire') this.burst(.7, 700, .19, 'lowpass', at);
    else if (kind === 'reload') { this.burst(.09, 3200, .15, 'highpass', at); this.play(.09, 2400, .12, at, false, 2400, 'highpass', .2); }
    else if (kind === 'step') this.burst(.09, 480, .075);
    else if (['hit', 'punch', 'kick', 'block', 'melee-hit', 'land', 'door'].includes(kind)) this.burst(.13, kind === 'door' ? 450 : 850, .15, 'lowpass', at);
    else if (['purchase', 'loot', 'objective'].includes(kind)) this.tone(660, .22, .1, 990);
  }
  loop(name: string, frequency: number, volume: number, cutoff = 500, type: OscillatorType = 'sawtooth') {
    const c = this.context;
    if (!c || !this.master || this.paused || this.disposed) return;
    let loop = this.loops.get(name);
    if (!loop) {
      if (volume <= 0 || this.loops.size >= 6) return;
      loop = { source: c.createOscillator(), gain: c.createGain(), filter: c.createBiquadFilter() };
      loop.source.type = type; loop.gain.gain.value = 0; loop.filter.type = 'lowpass';
      loop.source.connect(loop.filter).connect(loop.gain).connect(this.master); loop.source.start(); this.loops.set(name, loop);
    }
    const now = c.currentTime;
    loop.source.frequency.setTargetAtTime(Math.max(12, frequency), now, .12);
    loop.filter.frequency.setTargetAtTime(cutoff, now, .12);
    loop.gain.gain.setTargetAtTime(clamp(volume, 0, .2), now, .12);
  }
  silenceLoops() { const now = this.context?.currentTime ?? 0; this.loops.forEach(l => { l.gain.gain.cancelScheduledValues(now); l.gain.gain.setValueAtTime(0, now); }); }
  private stopVoices() { for (const v of [...this.voices]) { try { v.source.stop(); } catch {} v.clean(); } }
  suspend() {
    if(this.paused)return;
    this.paused = true; this.stopVoices(); this.silenceLoops(); this.setVolume(this.gain);
    void this.context?.suspend().catch(() => {});
  }
  dispose() {
    if (this.disposed) return;
    this.suspend(); this.disposed = true;
    this.sampleAbort.abort();this.samples.clear();this.sampleBytes.clear();
    this.loops.forEach(l => { l.source.stop(); l.source.disconnect(); l.filter.disconnect(); l.gain.disconnect(); });
    this.loops.clear(); this.master?.disconnect(); this.compressor?.disconnect();
    void this.context?.close().catch(() => {}); this.context = null; this.master = null; this.noise = null;
  }
}
