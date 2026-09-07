// All sound is synthesized locally. No downloads; buffers and master bus are reused.
export class GameAudio {
  ctx: AudioContext|null=null; master: GainNode|null=null; noise:AudioBuffer|null=null; ambient:AudioBufferSourceNode|null=null; volume=.55;
  start(){
    if(!this.ctx){
      this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=this.volume*.55;this.master.connect(this.ctx.destination);
      this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);const a=this.noise.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;
      this.ambient=this.ctx.createBufferSource();this.ambient.buffer=this.noise;this.ambient.loop=true;const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=500;const g=this.ctx.createGain();g.gain.value=.09;this.ambient.connect(filter).connect(g).connect(this.master);this.ambient.start();
    }
    void this.ctx.resume().catch(()=>{});
  }
  setVolume(v:number){this.volume=v;if(this.master)this.master.gain.value=v*.55;}
  burst(duration:number,frequency:number,volume:number,type:BiquadFilterType='lowpass'){
    if(!this.ctx||!this.master||!this.noise||this.ctx.state!=='running')return;
    const s=this.ctx.createBufferSource();s.buffer=this.noise;const f=this.ctx.createBiquadFilter();f.type=type;f.frequency.value=frequency;const g=this.ctx.createGain();const now=this.ctx.currentTime;g.gain.setValueAtTime(volume,now);g.gain.exponentialRampToValueAtTime(.001,now+duration);s.connect(f).connect(g).connect(this.master);s.start(0,Math.random());s.stop(now+duration);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
  }
  tone(frequency:number,duration:number,volume:number,end=frequency){
    if(!this.ctx||!this.master||this.ctx.state!=='running')return;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=this.ctx.currentTime;o.frequency.setValueAtTime(frequency,t);o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g).connect(this.master);o.start();o.stop(t+duration);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  shot(){this.burst(.16,2600,.8);this.tone(120,.12,.7,38);}
  hit(){this.burst(.08,3200,.22,'highpass');this.tone(1100,.045,.12,750);}
  kill(){this.tone(750,.09,.18,1200);}
  step(){this.burst(.1,450,.14);}
  reload(){this.burst(.13,2500,.3,'highpass');}
  hurt(){this.burst(.18,330,.4);this.tone(70,.2,.25,38);}
  victory(){this.tone(440,.45,.17,660);this.tone(660,.7,.12,880);}
  suspend(){void this.ctx?.suspend().catch(()=>{});}
  dispose(){this.ambient?.stop();void this.ctx?.close().catch(()=>{});}
}
