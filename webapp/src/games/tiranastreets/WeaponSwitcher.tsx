import {useEffect, useRef, useState} from 'react';
import './weapon-switcher.css';
export type WeaponSlot = {id:string;label:string;thumbnail?:string;icon?:string;category?:string;ammo?:number;reserve?:number};
/** Tap swaps the last two weapons; swipe cycles the complete owned inventory.
 * No modal and no global input reset: other fingers keep moving/aiming/firing. */
export function WeaponSwitcher({weapons,selected,disabled=false,onSelect}: {
  weapons:WeaponSlot[];selected:string;disabled?:boolean;onSelect:(id:string)=>boolean;onOpen?:()=>void;
}) {
  const previous=useRef<string|null>(null),currentId=useRef(selected);
  const pointer=useRef<{id:number;x:number}|null>(null),[notice,setNotice]=useState('');
  useEffect(()=>{if(currentId.current!==selected){previous.current=currentId.current;currentId.current=selected;}},[selected]);
  const current=weapons.find(w=>w.id===selected);
  const choose=(direction=0)=>{
    if(disabled||weapons.length<2)return;
    const index=Math.max(0,weapons.findIndex(w=>w.id===currentId.current));
    const target=direction===0&&previous.current!==null&&weapons.some(w=>w.id===previous.current)&&previous.current!==currentId.current
      ? previous.current : weapons[(index+(direction||1)+weapons.length)%weapons.length].id;
    if(onSelect(target)){previous.current=currentId.current;currentId.current=target;setNotice('');}
    else setNotice('Finish your current action to switch.');
  };
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),1800);return()=>clearTimeout(t);},[notice]);
  return <div className="ts-weapon-switcher">
    <button className="ts-weapon-trigger" aria-label={`Quick swap weapon: ${current?.label||'No weapon'}. Swipe to cycle weapons.`} disabled={disabled}
      onPointerDown={e=>{e.preventDefault();e.stopPropagation();if(pointer.current||e.pointerType==='mouse'&&e.button!==0)return;pointer.current={id:e.pointerId,x:e.clientX};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerUp={e=>{if(pointer.current?.id!==e.pointerId)return;const dx=e.clientX-pointer.current.x;pointer.current=null;choose(Math.abs(dx)>24?(dx<0?1:-1):0);}}
      onPointerCancel={e=>{if(pointer.current?.id===e.pointerId)pointer.current=null;}}
      onLostPointerCapture={e=>{if(pointer.current?.id===e.pointerId)pointer.current=null;}}
      onClick={e=>{if(e.detail===0)choose();}}
      onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();choose(e.key==='ArrowRight'?1:-1);}}}>
      <span aria-hidden="true">⇄</span><small>{current?.label||'Hands'}</small>
    </button>{notice&&<span className="ts-weapon-notice" role="status">{notice}</span>}
  </div>;
}
