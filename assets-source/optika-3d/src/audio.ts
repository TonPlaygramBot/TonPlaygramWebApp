export class Sound {
  enabled=true; private ctx:AudioContext|null=null;
  wake(){if(!this.enabled)return; try{this.ctx??=new AudioContext(); if(this.ctx.state==='suspended')void this.ctx.resume().catch(()=>{});}catch{}}
  play(type:'hit'|'miss'|'load'|'zoom'|'finish'){
    if(!this.enabled)return;
    this.wake();const ctx=this.ctx;if(!ctx)return;
    const tone=(f:number,end:number,dur:number,gain:number,start=0,wave:OscillatorType='sine')=>{
      const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime+start;o.type=wave;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(end,t+dur);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.007);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
      o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+dur+.015);o.onended=()=>{o.disconnect();g.disconnect()};
    };
    if(type==='hit'||type==='miss'){tone(115,38,.17,.16,0,'triangle');tone(680,95,.07,.055,0,'sawtooth');if(type==='hit'){tone(1125,920,.48,.085,.075);tone(1720,1320,.24,.04,.085)}}
    if(type==='load'){tone(260,370,.08,.055,0,'triangle');tone(450,220,.08,.07,.21,'triangle')}
    if(type==='zoom')tone(310,380,.09,.036,0,'sine');
    if(type==='finish')[420,555,695,835].forEach((f,i)=>tone(f,f*1.01,.39,.04,i*.11));
  }
  close(){if(this.ctx)void this.ctx.close().catch(()=>{})}
}
