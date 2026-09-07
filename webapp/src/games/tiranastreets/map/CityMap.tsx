import {memo, useEffect, useMemo, useRef, useState} from 'react';
import type {PointerEvent as PE} from 'react';
import {WORLD} from '../shared/world.mjs';
import type {State,Point} from '../shared/engine.mjs';
import {fitView, constrainView, panView, zoomView, screenPoint, inBounds, readFavorites, writeFavorites, MAX_FAVORITES} from './mapCore.mjs';
import './map.css';
type Place = Point & {id?:string; name:string; available?:boolean};
type Props = {player?:Point & {heading:number};state:State|null;route:Point[];large?:boolean;destination?:Place|null;onDestination?:(p:Place|null)=>void;routeNotice?:string};
type View = {x:number;z:number;w:number;h:number};
function storage() { try {return window.localStorage;} catch {return undefined;} }
const path = (points:number[][]) => points.length ? `M${points.map(p=>p.join(',')).join('L')}Z` : '';
const Geometry = memo(function Geometry() {
  const paths=useMemo(()=>({
    buildings:WORLD.buildings.map(b=>path(b.p)).join(''),
    parks:WORLD.parks.map(p=>path(p)).join(''),
    areas:WORLD.areas.map(p=>path(p)).join(''),
    water:WORLD.water.filter(p=>Array.isArray(p)).map(p=>path(p as number[][])).join(''),
    roads:WORLD.roads.reduce((out,r)=>{const key=`${r.walk?'walk':'road'}:${r.w}`;out[key]=(out[key]||'')+`M${r.a.join(',')}L${r.b.join(',')}`;return out;},{} as Record<string,string>)
  }),[]);
  return <g aria-hidden="true"><path d={paths.parks} fill="#274b3d" fillRule="evenodd"/><path d={paths.areas} fill="#455351"/>
    <path d={paths.water} fill="#246c84" fillRule="evenodd"/>
    {WORLD.water.filter(p=>!Array.isArray(p)).map((p:any,i)=><polyline key={i} points={p.line.map((a:number[])=>a.join(',')).join(' ')} fill="none" stroke="#246c84" strokeWidth={p.width}/>)}
    <path d={paths.buildings} fill="#465d66" stroke="#677b82" strokeWidth=".5"/>
    {Object.entries(paths.roads).map(([key,d])=><path key={key} d={d} fill="none" stroke={key.startsWith('walk')?'#78958a':'#bbc3b5'} strokeWidth={Number(key.split(':')[1])} strokeLinecap="round"/>)}</g>;
});
function Markers({player,state,route,scale,destination}:Props & {scale:number}) {
  return <g>{route.length>1&&<polyline points={route.map(p=>`${p.x},${p.z}`).join(' ')} fill="none" stroke="#d8fa69" strokeWidth={3*scale} strokeLinejoin="round"/>}
    {state?.cars.filter(c=>!c.driver).map(c=><rect key={c.id} x={c.x-3*scale} y={c.z-5*scale} width={6*scale} height={10*scale} fill="#80cad6"/>)}
    {state&&Object.values(state.players).map(p=><circle key={p.id} cx={p.x} cy={p.z} r={4*scale} fill="#f49268"/>)}
    {state&&<><rect x={state.shop.x-5*scale} y={state.shop.z-5*scale} width={10*scale} height={10*scale} fill="#d8fa69"/>
      {state.units.map(u=><circle key={u.id} cx={u.x} cy={u.z} r={4*scale} fill={u.model==='military-suv'?'#e0ac59':'#60adff'}/>)}
      {state.npcs.filter(n=>n.kind==='gang'&&n.health>0).map(n=><circle key={n.id} cx={n.x} cy={n.z} r={3*scale} fill="#f77b6a"/>)}</>}
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
  const [view,setView]=useState<View>(()=>fitView(WORLD.bounds,1)), liveView=useRef(view);
  const [width,setWidth]=useState(390),[selected,setSelected]=useState<Place|null>(destination||null),[query,setQuery]=useState(''),[tab,setTab]=useState('places');
  const [favorites,setFavorites]=useState<Place[]>(()=>readFavorites(storage(),WORLD)),[saveMessage,setSaveMessage]=useState('');
  const gesture=useRef<{view:View;points:{x:number;y:number}[];moved:boolean;multi:boolean}|null>(null);
  const change=(next:View)=>{liveView.current=next;setView(next);};
  useEffect(()=>{
    const el=svg.current;if(!el)return;
    const observer=new ResizeObserver(()=>{const r=el.getBoundingClientRect();if(!r.width||!r.height)return;setWidth(r.width);const v=liveView.current;const h=v.w*r.height/r.width;change(constrainView({...v,z:v.z+(v.h-h)/2,h},WORLD.bounds));});
    observer.observe(el);
    const wheel=(e:WheelEvent)=>{e.preventDefault();const r=el.getBoundingClientRect();change(zoomView(liveView.current,Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.006),screenPoint(liveView.current,{x:e.clientX,y:e.clientY},r),WORLD.bounds));};
    el.addEventListener('wheel',wheel,{passive:false});
    return()=>{observer.disconnect();el.removeEventListener('wheel',wheel);};
  },[]);
  const places=useMemo<Place[]>(()=>{
    const list=WORLD.landmarks.map(p=>({...p}));
    for(const b of WORLD.buildings)if(b.name?.trim()&&!list.some(p=>p.name===b.name))list.push({id:`building:${b.id}`,name:b.name,x:b.p.reduce((s,p)=>s+p[0],0)/b.p.length,z:b.p.reduce((s,p)=>s+p[1],0)/b.p.length});
    return list;
  },[]);
  const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const found=(tab==='favorites'?favorites:places).filter(p=>normalized(p.name).includes(normalized(query))).slice(0,40);
  const select=(p:Place)=>{setSelected(p);if(p.available===false)return;const v=liveView.current,w=Math.min(v.w,360),h=w*v.h/v.w;change(constrainView({x:p.x-w/2,z:p.z-h/2,w,h},WORLD.bounds));};
  const resetGesture=()=>{const points=[...pointers.current.values()];gesture.current=points.length?{view:{...liveView.current},points,moved:false,multi:points.length>1}:null;};
  const down=(e:PE<SVGSVGElement>)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const multi=!!gesture.current?.multi;resetGesture();if(multi&&gesture.current)gesture.current.multi=true;};
  const move=(e:PE<SVGSVGElement>)=>{
    if(!pointers.current.has(e.pointerId)||!gesture.current)return;
    pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const g=gesture.current,now=[...pointers.current.values()],r=e.currentTarget.getBoundingClientRect();
    if(now.length===1&&g.points.length===1){const dx=now[0].x-g.points[0].x,dy=now[0].y-g.points[0].y;if(Math.hypot(dx,dy)>5)g.moved=true;change(panView(g.view,dx,dy,r.width,r.height,WORLD.bounds));}
    else if(now.length>=2&&g.points.length>=2){g.multi=true;g.moved=true;const a=g.points,b=now,dist=(p:{x:number;y:number}[])=>Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),mid=(p:{x:number;y:number}[])=>({x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2});const before=mid(a),after=mid(b),anchor=screenPoint(g.view,before,r);const zoom=zoomView(g.view,dist(b)/Math.max(1,dist(a)),anchor,WORLD.bounds);change(panView(zoom,after.x-before.x,after.y-before.y,r.width,r.height,WORLD.bounds));}
  };
  const up=(e:PE<SVGSVGElement>,cancel=false)=>{
    const g=gesture.current;if(!pointers.current.has(e.pointerId))return;
    if(!cancel&&g&&!g.moved&&!g.multi){const p=screenPoint(liveView.current,{x:e.clientX,y:e.clientY},e.currentTarget.getBoundingClientRect());if(inBounds(p,WORLD.bounds)){const nearby=places.map(q=>({q,d:Math.hypot(q.x-p.x,q.z-p.z)})).filter(v=>v.d<14*liveView.current.w/width).sort((a,b)=>a.d-b.d)[0]?.q;setSelected(nearby||{...p,name:'Dropped pin',id:`pin:${Math.round(p.x)}:${Math.round(p.z)}`});}}
    pointers.current.delete(e.pointerId);resetGesture();if(gesture.current){gesture.current.moved=true;gesture.current.multi=true;}
  };
  const save=()=>{
    if(!selected)return;
    const existing=favorites.find(p=>Math.hypot(p.x-selected.x,p.z-selected.z)<1),id=selected.id||`pin:${Math.round(selected.x)}:${Math.round(selected.z)}`;
    if(!existing&&favorites.length>=MAX_FAVORITES){setSaveMessage(`Maximum ${MAX_FAVORITES} saved places.`);return;}
    const next=existing?favorites.map(p=>p===existing?{...selected,id:existing.id}:p):[...favorites,{...selected,id}];
    setFavorites(next);setSaveMessage(writeFavorites(storage(),next,WORLD)?'Saved on this device.':'Saved until this map closes; device storage is unavailable.');
  };
  const zoom=(factor:number)=>{const v=liveView.current;change(zoomView(v,factor,{x:v.x+v.w/2,z:v.z+v.h/2},WORLD.bounds));};
  const remove=(p:Place)=>{const next=favorites.filter(f=>f.id!==p.id);setFavorites(next);setSaveMessage(writeFavorites(storage(),next,WORLD)?'Removed from favourites.':'Storage is unavailable; removal applies until this map closes.');};
  const scale=view.w/width;
  return <div className="ts-explorer-map">
    <div className="ts-map-search"><input type="search" value={query} maxLength={80} placeholder="Search places or favourites" aria-label="Search Tirana places" onChange={e=>setQuery(e.target.value)}/></div>
    <div className="ts-map-viewport">
      <svg ref={svg} viewBox={`${view.x} ${view.z} ${view.w} ${view.h}`} preserveAspectRatio="none" role="application" aria-label="Interactive Tirana map. Drag to pan, pinch or use plus and minus to zoom. Tap to drop a pin." tabIndex={0}
        onPointerDown={down} onPointerMove={move} onPointerUp={e=>up(e)} onPointerCancel={e=>up(e,true)} onLostPointerCapture={e=>up(e,true)}
        onKeyDown={e=>{const delta=60;let next:View|undefined;if(e.key==='+'||e.key==='='){zoom(1.4);e.preventDefault();}else if(e.key==='-'){zoom(1/1.4);e.preventDefault();}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){const dx=e.key==='ArrowLeft'?-delta:e.key==='ArrowRight'?delta:0,dy=e.key==='ArrowUp'?-delta:e.key==='ArrowDown'?delta:0;next=panView(view,dx,dy,width,width*view.h/view.w,WORLD.bounds);change(next);e.preventDefault();}}}>
        <Geometry/>
        {WORLD.landmarks.map(p=><g key={p.id}><circle cx={p.x} cy={p.z} r={4*scale} fill="#f49268"/>{view.w<1100&&<text x={p.x+8*scale} y={p.z-7*scale} fontSize={11*scale} fill="#fff">{p.name}</text>}</g>)}
        {favorites.filter(p=>p.available!==false).map(p=><text key={p.id} x={p.x} y={p.z} textAnchor="middle" fontSize={17*scale} fill="#ffe19b">★</text>)}
        <Markers {...props} scale={scale}/>
        {selected&&selected.available!==false&&<circle cx={selected.x} cy={selected.z} r={11*scale} fill="none" stroke="#fff" strokeWidth={2*scale}/>}
      </svg>
      <span className="ts-map-compass" aria-label="North is up">↑ N</span>
      <div className="ts-map-zoom"><button onClick={()=>zoom(1.5)} aria-label="Zoom in">+</button><button onClick={()=>zoom(1/1.5)} aria-label="Zoom out">−</button><button onClick={()=>{const v=liveView.current;if(player)change(constrainView({...v,x:player.x-v.w/2,z:player.z-v.h/2},WORLD.bounds));}} disabled={!player} aria-label="Centre on player">◎</button><button onClick={()=>change(fitView(WORLD.bounds,view.w/view.h))} aria-label="Show whole city">▣</button></div>
      <span className="ts-map-scale">{Math.round(scale*70)} m<i aria-hidden="true"/></span>
    </div>
    {selected&&<section className="ts-map-selection" aria-label="Selected place">
      <input value={selected.name} maxLength={80} aria-label="Place name" onChange={e=>setSelected({...selected,name:e.target.value})}/>
      <div><button disabled={!selected.name.trim()||selected.available===false||!player} onClick={()=>onDestination?.(selected)}>Set direction</button><button disabled={!selected.name.trim()} onClick={save}>★ Save favourite</button></div>
      {selected.available===false&&<small>Saved place is outside the current playable district.</small>}
    </section>}
    {destination&&<div className="ts-map-route-status"><span>To {destination.name}<small>{props.routeNotice}</small></span><button onClick={()=>onDestination?.(null)}>Clear route</button></div>}
    <p className="ts-map-save-status" role="status">{saveMessage||'Drag to pan · Pinch to zoom · Tap a place or drop a pin'}</p>
    <div className="ts-map-tabs" role="tablist" aria-label="Place lists"><button role="tab" aria-selected={tab==='places'} onClick={()=>setTab('places')}>Places</button><button role="tab" aria-selected={tab==='favorites'} onClick={()=>setTab('favorites')}>Favourites ({favorites.length})</button></div>
    <div className="ts-map-place-list" role="tabpanel">{found.map(p=><div key={p.id}><button onClick={()=>select(p)}>{p.name}{p.available===false&&' · Outside district'}</button>{tab==='favorites'&&<button aria-label={`Remove ${p.name} from favourites`} onClick={()=>remove(p)}>×</button>}</div>)}{!found.length&&<p>No places found.</p>}</div>
  </div>;
}
