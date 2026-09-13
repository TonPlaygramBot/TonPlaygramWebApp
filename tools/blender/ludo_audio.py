"""Deterministic, original game sound design (not field recordings)."""
import math, random, wave, struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
out=ROOT/'webapp/public/assets/ludo/audio';out.mkdir(parents=True,exist_ok=True)
rate=22050
for kind,duration in [('pistol',.32),('smg',.23),('rifle',.48),('marksman',.64),('shotgun',.56),('shell',.30),('step',.12),('drone',2.0)]:
    rng=random.Random(kind);samples=[];last=0
    for i in range(int(rate*duration)):
        t=i/rate;noise=rng.uniform(-1,1);last=last*.7+noise*.3
        if kind=='shell':
            value=sum(math.sin(2*math.pi*f*t)*math.exp(-t*d)*a for f,d,a in [(2400,24,.34),(3700,35,.20),(5900,55,.10)])
            value+=noise*math.exp(-t*250)*.17
        elif kind=='step':
            value=math.sin(2*math.pi*(230*t-150*t*t))*math.exp(-t*45)*.34+last*math.exp(-t*90)*.45
        elif kind=='drone':
            # Integer-frequency partials give a seamless 2-second loop.
            value=sum(math.sin(2*math.pi*f*t)*a for f,a in [(90,.13),(180,.08),(270,.055),(450,.025),(720,.013)])*(.88+.12*math.sin(2*math.pi*4*t))
        else:
            low={'pistol':150,'smg':185,'rifle':95,'marksman':65,'shotgun':75}[kind]
            decay={'pistol':18,'smg':25,'rifle':12,'marksman':9,'shotgun':10}[kind]
            crack=(noise-last)*math.exp(-t*110)*.65
            body=math.sin(2*math.pi*(low*t-35*t*t))*math.exp(-t*decay)*.52
            tail=last*math.exp(-t*decay*.7)*.36
            echo=math.sin(2*math.pi*low*(t-.045))*math.exp(-(t-.045)*25)*.10 if t>.045 else 0
            value=crack+body+tail+echo
        if kind!='drone':value*=min(1,t/.0008)*min(1,(duration-t)/.02)
        samples.append(max(-1,min(1,value)))
    with wave.open(str(out/(kind+'.wav')),'wb') as f:
        f.setparams((1,2,rate,len(samples),'NONE','not compressed'));f.writeframes(b''.join(struct.pack('<h',int(v*28000)) for v in samples))
