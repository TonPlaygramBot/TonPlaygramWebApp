import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
type Props = { hold: (id:string,key:string,value:number|boolean)=>void; release:(id:string)=>void; boost:number; drifting?:boolean; disabled?:boolean };

/** Screen order: steering · drift · brake · gas, with boost above the pedals.
 * Each pointer owns its chord. Slide a steering thumb up for drift; slide the
 * gas thumb up for boost, so both actions work with just two thumbs. */
export function KartControls({hold,release,boost,drifting,disabled=false}:Props) {
  const pointers = useRef(new Map<number,{key:string;value:number|boolean;startY:number}>());
  const callbacks = useRef({hold,release}); callbacks.current = {hold,release};
  const [pressed,setPressed] = useState<string[]>([]);
  const publish = () => setPressed([...pointers.current.values()].map(p=>p.key+':'+p.value));
  const finish = (id:number) => {
    callbacks.current.release(`control:${id}`);
    callbacks.current.release(`gesture:${id}`);
    pointers.current.delete(id); publish();
  };
  useEffect(()=>{
    const clear = () => {
      for (const id of pointers.current.keys()) {
        callbacks.current.release(`control:${id}`); callbacks.current.release(`gesture:${id}`);
      }
      pointers.current.clear(); setPressed([]);
    };
    const hide=()=>{if(document.hidden)clear();};
    window.addEventListener('blur',clear); document.addEventListener('visibilitychange',hide);
    if(disabled)clear();
    return ()=>{clear();window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',hide);};
  },[disabled]);
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
  return <div className="kart-controls" aria-label="Kart driving controls">
    <div className="kart-steer-controls">
      <button disabled={disabled} className={active('steer',-1)} {...touch('steer',-1,'drift')} aria-label="Steer left; slide up to drift"><ChevronLeft size={36}/></button>
      <button disabled={disabled} className={active('steer',1)} {...touch('steer',1,'drift')} aria-label="Steer right; slide up to drift"><ChevronRight size={36}/></button>
    </div>
    <button disabled={disabled} className={`kart-drift${drifting?' is-active':active('drift')}`} {...touch('drift',true)}>DRIFT</button>
    <div className="kart-right-controls">
      <button disabled={disabled} className={`kart-boost${active('boost')}${energy<1?' is-empty':''}`} {...touch('boost',true)} aria-label={`Hold boost while accelerating; ${energy}% energy`}>
        <Zap size={18}/><span>BOOST</span><i style={{width:`${energy}%`}}/>
      </button>
      <div className="kart-pedal-controls">
        <button disabled={disabled} className={`kart-brake${active('brake')}`} {...touch('brake',true)} aria-label="Hold brake">BRAKE</button>
        <button disabled={disabled} className={`kart-gas${active('throttle')}`} {...touch('throttle',true,'boost')} aria-label="Hold gas to accelerate; slide up to boost">GAS</button>
      </div>
    </div>
  </div>;
}
