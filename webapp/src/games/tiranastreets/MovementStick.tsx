import {useEffect,useRef,type PointerEvent,type ReactNode} from 'react';
import {screenStick} from './street-career/humanRoster.mjs';

type Props={
  label:string;className:string;disabled:boolean;deadzone?:number;children?:ReactNode;
  claim:(id:number,x:number,y:number)=>boolean;
  release:(id:number)=>void;
  move:(x:number,y:number)=>void;
};
/** Pointer motion updates one knob, without rerendering the full game HUD. */
export function MovementStick(props:Props){
  const knob=useRef<HTMLSpanElement>(null),owner=useRef<number|null>(null),latest=useRef(props);
  latest.current=props;
  const reset=()=>{
    if(owner.current!==null)latest.current.release(owner.current);
    owner.current=null;latest.current.move(0,0);
    if(knob.current)knob.current.style.transform='translate(0px,0px)';
  };
  useEffect(()=>{
    const hidden=()=>{if(document.hidden)reset();};
    window.addEventListener('blur',reset);document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',hidden);reset();};
  },[]);
  useEffect(()=>{if(props.disabled)reset();},[props.disabled]);
  const drag=(e:PointerEvent<HTMLDivElement>)=>{
    if(owner.current!==e.pointerId||latest.current.disabled)return;
    const rect=e.currentTarget.getBoundingClientRect(),radius=Math.min(rect.width,rect.height)*.39;
    const value=screenStick(e.clientX-rect.left-rect.width/2,e.clientY-rect.top-rect.height/2,radius,latest.current.deadzone);
    latest.current.move(value.x,value.y);
    if(knob.current)knob.current.style.transform=`translate(${value.x*radius*.8}px,${-value.y*radius*.8}px)`;
  };
  const release=(e:PointerEvent<HTMLDivElement>)=>{if(owner.current===e.pointerId)reset();};
  return <div className={props.className} role="group" aria-label={props.label}
    onPointerDown={e=>{
      if(latest.current.disabled||owner.current!==null||(e.target as HTMLElement).closest('button'))return;
      e.preventDefault();
      if(!latest.current.claim(e.pointerId,e.clientX,e.clientY))return;
      owner.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);drag(e);
    }} onPointerMove={drag} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
    <span ref={knob} aria-hidden="true">↑</span>{props.children}
  </div>;
}
