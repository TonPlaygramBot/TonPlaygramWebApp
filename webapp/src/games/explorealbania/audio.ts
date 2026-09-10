import type { TruckState } from './simulation';
export class TruckAudio {
  context:AudioContext|null=null; master:GainNode|null=null; engine:OscillatorNode|null=null; gain:GainNode|null=null; muted=false;
  unlock(){if(this.context){this.context.resume();return;}try{const c=this.context=new AudioContext(),master=this.master=c.createGain(),filter=c.createBiquadFilter(),engine=this.engine=c.createOscillator(),gain=this.gain=c.createGain();master.gain.value=this.muted?0:.32;filter.type='lowpass';filter.frequency.value=360;engine.type='sawtooth';engine.frequency.value=38;gain.gain.value=0;engine.connect(filter);filter.connect(gain);gain.connect(master);master.connect(c.destination);engine.start();}catch{}}
  setMuted(value:boolean){this.muted=value;if(this.master&&this.context)this.master.gain.setTargetAtTime(value?0:.32,this.context.currentTime,.03);}
  update(s:TruckState,playing:boolean){if(!this.context)return;const now=this.context.currentTime;this.engine?.frequency.setTargetAtTime(35+s.rpm/34,now,.08);this.gain?.gain.setTargetAtTime(playing&&s.engine?.11:0,now,.08);}
  beep(f=540){if(this.muted||!this.context||!this.master)return;const o=this.context.createOscillator(),g=this.context.createGain(),n=this.context.currentTime;o.frequency.value=f;g.gain.setValueAtTime(.08,n);g.gain.exponentialRampToValueAtTime(.001,n+.12);o.connect(g);g.connect(this.master);o.start();o.stop(n+.12);}
  destroy(){try{this.engine?.stop();}catch{}this.context?.close();}
}
