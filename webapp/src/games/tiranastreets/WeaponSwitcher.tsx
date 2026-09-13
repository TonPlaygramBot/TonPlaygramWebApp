import {useEffect, useId, useRef, useState} from 'react';
import './weapon-switcher.css';
export type WeaponSlot = {id:string;label:string;thumbnail?:string;icon?:string;category?:string;ammo?:number;reserve?:number};
const pocket=new Set(['','punch','egg','tomato']);
/** The four everyday actions stay at the thumb end of a searchable sheet. */
export function WeaponSwitcher({weapons,selected,disabled=false,onSelect,onOpen}:{
  weapons:WeaponSlot[];selected:string;disabled?:boolean;onSelect:(id:string)=>boolean;onOpen:()=>void;
}) {
  const [open,setOpen]=useState(false),[notice,setNotice]=useState(''),[query,setQuery]=useState('');
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
  const current=weapons.find(w=>w.id===selected);
  const close=()=>{setOpen(false);trigger.current?.focus();};
  useEffect(()=>{
    if(!open)return;
    root.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}};
    document.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape,true);};
  },[open]);
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  const tile=(w:WeaponSlot)=><button key={w.id} aria-label={`Equip ${w.label}`} aria-pressed={selected===w.id}
    onClick={()=>{if(selected===w.id||onSelect(w.id))close();else setNotice('Finish your current action before switching.');}}>
    {w.icon?<span className="ts-weapon-icon" aria-hidden="true">{w.icon}</span>:w.thumbnail?<img src={w.thumbnail} width="128" height="72" alt="" loading="lazy" decoding="async"/>:null}
    <span>{w.label}</span><small>{selected===w.id?'EQUIPPED':w.ammo===undefined?(w.id?'MELEE':'HANDS FREE'):`${w.ammo} / ${w.reserve??0}`}</small>
  </button>;
  const quick=weapons.filter(w=>pocket.has(w.id)),rest=weapons.filter(w=>!pocket.has(w.id)&&w.label.toLowerCase().includes(query.trim().toLowerCase()));
  return <div ref={root} className="ts-weapon-switcher" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{if(open)e.stopPropagation();}}>
    <button ref={trigger} className="ts-weapon-trigger" aria-label="Switch weapon" aria-expanded={open} aria-controls={id} disabled={disabled}
      onClick={()=>{if(open)close();else{onOpen();setNotice('');setQuery('');setOpen(true);}}}>
      <span aria-hidden="true">⇄</span><span>WEAPONS<small>{current?.label||'No weapon'}</small></span>
    </button>
    {open&&<section id={id} className="ts-weapon-picker" aria-label="Available weapons">
      <header><strong>CHOOSE EQUIPMENT</strong><button aria-label="Close weapon selector" onClick={close}>×</button></header>
      <label className="ts-weapon-search"><span>Find a weapon</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your weapons"/></label>
      <div className="ts-weapon-scroll"><div className="ts-weapon-thumbnails">{rest.map(tile)}</div>{!rest.length&&<p>No matching weapons.</p>}</div>
      {!!quick.length&&<div className="ts-weapon-quick" aria-label="Hands and throwables">{quick.map(tile)}</div>}
      {notice&&<p role="status">{notice}</p>}
    </section>}
  </div>;
}
