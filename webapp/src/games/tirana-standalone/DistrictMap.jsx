import React,{useEffect,useRef,useState} from 'react';
import {TOUR_NAMES} from './roamPresentation.mjs';
import {mapBounds,pointerUnit,mapTransform,transformPointers,localMapStorage,readMapFavorites,writeMapFavorites} from './districtMapControls.mjs';

const middle={x:.5,z:.5};
const position=e=>({x:e.clientX,y:e.clientY});
export function DistrictMap({map,player,destination,careerMarker,onSelect,onClose}){
  const boundsRef=useRef(mapBounds(map.viewBox)),bounds=boundsRef.current;
  const [view,setView]=useState(bounds),live=useRef(bounds),surface=useRef(null);
  const [favorites,setFavorites]=useState(()=>readMapFavorites(localMapStorage()));
  const [onlySaved,filterSaved]=useState(false),[saveNotice,setSaveNotice]=useState('');
  const points=useRef(new Map()),gesture=useRef(null);
  const change=next=>{live.current=next;setView(next);};
  const rebase=()=>{gesture.current=points.current.size?{view:live.current,list:[...points.current.values()]}:null;};
  const zoom=(n,u=middle)=>{change(mapTransform(bounds,live.current,u,u,n));rebase();};
  const moveKeys=(x,z)=>{change(mapTransform(bounds,live.current,middle,{x:.5+x,z:.5+z},1));rebase();};
  const reset=()=>{change(bounds);rebase();};

  useEffect(()=>{
    const el=surface.current;if(!el)return;
    const wheel=e=>{
      if(e.cancelable)e.preventDefault();
      const v=live.current,u=pointerUnit(position(e),el.getBoundingClientRect(),v);
      change(mapTransform(boundsRef.current,v,u,u,Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.006)));
      rebase();
    };
    el.addEventListener('wheel',wheel,{passive:false});
    return()=>el.removeEventListener('wheel',wheel);
  },[]);
  const down=e=>{
    if(e.button!==0||points.current.size>=2)return;
    e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);
    points.current.set(e.pointerId,position(e));rebase();
  };
  const move=e=>{
    const g=gesture.current;if(!g||!points.current.has(e.pointerId))return;
    points.current.set(e.pointerId,position(e));
    change(transformPointers(bounds,g.view,g.list,[...points.current.values()],e.currentTarget.getBoundingClientRect()));
  };
  const done=e=>{if(points.current.delete(e.pointerId))rebase();};
  const keys=e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();return;}
    if(e.key==='+'||e.key==='='||e.key==='-'){e.preventDefault();zoom(e.key==='-'?.8:1.25);return;}
    if(e.target===surface.current){
      const dirs={ArrowLeft:[.12,0],ArrowRight:[-.12,0],ArrowUp:[0,.12],ArrowDown:[0,-.12]};
      if(Object.hasOwn(dirs,e.key)){e.preventDefault();moveKeys(...dirs[e.key]);return;}
      if(e.key==='0'){e.preventDefault();reset();return;}
    }
    if(e.key!=='Tab')return;
    const items=[...e.currentTarget.querySelectorAll('button:not([disabled]),[tabindex="0"]')];
    const edge=e.shiftKey?items[0]:items.at(-1);
    if(document.activeElement===edge){e.preventDefault();(e.shiftKey?items.at(-1):items[0])?.focus();}
  };
  const shown=map.points.filter(p=>Object.hasOwn(TOUR_NAMES,p.id)&&(!onlySaved||favorites.includes(p.id)));
  const toggle=id=>{
    const next=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];
    const saved=writeMapFavorites(localMapStorage(),next);
    setFavorites(next);setSaveNotice(saved?'':'Kjo pajisje nuk i ruan të preferuarat pas mbylljes.');
  };

  return <section className="tsc-map" role="dialog" aria-modal="true" aria-label="Harta e qytetit" onKeyDown={keys}>
    <header><div><small>TIRANA STREETS</small><h2>Harta e qytetit</h2></div><button type="button" autoFocus onClick={onClose}>Mbylle</button></header>
    <svg ref={surface} className="tsc-map-surface" tabIndex={0} viewBox={[view.x,view.z,view.w,view.h].join(' ')}
      aria-label="Harta. Përdor shigjetat për të lëvizur, plus dhe minus për zmadhim." role="img"
      onPointerDown={down} onPointerMove={move} onPointerUp={done} onPointerCancel={done} onLostPointerCapture={done}>
      <rect x={map.district.x} y={map.district.z} width={map.district.width} height={map.district.height} fill="#172d35"/>
      <path d={map.park} fill="#4c674f"/>
      <path d={map.water} fill="#3d7284"/>
      <path d={map.canal} stroke="#3d7284" strokeWidth="9" fill="none"/>
      <path d={map.road} stroke="#99a59f" strokeWidth="2" fill="none"/>
      <path d={map.foot} stroke="#778d7b" strokeWidth="1.35" fill="none"/>
      {map.points.filter(p=>Object.hasOwn(TOUR_NAMES,p.id)).map(p=><circle key={p.id} cx={p.x} cy={p.z}
        r={7*view.w/bounds.w} fill={favorites.includes(p.id)?'#ffd097':'#e4be7a'}/>)}
      {careerMarker&&<circle cx={careerMarker.x} cy={careerMarker.z} r="10" fill="none" stroke="#ffd097" strokeWidth="3" vectorEffect="non-scaling-stroke"/>}
      {player&&<g transform={`translate(${player.x} ${player.z}) rotate(${-player.yaw*180/Math.PI}) scale(${view.w/bounds.w})`}>
        <circle r="11" fill="#156976" stroke="#fbeed8" strokeWidth="2"/>
        <path d="M-4 -2 L0 9 L4 -2 Z" fill="#fff"/>
      </g>}
    </svg>
    <div className="tsc-map-controls" aria-label="Kontrollet e hartës">
      <button type="button" aria-label="Zmadho hartën" disabled={view.w<=bounds.w/8} onClick={()=>zoom(1.35)}>+</button>
      <button type="button" aria-label="Zvogëlo hartën" disabled={view.w>=bounds.w} onClick={()=>zoom(1/1.35)}>−</button>
      <button type="button" onClick={reset}>Qendër</button>
      <button type="button" aria-pressed={onlySaved} onClick={()=>filterSaved(v=>!v)}>Të preferuarat</button>
    </div>
    <p>Pikat e orientimit</p>
    {onlySaved&&!shown.length&&<p>Nuk ka pika të ruajtura në këtë pjesë të hartës.</p>}
    {shown.map(({id})=><div className="tsc-map-place" key={id}>
      <button type="button" aria-pressed={destination?.name===TOUR_NAMES[id]} onClick={()=>onSelect(id)}>{TOUR_NAMES[id]}</button>
      <button type="button" aria-label={`Ruaj: ${TOUR_NAMES[id]}`} aria-pressed={favorites.includes(id)}
        onClick={()=>toggle(id)}>{favorites.includes(id)?'★':'☆'}</button>
    </div>)}
    {saveNotice&&<small role="status">{saveNotice}</small>}
    <small>Harta tregon drejtimin, jo udhëzime rrugore.</small>
  </section>;
}
