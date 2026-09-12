import {memo, useEffect, useMemo, useRef, useState} from 'react';
import type {PointerEvent as PE} from 'react';
import {WORLD} from '../shared/world.mjs';
import {NEIGHBOURHOOD} from '../../tirana-neighbourhood/data.mjs';
import type {State,Point} from '../shared/engine.mjs';
import {fitView, constrainView, panView, zoomView, screenPoint, inBounds, readFavorites, writeFavorites, MAX_FAVORITES} from './mapCore.mjs';
import './map.css';
import {expandedAtlasBounds,atlasPin} from './atlasExtent.mjs';
import {civicSites,referenceLinks,unproject,REFERENCES,project} from '../../tirana-expansion/geography.mjs';
type Place = Point & {id?:string; name:string; available?:boolean};
type Props = {player?:Point & {heading:number};state:State|null;route:Point[];large?:boolean;destination?:Place|null;onDestination?:(p:Place|null)=>void;routeNotice?:string};
type View = {x:number;z:number;w:number;h:number};
// Additional atlas extent only. The original city, physics and routing keep WORLD.bounds.
const REGIONAL_TERMINALS = Object.values(REFERENCES).map(ref=>({...ref,...project(WORLD.origin,ref.latitude,ref.longitude)}));
const ATLAS_BOUNDS = expandedAtlasBounds(WORLD.bounds,REGIONAL_TERMINALS);
function RegionalReferences({scale}:{scale:number}) {
  const [lower,upper]=REGIONAL_TERMINALS,b=WORLD.bounds;
  return <g aria-label="Dajti regional references; connecting road coverage is not yet available">
    <rect x={b[0]} y={b[1]} width={b[2]-b[0]} height={b[3]-b[1]} fill="none" stroke="#9fb6bc" strokeWidth={scale} strokeDasharray={`${5*scale} ${4*scale}`}/>
    <text x={b[0]} y={b[3]+16*scale} fontSize={10*scale} fill="#c3d5d7">Existing playable Tirana</text>
    <line x1={lower.x} y1={lower.z} x2={upper.x} y2={upper.z} stroke="#e5cf91" strokeWidth={2*scale} strokeDasharray={`${6*scale} ${4*scale}`}><title>Approximate cable-car alignment, not a drivable road</title></line>
    {REGIONAL_TERMINALS.map((p,i)=><g key={p.id}><circle cx={p.x} cy={p.z} r={6*scale} fill="#e5cf91" stroke="#122c36" strokeWidth={2*scale}/><text x={p.x+(i?-9:9)*scale} y={p.z-11*scale} textAnchor={i?'end':'start'} fontSize={11*scale} fill="#f3e5bf">{i?'Dajti · upper station':'Dajti · lower station'}</text></g>)}
  </g>;
}
function storage() { try {return window.localStorage;} catch {return undefined;} }
const path = (points:number[][]) => points.length ? `M${points.map(p=>p.join(',')).join('L')}Z` : '';
const ringDirection=(p:number[][],positive:boolean)=>{
 const area=p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0);
 return (area>0)===positive?p:[...p].reverse();
};
const Geometry = memo(function Geometry() {
  const paths=useMemo(()=>({
    buildings:WORLD.buildings.map(b=>path(ringDirection(b.p,true))+(b.holes??[]).map(h=>path(ringDirection(h,false))).join('')).join(''),
    parks:WORLD.parks.map(p=>path(p)).join(''),
    areas:WORLD.areas.map(p=>path(p)).join(''),
    water:WORLD.water.filter(p=>Array.isArray(p)).map(p=>path(p as number[][])).join('')+NEIGHBOURHOOD.water.flatMap(w=>w.polygons??[]).map(p=>path(p.outer)+p.holes.map(path).join('')).join(''),
    roads:WORLD.roads.reduce((out,r)=>{const key=`${r.walk?'walk':'road'}:${r.w}`;out[key]=(out[key]||'')+`M${r.a.join(',')}L${r.b.join(',')}`;return out;},{} as Record<string,string>)
  }),[]);
  return <g aria-hidden="true"><path d={paths.parks} fill="#274b3d" fillRule="evenodd"/><path d={paths.areas} fill="#455351"/>
    <path d={paths.water} fill="#246c84" fillRule="evenodd"/>
    {WORLD.water.filter(p=>!Array.isArray(p)).map((p:any,i)=><polyline key={i} points={p.line.map((a:number[])=>a.join(',')).join(' ')} fill="none" stroke="#246c84" strokeWidth={p.width}/>)}
    <path d={paths.buildings} fill="#465d66" fillRule="nonzero" stroke="#677b82" strokeWidth=".5"/>
    {Object.entries(paths.roads).map(([key,d])=><path key={key} d={d} fill="none" stroke={key.startsWith('walk')?'#78958a':'#bbc3b5'} strokeWidth={Number(key.split(':')[1])} strokeLinecap="round"/>)}</g>;
});
function Markers({player,state,route,scale,destination}:Props & {scale:number}) {
  return <g>{route.length>1&&<polyline points={route.map(p=>`${p.x},${p.z}`).join(' ')} fill="none" stroke="#d8fa69" strokeWidth={3*scale} strokeLinejoin="round"/>}
    {state?.cars.filter(c=>!c.driver).map(c=><rect key={c.id} x={c.x-3*scale} y={c.z-5*scale} width={6*scale} height={10*scale} fill="#80cad6"/>)}
    {state&&Object.values(state.players).map(p=><circle key={p.id} cx={p.x} cy={p.z} r={4*scale} fill="#f49268"/>)}
    {state&&<>{(state.shops||[state.shop]).map(s=><rect key={s.id||s.name} x={s.x-5*scale} y={s.z-5*scale} width={10*scale} height={10*scale} fill="#d8fa69"><title>{s.name}</title></rect>)}{state.traffic.filter(c=>c.model==='tirana-bus').map(c=><rect key={c.id} x={c.x-3*scale} y={c.z-6*scale} width={6*scale} height={12*scale} fill="#64cc8a"><title>{c.routeName}</title></rect>)}
      {state.units.map(u=><circle key={u.id} cx={u.x} cy={u.z} r={4*scale} fill={u.model==='military-suv'?'#e0ac59':'#60adff'}/>)}
      {state.npcs.filter(n=>n.kind==='gang'&&n.health>0).map(n=><circle key={n.id} cx={n.x} cy={n.z} r={3*scale} fill={'#f77b6a'}/>)}</>}
    {destination&&<g><circle cx={destination.x} cy={destination.z} r={8*scale} fill="#ed9168" stroke="#fff" strokeWidth={2*scale}/><circle cx={destination.x} cy={destination.z} r={2*scale} fill="#fff"/></g>}
    {player&&<g transform={`translate(${player.x} ${player.z}) rotate(${(-player.heading*180)/Math.PI})`}><circle r={10*scale} fill="#d8fa69" opacity=".25"/><path d={`M0 ${-9*scale}L${6*scale} ${7*scale}L0 ${4*scale}L${-6*scale} ${7*scale}Z`} fill="#f2ffcd" stroke="#12282f" strokeWidth={scale}/></g>}
  </g>;
}
export function CityMap(props:Props) {
  if(props.large)return <ExplorerMap {...props}/>;
  const p=props.player,v=p?`${p.x-120} ${p.z-120} 240 240`:'-150 0 300 300';
  return <div className="ts-minimap"><svg viewBox={v} aria-label="Tirana minimap, north up"><Geometry/><Markers {...props} scale={1}/></svg><span className="ts-north">N</span></div>;
}
function ExplorerMap(props:Props) {
  const {player,destination,onDestination}=props;
  const svg=useRef<SVGSVGElement>(null), pointers=useRef(new Map<number,{x:number;y:number}>());
  const [view,setView]=useState<View>(()=>fitView(WORLD.bounds,1)), liveView=useRef(view), measured=useRef(false);
  const [width,setWidth]=useState(390),[selected,setSelected]=useState<Place|null>(destination||null),[query,setQuery]=useState(''),[tab,setTab]=useState('places');
  const [favorites,setFavorites]=useState<Place[]>(()=>readFavorites(storage(),WORLD)),[saveMessage,setSaveMessage]=useState('');
  const gesture=useRef<{view:View;points:{x:number;y:number}[];moved:boolean;multi:boolean}|null>(null);
  const change=(next:View)=>{liveView.current=next;setView(next);};
  useEffect(()=>{
    const el=svg.current;if(!el)return;
    const observer=new ResizeObserver(()=>{const r=el.getBoundingClientRect();if(!r.width||!r.height)return;setWidth(r.width);const v=liveView.current;const h=v.w*r.height/r.width;change(constrainView({...v,z:v.z+(v.h-h)/2,h},measured.current?ATLAS_BOUNDS:WORLD.bounds));measured.current=true;});
    observer.observe(el);
    const wheel=(e:WheelEvent)=>{e.preventDefault();const r=el.getBoundingClientRect();change(zoomView(liveView.current,Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.006),screenPoint(liveView.current,{x:e.clientX,y:e.clientY},r),ATLAS_BOUNDS));};
    el.addEventListener('wheel',wheel,{passive:false});
    return()=>{observer.disconnect();el.removeEventListener('wheel',wheel);};
  },[]);
  const places=useMemo<Place[]>(()=>{
    const list:Place[]=WORLD.landmarks.map(p=>({...p}));
    for(const ref of Object.values(REFERENCES))list.push({id:ref.id,name:ref.name,...project(WORLD.origin,ref.latitude,ref.longitude),available:false});
    for(const site of civicSites(WORLD))if(!list.some(p=>p.name===site.name))list.push({id:site.id,name:site.name,x:site.x,z:site.z});
    for(const b of WORLD.buildings)if(b.name?.trim()&&!list.some(p=>p.name===b.name))list.push({id:`building:${b.id}`,name:b.name,x:b.p.reduce((s,p)=>s+p[0],0)/b.p.length,z:b.p.reduce((s,p)=>s+p[1],0)/b.p.length});
    const ids=new Set(list.map(p=>p.id));
    for(const p of NEIGHBOURHOOD.places)if(p.name?.trim()&&!ids.has(p.id)){list.push({id:p.id,name:p.name,x:p.point[0],z:p.point[1]});ids.add(p.id);}
    return list;
  },[]);
  const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const found=(tab==='favorites'?favorites:places).filter(p=>normalized(p.name).includes(normalized(query))).slice(0,40);
  const select=(p:Place)=>{setSelected(p);if(!inBounds(p,ATLAS_BOUNDS))return;pointers.current.clear();gesture.current=null;const v=liveView.current,w=Math.min(v.w,360),h=w*v.h/v.w;change(constrainView({x:p.x-w/2,z:p.z-h/2,w,h},ATLAS_BOUNDS));};
  const resetGesture=()=>{const points=[...pointers.current.values()];gesture.current=points.length?{view:{...liveView.current},points,moved:false,multi:points.length>1}:null;};
  const down=(e:PE<SVGSVGElement>)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const multi=!!gesture.current?.multi;resetGesture();if(multi&&gesture.current)gesture.current.multi=true;};
  const move=(e:PE<SVGSVGElement>)=>{
    if(!pointers.current.has(e.pointerId)||!gesture.current)return;
    pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const g=gesture.current,now=[...pointers.current.values()],r=e.currentTarget.getBoundingClientRect();
    if(now.length===1&&g.points.length===1){const dx=now[0].x-g.points[0].x,dy=now[0].y-g.points[0].y;if(Math.hypot(dx,dy)>5)g.moved=true;change(panView(g.view,dx,dy,r.width,r.height,ATLAS_BOUNDS));}
    else if(now.length>=2&&g.points.length>=2){g.multi=true;g.moved=true;const a=g.points,b=now,dist=(p:{x:number;y:number}[])=>Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),mid=(p:{x:number;y:number}[])=>({x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2});const before=mid(a),after=mid(b),anchor=screenPoint(g.view,before,r);const zoom=zoomView(g.view,dist(b)/Math.max(1,dist(a)),anchor,ATLAS_BOUNDS);change(panView(zoom,after.x-before.x,after.y-before.y,r.width,r.height,ATLAS_BOUNDS));}
  };
  const up=(e:PE<SVGSVGElement>,cancel=false)=>{
    const g=gesture.current;if(!pointers.current.has(e.pointerId))return;
    if(!cancel&&g&&!g.moved&&!g.multi){const p=screenPoint(liveView.current,{x:e.clientX,y:e.clientY},e.currentTarget.getBoundingClientRect());if(inBounds(p,ATLAS_BOUNDS)){const nearby=places.map(q=>({q,d:Math.hypot(q.x-p.x,q.z-p.z)})).filter(v=>v.d<14*liveView.current.w/width).sort((a,b)=>a.d-b.d)[0]?.q;setSelected(atlasPin(nearby||{...p,name:'Dropped pin',id:`pin:${Math.round(p.x)}:${Math.round(p.z)}`},WORLD.bounds));}}
    pointers.current.delete(e.pointerId);resetGesture();if(gesture.current){gesture.current.moved=true;gesture.current.multi=true;}
  };
  const save=()=>{
    if(!selected)return;
    const existing=favorites.find(p=>Math.hypot(p.x-selected.x,p.z-selected.z)<1),id=selected.id||`pin:${Math.round(selected.x)}:${Math.round(selected.z)}`;
    if(!existing&&favorites.length>=MAX_FAVORITES){setSaveMessage(`Maximum ${MAX_FAVORITES} saved places.`);return;}
    const next=existing?favorites.map(p=>p===existing?{...selected,id:existing.id}:p):[...favorites,{...selected,id}];
    setFavorites(next);setSaveMessage(writeFavorites(storage(),next,WORLD)?'Saved on this device.':'Saved until this map closes; device storage is unavailable.');
  };
  const zoom=(factor:number)=>{const v=liveView.current;change(zoomView(v,factor,{x:v.x+v.w/2,z:v.z+v.h/2},ATLAS_BOUNDS));};
  const remove=(p:Place)=>{const next=favorites.filter(f=>f.id!==p.id);setFavorites(next);setSaveMessage(writeFavorites(storage(),next,WORLD)?'Removed from favourites.':'Storage is unavailable; removal applies until this map closes.');};
  const scale=view.w/width;
  const regionVisible=view.x+view.w>WORLD.bounds[2]+100||view.z<WORLD.bounds[1]-100;
  const fit=(bounds:readonly number[])=>{pointers.current.clear();gesture.current=null;change(fitView(bounds,view.w/view.h));};
  return <div className="ts-explorer-map">
    <div className="ts-map-search"><input type="search" value={query} maxLength={80} placeholder="Search places or favourites" aria-label="Search Tirana places" onChange={e=>setQuery(e.target.value)}/></div>
    <div className="ts-map-tabs" role="group" aria-label="Map extent"><button onClick={()=>fit(WORLD.bounds)}>Tirana + Ali Demi</button><button onClick={()=>fit(ATLAS_BOUNDS)}>Tirana + Dajti</button></div>
    <div className="ts-map-viewport">
      <svg ref={svg} viewBox={`${view.x} ${view.z} ${view.w} ${view.h}`} preserveAspectRatio="none" role="application" aria-label="Interactive Tirana map. Drag to pan, pinch or use plus and minus to zoom. Tap to drop a pin." tabIndex={0}
        onPointerDown={down} onPointerMove={move} onPointerUp={e=>up(e)} onPointerCancel={e=>up(e,true)} onLostPointerCapture={e=>up(e,true)}
        onKeyDown={e=>{const delta=60;let next:View|undefined;if(e.key==='+'||e.key==='='){zoom(1.4);e.preventDefault();}else if(e.key==='-'){zoom(1/1.4);e.preventDefault();}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){const dx=e.key==='ArrowLeft'?-delta:e.key==='ArrowRight'?delta:0,dy=e.key==='ArrowUp'?-delta:e.key==='ArrowDown'?delta:0;next=panView(view,dx,dy,width,width*view.h/view.w,ATLAS_BOUNDS);change(next);e.preventDefault();}}}>
        <Geometry/>
        {regionVisible&&<RegionalReferences scale={scale}/>}
        {WORLD.landmarks.map(p=><g key={p.id}><circle cx={p.x} cy={p.z} r={4*scale} fill="#f49268"/>{view.w<1100&&<text x={p.x+8*scale} y={p.z-7*scale} fontSize={11*scale} fill="#fff">{p.name}</text>}</g>)}
        {favorites.filter(p=>inBounds(p,ATLAS_BOUNDS)).map(p=><text key={p.id} x={p.x} y={p.z} textAnchor="middle" fontSize={17*scale} fill="#ffe19b">★</text>)}
        <Markers {...props} scale={scale}/>
        {selected&&inBounds(selected,ATLAS_BOUNDS)&&<circle cx={selected.x} cy={selected.z} r={11*scale} fill="none" stroke="#fff" strokeWidth={2*scale}/>}
      </svg>
      <span className="ts-map-compass" aria-label="North is up">↑ N</span>
      <div className="ts-map-zoom"><button onClick={()=>zoom(1.5)} aria-label="Zoom in">+</button><button onClick={()=>zoom(1/1.5)} aria-label="Zoom out">−</button><button onClick={()=>{const v=liveView.current;if(player)change(constrainView({...v,x:player.x-v.w/2,z:player.z-v.h/2},ATLAS_BOUNDS));}} disabled={!player} aria-label="Centre on player">◎</button><button onClick={()=>fit(WORLD.bounds)} aria-label="Show whole city">▣</button></div>
      <span className="ts-map-scale">{Math.round(scale*70)} m<i aria-hidden="true"/></span>
    </div>
    {regionVisible&&<p className="ts-map-save-status" role="status">Dajti regional view: the original city is unchanged. The dashed line represents the approximate cable-car alignment, not a road. The intervening road network and playable mountain terrain are not included yet.</p>}
    {selected&&<section className="ts-map-selection" aria-label="Selected place">
      <input value={selected.name} maxLength={80} aria-label="Place name" onChange={e=>setSelected({...selected,name:e.target.value})}/>
      <div><button disabled={!onDestination||!selected.name.trim()||selected.available===false||!player} onClick={()=>onDestination?.(selected)}>Set direction</button><button disabled={!selected.name.trim()} onClick={save}>★ Save favourite</button></div>
      {selected.available===false&&<small>This place is outside the current playable district. You can save it, but directions are unavailable.</small>}
      <small>{unproject(WORLD.origin,selected).latitude.toFixed(7)}° N · {unproject(WORLD.origin,selected).longitude.toFixed(7)}° E</small>
      <div className="ts-map-references"><a href={referenceLinks(WORLD.origin,selected).satellite} target="_blank" rel="noopener noreferrer">Satellite reference ↗</a><a href={referenceLinks(WORLD.origin,selected).streetView} target="_blank" rel="noopener noreferrer">Street View ↗</a><a href={referenceLinks(WORLD.origin,selected).openMap} target="_blank" rel="noopener noreferrer">OSM ↗</a></div>
      <small>Source-map position, not a survey guarantee. Reference imagery opens separately; no imagery is copied into the game.</small>
    </section>}
    {destination&&<div className="ts-map-route-status"><span>To {destination.name}<small>{props.routeNotice}</small></span><button onClick={()=>onDestination?.(null)}>Clear route</button></div>}
    <p className="ts-map-save-status" role="status">{saveMessage||'Drag to pan · Pinch to zoom · Tap a place or drop a pin'}</p>
    <div className="ts-map-tabs" role="tablist" aria-label="Place lists"><button role="tab" aria-selected={tab==='places'} onClick={()=>setTab('places')}>Places</button><button role="tab" aria-selected={tab==='favorites'} onClick={()=>setTab('favorites')}>Favourites ({favorites.length})</button></div>
    <div className="ts-map-place-list" role="tabpanel">{found.map(p=><div key={p.id}><button onClick={()=>select(p)}>{p.name}{p.available===false&&' · Outside district'}</button>{tab==='favorites'&&<button aria-label={`Remove ${p.name} from favourites`} onClick={()=>remove(p)}>×</button>}</div>)}{!found.length&&<p>No places found.</p>}</div>
  </div>;
}
