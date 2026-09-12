import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
type Props={hold:(id:string,key:string,value:number|boolean)=>void;release:(id:string)=>void;boost:number;drifting?:boolean;disabled?:boolean};

/** Two-thumb layout. Slide the gas thumb visually upward to drift while keeping
 * manual throttle held; each pointer owns its inputs until release or cancel. */
export function KartControls({hold,release,boost,drifting,disabled=false}:Props) {
  const gas=useRef(new Map<number,number>());
  const [pressed,setPressed]=useState(false);
  useEffect(()=>{if(disabled){gas.current.clear();setPressed(false);}},[disabled]);
  const finish=(id:number)=>{release(`pedal:${id}`);release(`pedal-drift:${id}`);gas.current.delete(id);setPressed(gas.current.size>0);};
  const touch=(key:string,value:number|boolean)=>({
    onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{if(disabled)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);hold(`control:${e.pointerId}`,key,value);},
    onPointerUp:(e:React.PointerEvent<HTMLButtonElement>)=>release(`control:${e.pointerId}`),
    onPointerCancel:(e:React.PointerEvent<HTMLButtonElement>)=>release(`control:${e.pointerId}`),
    onLostPointerCapture:(e:React.PointerEvent<HTMLButtonElement>)=>release(`control:${e.pointerId}`)
  });
  return <div className="kart-controls" aria-label="Kart driving controls">
    <div className="kart-left-controls">
      <button disabled={disabled} className="kart-brake" {...touch('brake',true)} aria-label="Hold brake">BRAKE</button>
      <div className="kart-steer-controls">
        <button disabled={disabled} {...touch('steer',-1)} aria-label="Steer left"><ChevronLeft size={32}/></button>
        <button disabled={disabled} {...touch('steer',1)} aria-label="Steer right"><ChevronRight size={32}/></button>
      </div>
    </div>
    <div className="kart-right-controls">
      <div className="kart-action-controls">
        <button disabled={disabled} className={drifting?'kart-drift is-active':'kart-drift'} {...touch('drift',true)}>DRIFT</button>
        <button disabled={disabled||boost<1} className="kart-boost" {...touch('boost',true)} aria-label="Hold boost while accelerating"><Zap size={18}/><span>BOOST</span><i style={{width:`${Math.max(0,Math.min(100,boost))}%`}}/></button>
      </div>
      <button disabled={disabled} className={`kart-gas ${pressed&&!disabled?'is-active':''}`} aria-label="Hold gas to accelerate; slide upward to drift"
        onPointerDown={e=>{if(disabled)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);gas.current.set(e.pointerId,e.clientY);hold(`pedal:${e.pointerId}`,'throttle',true);setPressed(true);}}
        onPointerMove={e=>{const start=gas.current.get(e.pointerId);if(disabled||start===undefined)return;if(e.clientY<start-32)hold(`pedal-drift:${e.pointerId}`,'drift',true);else release(`pedal-drift:${e.pointerId}`);}}
        onPointerUp={e=>finish(e.pointerId)} onPointerCancel={e=>finish(e.pointerId)} onLostPointerCapture={e=>finish(e.pointerId)}>
        <b>GAS</b><span>HOLD TO DRIVE</span><small>SLIDE UP · DRIFT</small>
      </button>
    </div>
  </div>;
}
