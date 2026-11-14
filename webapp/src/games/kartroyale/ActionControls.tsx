import {useEffect,useRef,useState,type PointerEvent} from 'react';
import './actionControls.css';

export type ActionKey = 'moveX'|'moveZ'|'turn'|'sprint'|'fire'|'jump'|'interact'|'reload';
export interface ActionControlInput {
  moveX:number; moveZ:number; turn:number; sprint:boolean; fire:boolean;
  jump:boolean; interact:boolean; reload:boolean;
}
const emptyAction = ():ActionControlInput => ({moveX:0,moveZ:0,turn:0,sprint:false,fire:false,jump:false,interact:false,reload:false});
/** Each finger/key owns its input, so releasing FIRE cannot release movement. */
export function createHeldActionInput(){
  const owners=new Map<string,{key:ActionKey;value:number|boolean}>();
  return {
    hold(id:string,key:ActionKey,value:number|boolean){
      if(!owners.has(id)&&owners.size>=32)return;
      owners.set(id,{key,value});
    },
    release(id:string){owners.delete(id);},
    clear(){owners.clear();},
    read():ActionControlInput{
      const input=emptyAction();
      for(const {key,value} of owners.values()){
        if(key==='moveX'||key==='moveZ'||key==='turn')input[key]+=Number(value)||0;
        else input[key] ||= value===true;
      }
      input.moveX=Math.max(-1,Math.min(1,input.moveX));
      input.moveZ=Math.max(-1,Math.min(1,input.moveZ));
      input.turn=Math.max(-1,Math.min(1,input.turn));
      return input;
    }
  };
}
interface HoldProps {
  disabled?:boolean;
  hold:(id:string,key:string,value:number|boolean)=>void;
  release:(id:string)=>void;
}
function HoldButton({label,inputKey,hold,release,disabled=false,className='',ariaLabel}:HoldProps&{label:string;inputKey:string;className?:string;ariaLabel?:string}){
  const pointers=useRef(new Set<number>()),callbacks=useRef({hold,release});callbacks.current={hold,release};
  const [pressed,setPressed]=useState(false);
  const clear=()=>{callbacks.current.release(`action-button:${inputKey}:keyboard`);for(const pointer of pointers.current)callbacks.current.release(`action-button:${inputKey}:${pointer}`);pointers.current.clear();setPressed(false);};
  useEffect(()=>{
    const hide=()=>{if(document.hidden)clear();};
    if(disabled)clear();
    window.addEventListener('blur',clear);document.addEventListener('visibilitychange',hide);
    return()=>{clear();window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',hide);};
  },[disabled,inputKey]);
  const releasePointer=(event:PointerEvent<HTMLButtonElement>)=>{
    callbacks.current.release(`action-button:${inputKey}:${event.pointerId}`);
    pointers.current.delete(event.pointerId);setPressed(pointers.current.size>0);
  };
  return <button type="button" disabled={disabled} className={`${className}${pressed?' is-active':''}`} aria-label={ariaLabel||label}
    onPointerDown={event=>{
      if(disabled||(event.pointerType==='mouse'&&event.button!==0))return;
      event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current.add(event.pointerId);setPressed(true);
      callbacks.current.hold(`action-button:${inputKey}:${event.pointerId}`,inputKey,true);
    }} onPointerUp={releasePointer} onPointerCancel={releasePointer} onLostPointerCapture={releasePointer}
    onKeyDown={event=>{
      if(disabled||event.repeat||!['Enter',' '].includes(event.key))return;
      event.preventDefault();event.stopPropagation();callbacks.current.hold(`action-button:${inputKey}:keyboard`,inputKey,true);setPressed(true);
    }} onKeyUp={event=>{if(['Enter',' '].includes(event.key)){event.stopPropagation();callbacks.current.release(`action-button:${inputKey}:keyboard`);setPressed(false);}}}
    onBlur={()=>{callbacks.current.release(`action-button:${inputKey}:keyboard`);clear();}}>{label}</button>;
}
function ActionStick({kind,hold,release,disabled=false}:HoldProps&{kind:'move'|'aim'}){
  const owner=useRef<number|null>(null),knob=useRef<HTMLSpanElement>(null),callbacks=useRef({hold,release});callbacks.current={hold,release};
  const clear=()=>{
    if(owner.current!==null){callbacks.current.release(`action-stick:${kind}:${owner.current}:x`);callbacks.current.release(`action-stick:${kind}:${owner.current}:y`);}
    owner.current=null;if(knob.current)knob.current.style.transform='translate(0px,0px)';
  };
  useEffect(()=>{
    const hide=()=>{if(document.hidden)clear();};if(disabled)clear();
    window.addEventListener('blur',clear);document.addEventListener('visibilitychange',hide);
    return()=>{clear();window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',hide);};
  },[disabled,kind]);
  const move=(event:PointerEvent<HTMLDivElement>)=>{
    if(disabled||owner.current!==event.pointerId)return;
    const rect=event.currentTarget.getBoundingClientRect(),radius=Math.min(rect.width,rect.height)*.4;
    const dx=event.clientX-rect.left-rect.width/2,dy=event.clientY-rect.top-rect.height/2;
    const magnitude=Math.hypot(dx,dy),scale=magnitude>radius?radius/magnitude:1;
    const x=dx*scale/radius,y=dy*scale/radius;
    callbacks.current.hold(`action-stick:${kind}:${event.pointerId}:x`,kind==='move'?'moveX':'turn',Math.abs(x)<.1?0:x);
    if(kind==='move')callbacks.current.hold(`action-stick:${kind}:${event.pointerId}:y`,'moveZ',Math.abs(y)<.1?0:-y);
    if(knob.current)knob.current.style.transform=`translate(${x*radius*.7}px,${kind==='move'?y*radius*.7:0}px)`;
  };
  const end=(event:PointerEvent<HTMLDivElement>)=>{if(owner.current===event.pointerId)clear();};
  return <div className={`rr-action-stick rr-action-${kind}`} role="group" aria-label={kind==='move'?'Walk joystick; up moves forward, sideways strafes':'Aim joystick; left turns left, right turns right'}
    onPointerDown={event=>{if(disabled||owner.current!==null||(event.pointerType==='mouse'&&event.button!==0))return;event.preventDefault();owner.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);move(event);}}
    onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
    <span ref={knob} aria-hidden="true">{kind==='move'?'MOVE':'AIM'}</span>
  </div>;
}
export function CombatControls(props:HoldProps&{reloading?:boolean;shieldActive?:boolean;shield:number}){
  return <div className="rr-combat-controls" aria-label="Combat race controls">
    <HoldButton {...props} inputKey="shield" label={props.shieldActive?'SHIELD ON':`SHIELD ${Math.round(props.shield)}%`} ariaLabel="Hold shield to block incoming fire"/>
    <HoldButton {...props} inputKey="reload" label={props.reloading?'RELOADING':'RELOAD'} ariaLabel="Reload combat weapon"/>
    <HoldButton {...props} inputKey="fire" label="FIRE" ariaLabel="Hold fire to shoot ahead" className="rr-action-fire"/>
  </div>;
}
export function ActionControls(props:HoldProps&{onFoot:boolean;reloading?:boolean;interactionLabel?:string}){
  if(!props.onFoot)return <div className="rr-action-driving" aria-label="Driving mission actions">
    <HoldButton {...props} inputKey="interact" label="EXIT KART" ariaLabel="Stop and exit kart"/>
    <HoldButton {...props} inputKey="reload" label={props.reloading?'RELOADING':'RELOAD'}/>
    <HoldButton {...props} inputKey="fire" label="FIRE" ariaLabel="Hold fire to shoot ahead" className="rr-action-fire"/>
  </div>;
  return <>
    <div className="rr-action-crosshair" aria-hidden="true">+</div>
    <div className="rr-action-onfoot" aria-label="On foot mission controls">
      <div className="rr-action-left"><HoldButton {...props} inputKey="interact" label={props.interactionLabel||'INTERACT'}/><ActionStick {...props} kind="move"/></div>
      <div className="rr-action-middle"><HoldButton {...props} inputKey="sprint" label="RUN" ariaLabel="Hold to sprint"/><HoldButton {...props} inputKey="jump" label="JUMP"/></div>
      <div className="rr-action-right"><ActionStick {...props} kind="aim"/><HoldButton {...props} inputKey="fire" label="FIRE" ariaLabel="Hold fire to shoot" className="rr-action-fire"/><HoldButton {...props} inputKey="reload" label={props.reloading?'RELOADING':'RELOAD'}/></div>
    </div>
  </>;
}
