import React, { useEffect, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import {driftTier} from './arcadeRules.mjs';
type Props = { hold: (id:string,key:string,value:number|boolean)=>void; release:(id:string)=>void; boost:number; drifting?:boolean; driftCharge?:number; turbo?:number; boostEvent?:number; reversing?:boolean; disabled?:boolean };

/** Tirana Streets-style analogue steering stick plus independent pedals.
 * Screen movement maps directly to steering: visually left is left and right is
 * right. Sliding the stick visually upward also engages drift. */
export function KartControls({hold,release,boost,drifting,driftCharge=0,turbo=0,boostEvent=0,reversing=false,disabled=false}:Props) {
  const pointers = useRef(new Map<number,{key:string;value:number|boolean;startY:number}>());
  const stickOwner=useRef<number|null>(null),stickKnob=useRef<HTMLSpanElement>(null);
  const callbacks = useRef({hold,release}); callbacks.current = {hold,release};
  const [pressed,setPressed] = useState<string[]>([]);
  const publish = () => setPressed([...pointers.current.values()].map(p=>p.key+':'+p.value));
  const resetStick=()=>{
    if(stickOwner.current!==null){callbacks.current.release(`control:${stickOwner.current}`);callbacks.current.release(`gesture:${stickOwner.current}`);}
    stickOwner.current=null;if(stickKnob.current)stickKnob.current.style.transform='translate(0px,0px)';
  };
  const finish = (id:number) => {
    callbacks.current.release(`control:${id}`);callbacks.current.release(`gesture:${id}`);
    pointers.current.delete(id); publish();
  };
  const clear=()=>{
    resetStick();
    for (const id of pointers.current.keys()) {callbacks.current.release(`control:${id}`);callbacks.current.release(`gesture:${id}`);}
    pointers.current.clear();setPressed([]);
  };
  useEffect(()=>{
    const hide=()=>{if(document.hidden)clear();};
    window.addEventListener('blur',clear); document.addEventListener('visibilitychange',hide);
    if(disabled)clear();
    return ()=>{clear();window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',hide);};
  },[disabled]);
  const moveStick=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(disabled||stickOwner.current!==e.pointerId)return;
    const rect=e.currentTarget.getBoundingClientRect(),radius=Math.min(rect.width,rect.height)*.39;
    const dx=e.clientX-rect.left-rect.width/2,dy=e.clientY-rect.top-rect.height/2;
    const distance=Math.hypot(dx,dy),scale=distance>radius?radius/distance:1;
    const x=dx*scale/radius,y=dy*scale/radius;
    const steer=Math.abs(x)<.08?0:x;
    callbacks.current.hold(`control:${e.pointerId}`,'steer',steer);
    if(y<-.55)callbacks.current.hold(`gesture:${e.pointerId}`,'drift',true);else callbacks.current.release(`gesture:${e.pointerId}`);
    if(stickKnob.current)stickKnob.current.style.transform=`translate(${x*radius*.8}px,${y*radius*.8}px)`;
  };
  const endStick=(e:React.PointerEvent<HTMLDivElement>)=>{if(stickOwner.current===e.pointerId)resetStick();};
  const touch = (key:string,value:number|boolean,gesture?:string) => ({
    onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{
      if(disabled || (e.pointerType==='mouse' && e.button!==0))return;
      e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId,{key,value,startY:e.clientY});
      hold(`control:${e.pointerId}`,key,value);publish();
    },
    onPointerMove:(e:React.PointerEvent<HTMLButtonElement>)=>{
      const p=pointers.current.get(e.pointerId);if(disabled||!p||!gesture)return;
      if(e.clientY<p.startY-30)hold(`gesture:${e.pointerId}`,gesture,true);
      else release(`gesture:${e.pointerId}`);
    },
    onPointerUp:(e:React.PointerEvent<HTMLButtonElement>)=>finish(e.pointerId),
    onPointerCancel:(e:React.PointerEvent<HTMLButtonElement>)=>finish(e.pointerId),
    onLostPointerCapture:(e:React.PointerEvent<HTMLButtonElement>)=>finish(e.pointerId)
  });
  const active=(key:string,value:number|boolean=true)=>pressed.includes(key+':'+value)?' is-active':'';
  const energy=Math.round(Math.max(0,Math.min(100,boost)));
  const label=turbo>0?'TURBO':drifting?['DRIFT','MINI','SUPER','ROYAL'][driftTier(driftCharge)]:'BOOST';
  return <div className="kart-controls" aria-label="Kart driving controls">
    <div className="kart-steering-stick" role="group" aria-label="Steering joystick; slide up to drift"
      onPointerDown={e=>{if(disabled||stickOwner.current!==null||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();stickOwner.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);moveStick(e);}}
      onPointerMove={moveStick} onPointerUp={endStick} onPointerCancel={endStick} onLostPointerCapture={endStick}>
      <span ref={stickKnob} aria-hidden="true">↑</span>
    </div>
    <button disabled={disabled} className={`kart-brake kart-center-control${active('brake')}`} {...touch('brake',true)} aria-label="Brake; keep held after stopping to reverse">{reversing?'REV':'BRAKE'}</button>
    <div className="kart-right-controls">
      <button disabled={disabled} className={`kart-boost${active('boost')}${turbo>0?' is-turbo':''}${energy<1?' is-empty':''}`} {...touch('boost',true)} aria-label={`${label}; hold while accelerating; ${energy}% energy`}>
        <Zap size={18}/><span aria-live="polite">{label}</span><i style={{width:`${drifting?Math.min(100,driftCharge/1.9*100):energy}%`}}/>
        {boostEvent>0&&<em key={boostEvent} className="kart-boost-pickup" aria-hidden="true"/>}
      </button>
      <div className="kart-pedal-controls">
        <button disabled={disabled} className={`kart-drift${drifting?' is-active':active('drift')}`} {...touch('drift',true)} aria-label="Hold drift while steering">DRIFT</button>
        <button disabled={disabled} className={`kart-gas${active('throttle')}`} {...touch('throttle',true,'boost')} aria-label="Hold gas to accelerate; slide up to boost">GAS</button>
      </div>
    </div>
  </div>;
}
