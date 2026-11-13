import type { Frame } from './renderer';
/** Lightweight local Web Audio synthesis: no stream, asset download or autoplay. */
export class KartAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private harmonic: OscillatorNode | null = null;
  private harmonicGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private intake: GainNode | null = null;
  private road: GainNode | null = null;
  private rivals: {osc:OscillatorNode;gain:GainNode;pan:StereoPannerNode}[] = [];
  private transients = new Set<AudioScheduledSourceNode>();
  private lastShift = 0;
  private lastCountdown = -1;
  private lastLap = 0;
  private wasAirborne = false;
  private tire: GainNode | null = null;
  private air: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private lastImpact = 0;
  private lastBoost = 0;
  private convoyAudio: Frame['convoy'];
  muted = false;
  unlock() {
    if (!this.context)
      try {
        const Constructor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const c = (this.context = new Constructor());
        const master = (this.master = c.createGain());
        master.gain.value = this.muted ? 0 : 0.45;
        const limiter=c.createDynamicsCompressor();
        limiter.threshold.value=-16;limiter.knee.value=18;limiter.ratio.value=5;
        master.connect(limiter);limiter.connect(c.destination);
        const oscillator = (this.engine = c.createOscillator()),
          gain = (this.engineGain = c.createGain()),
          filter = c.createBiquadFilter();
        this.engineFilter=filter;
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 44;
        filter.type = 'lowpass';
        filter.frequency.value = 480;
        gain.gain.value = 0;
        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        oscillator.start();
        this.sources.push(oscillator);
        const harmonic=this.harmonic=c.createOscillator(),hg=this.harmonicGain=c.createGain();
        harmonic.type='triangle';hg.gain.value=0;harmonic.connect(hg);hg.connect(master);
        harmonic.start();this.sources.push(harmonic);
        for(let i=0;i<2;i++){
          const osc=c.createOscillator(),gain=c.createGain(),pan=c.createStereoPanner(),filter=c.createBiquadFilter();
          osc.type='triangle';gain.gain.value=0;filter.type='lowpass';filter.frequency.value=700;
          osc.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(master);osc.start();
          this.sources.push(osc);this.rivals.push({osc,gain,pan});
        }
        this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const buffer = this.noise.getChannelData(0);
        let seed = 7141;
        for (let i = 0; i < buffer.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          buffer[i] = seed / 2147483648 - 1;
        }
        const loop = (frequency: number, q: number) => {
          const source = c.createBufferSource(),
            filter = c.createBiquadFilter(),
            g = c.createGain();
          source.buffer = this.noise;
          source.loop = true;
          filter.type = 'bandpass';
          filter.frequency.value = frequency;
          filter.Q.value = q;
          g.gain.value = 0;
          source.connect(filter);
          filter.connect(g);
          g.connect(master);
          source.start();
          this.sources.push(source);
          return g;
        };
        this.tire = loop(1750, 2.8);
        this.air = loop(380, 0.7);
        this.intake = loop(210, .8);
        this.road = loop(620, .45);
      } catch {
        return;
      }
    this.context?.resume().catch(() => {});
  }
  resetConvoyAudio() {
    this.convoyAudio = undefined;
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        m ? 0 : 0.45,
        this.context.currentTime,
        0.025
      );
  }
  update(frame: Frame, active: boolean) {
    if (!this.context) return;
    if (!active) { this.silence(); return; }
    const now=this.context.currentTime, running=!frame.retired&&frame.countdown===0;
    const speed=Math.abs(frame.speed), throttle=frame.throttle||0;
    const rpm=frame.powertrain?.rpm ?? (1900+speed*180);
    const shift=frame.powertrain?.shift||0;
    const load=shift>0?.4:1;
    // Combustion fundamental and induction harmonics respond to load and shifts.
    this.engine?.frequency.setTargetAtTime(rpm/60,now,.045);
    this.harmonic?.frequency.setTargetAtTime(rpm/30,now,.055);
    this.engineFilter?.frequency.setTargetAtTime(350+throttle*1500+rpm*.07,now,.09);
    this.engineGain?.gain.setTargetAtTime(running?(.035+throttle*.08)*load:0,now,.045);
    this.harmonicGain?.gain.setTargetAtTime(running?(.009+throttle*.025)*load:0,now,.05);
    this.intake?.gain.setTargetAtTime(running?throttle*.055*load:0,now,.06);
    const scrub=frame.airborne?0:Math.max(frame.tireSlip||0,frame.drifting?.14:0);
    this.tire?.gain.setTargetAtTime(running?Math.min(.17,scrub*speed*.025):0,now,.07);
    const rough=frame.track.surface==='gravel'||frame.track.surface==='dirt';
    this.road?.gain.setTargetAtTime(running&&!frame.airborne?Math.min(.085,speed*(rough?.002:.00045)):0,now,.1);
    this.air?.gain.setTargetAtTime(running?Math.min(.085,speed*.0015):0,now,.1);
    const player=frame.racers.find(r=>r.id===frame.playerId)||frame.racers.find(r=>!r.ai);
    const nearby=player?frame.racers.filter(r=>r!==player&&!r.disconnected&&!r.retired&&!r.finished)
      .map(r=>({r,d:Math.hypot(r.x-player.x,r.z-player.z)})).filter(n=>n.d<38).sort((a,b)=>a.d-b.d).slice(0,2):[];
    this.rivals.forEach((voice,i)=>{
      const n=nearby[i];
      voice.gain.gain.setTargetAtTime(running&&n?.r.speed>1?.045*(1-n.d/38)**2:0,now,.15);
      if(n&&player){
        const lateral=-(n.r.x-player.x)*Math.cos(player.yaw)+(n.r.z-player.z)*Math.sin(player.yaw);
        voice.pan.pan.setTargetAtTime(Math.max(-1,Math.min(1,lateral/8)),now,.12);
        voice.osc.frequency.setTargetAtTime((n.r.powertrain?.rpm||2000+Math.abs(n.r.speed)*180)/60,now,.12);
      }
    });
    if(frame.countdown!==this.lastCountdown){
      if(frame.countdown>0||this.lastCountdown>0)this.beep(frame.countdown===0?1000:440,frame.countdown===0?.26:.1);
      this.lastCountdown=frame.countdown;
    }
    const shiftId=frame.powertrain?.shiftId||0;
    if(running&&shiftId>this.lastShift)this.burst(.055,.045,180);
    this.lastShift=shiftId;
    if(running&&this.wasAirborne&&!frame.airborne)this.burst(.12,.04+Math.min(.1,(frame.landingImpact||0)*.08),220);
    this.wasAirborne=!!frame.airborne;
    if(frame.impactId!==this.lastImpact){
      if(running&&frame.impactId>this.lastImpact)this.crash(frame.impact,frame.impactMaterial);
      this.lastImpact=frame.impactId;
    }
    if(frame.boostEvent!==this.lastBoost){
      if(running&&frame.boostEvent>this.lastBoost)this.burst(.28,.11,1900);
      this.lastBoost=frame.boostEvent;
    }
    const convoy = frame.convoy;
    if (running && convoy) {
      if (convoy.shots > (this.convoyAudio?.shots ?? 0)) this.burst(.075, .11, 2800);
      if (convoy.launches > (this.convoyAudio?.launches ?? 0)) this.burst(.24, .15, 1350);
      if (convoy.blasts > (this.convoyAudio?.blasts ?? 0)) this.burst(.38, .25, 680);
      if (convoy.hits > (this.convoyAudio?.hits ?? 0)) this.burst(.18, .18, 460);
    }
    this.convoyAudio = convoy;
    const laps=frame.telemetry?.completed||0;
    if(running&&laps>this.lastLap)this.beep(frame.telemetry?.lastLap?.clean?1046:784,.16);
    this.lastLap=laps;
  }
  silence() {
    if (!this.context) return;
    const now = this.context.currentTime;
    [this.engineGain, this.harmonicGain, this.intake, this.road, this.tire, this.air,...this.rivals.map(r=>r.gain)].forEach((g) =>
      g?.gain.setTargetAtTime(0, now, 0.025)
    );
    for(const source of this.transients){try{source.stop();}catch{}}
    this.transients.clear();
  }
  private burst(duration: number, volume: number, frequency: number) {
    if (this.muted || !this.context || !this.noise || !this.master) return;
    const c = this.context,
      source = c.createBufferSource(),
      g = c.createGain(),
      filter = c.createBiquadFilter(),
      now = c.currentTime;
    source.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    this.transients.add(source);
    source.start();
    source.stop(now + duration);
    source.onended = () => {
      this.transients.delete(source);
      source.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }
  private crash(strength: number,material:Frame['impactMaterial']='kart') {
    if(material==='water'){this.burst(.48,.14+strength*.2,850);return;}
    const frequency=material==='metal'?2600:material==='tree'||material==='wood'?380:950;
    this.burst(
      0.12 + strength * 0.24,
      0.12 + strength * 0.25,
      frequency + strength * 700
    );
    this.beep(material==='metal'?180+strength*160:62+strength*30,material==='metal'?.18:.1);
  }
  beep(f = 550, d = 0.13) {
    if (this.muted || !this.context || !this.master) return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain(),
      now = c.currentTime;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + d);
    o.connect(g);
    g.connect(this.master);
    this.transients.add(o);
    o.start();
    o.stop(now + d);
    o.onended = () => {
      this.transients.delete(o);
      o.disconnect();
      g.disconnect();
    };
  }
  destroy() {
    this.silence();
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {}
      s.disconnect();
    });
    this.context?.close().catch(() => {});
    this.context = null;this.sources=[];this.rivals=[];
  }
}
