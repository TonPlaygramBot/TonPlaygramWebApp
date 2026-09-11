import {lazy,Suspense,useMemo,useRef,useState} from 'react';
import type {PointerEvent as PE} from 'react';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {fitView,panView,zoomView,screenPoint} from '../tiranastreets/map/mapCore.mjs';
import {regionalBounds,regionalReferences,referenceLinks,REGION_STATUS} from './regionCore.mjs';
import './region.css';
const PanoramaPreview=lazy(()=>import('./PanoramaPreview'));
type P={x:number;z:number};type V=P&{w:number;h:number};
const bounds=regionalBounds(WORLD.origin,WORLD.bounds),places=regionalReferences(WORLD.origin);
/** Regional planning atlas, deliberately not a substitute for playable roads. */
export function RegionalAtlas({player}:{player?:P}){
 const [panorama,setPanorama]=useState(false);
 const [view,setView]=useState<V>(()=>fitView(bounds,390/480)),[selected,setSelected]=useState(places[0]);
 const live=useRef(view),pointers=useRef(new Map<number,{x:number;y:number}>()),gesture=useRef<{view:V;points:{x:number;y:number}[]}|null>(null);
 const change=(v:V)=>{live.current=v;setView(v);};
 const reset=()=>{gesture.current={view:{...live.current},points:[...pointers.current.values()]};};
 const down=(e:PE<SVGSVGElement>)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});reset();};
 const move=(e:PE<SVGSVGElement>)=>{if(!pointers.current.has(e.pointerId)||!gesture.current)return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const g=gesture.current,p=[...pointers.current.values()],r=e.currentTarget.getBoundingClientRect();if(p.length===1&&g.points.length===1)change(panView(g.view,p[0].x-g.points[0].x,p[0].y-g.points[0].y,r.width,r.height,bounds));else if(p.length>=2&&g.points.length>=2){const middle=(a:{x:number;y:number}[])=>({x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}),distance=(a:{x:number;y:number}[])=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),before=middle(g.points),after=middle(p),v=zoomView(g.view,distance(p)/Math.max(1,distance(g.points)),screenPoint(g.view,before,r),bounds);change(panView(v,after.x-before.x,after.y-before.y,r.width,r.height,bounds));}};
 const end=(e:PE<SVGSVGElement>)=>{pointers.current.delete(e.pointerId);reset();};
 const zoom=(scale:number)=>{pointers.current.clear();gesture.current=null;const v=live.current;change(zoomView(v,scale,{x:v.x+v.w/2,z:v.z+v.h/2},bounds));};
 const cityRoads=useMemo(()=>WORLD.roads.map(r=>`M${r.a.join(',')}L${r.b.join(',')}`).join(''),[]);
 const s=view.w/390,b=WORLD.bounds,links=referenceLinks(selected);
 return <section className="tr-region" aria-label="Greater Tirana regional atlas">
  <header><strong>RINAS · TIRANË · DAJTI · VAQARR · SAUK · FARKË</strong><span>Regional coverage / source review</span></header>
  <button onClick={()=>setPanorama(p=>!p)} aria-expanded={panorama}>PANORAMA NGA DAJTI</button>
  {panorama&&<Suspense fallback={<p role="status">Duke hapur panoramën…</p>}><PanoramaPreview/></Suspense>}
  <div className="tr-region-map">
   <svg viewBox={`${view.x} ${view.z} ${view.w} ${view.h}`} preserveAspectRatio="none" role="application" aria-label="Regional map. Drag in the direction you want the map to move; pinch to zoom." tabIndex={0} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={e=>{if(e.key==='+'||e.key==='='){zoom(1.4);e.preventDefault();}else if(e.key==='-'){zoom(1/1.4);e.preventDefault();}else if(e.key.startsWith('Arrow')){const v=live.current;change(panView(v,e.key==='ArrowRight'?40:e.key==='ArrowLeft'?-40:0,e.key==='ArrowDown'?40:e.key==='ArrowUp'?-40:0,390,480,bounds));e.preventDefault();}}}>
    <rect x={b[0]} y={b[1]} width={b[2]-b[0]} height={b[3]-b[1]} fill="#2d4c4c" stroke="#adc2b9" strokeWidth={s}/>
    <path d={cityRoads} fill="none" stroke="#b9c4b2" strokeWidth={Math.max(3,.65*s)}/>
    <text x={b[0]} y={b[3]+19*s} fontSize={11*s} fill="#d1d9ca">Existing playable city</text>
    {places.map(p=><g key={p.id}><circle cx={p.x} cy={p.z} r={5*s} fill={p.id===selected.id?'#f7d089':'#bdc9b3'}/><text x={p.x+9*s} y={p.z-9*s} fontSize={10*s} fill="#f3e6cd">{p.id==='dajti-upper'?'Dajti · upper':p.id==='dajti-lower'?'Dajti · lower':p.id==='dajti-summit'?'Dajti · summit':p.name}</text></g>)}
    {player&&<circle cx={player.x} cy={player.z} r={4*s} fill="#d9ff7a"/>}
   </svg>
   <span className="tr-north">N ↑</span><div className="tr-zoom"><button aria-label="Zoom in" onClick={()=>zoom(1.6)}>+</button><button aria-label="Zoom out" onClick={()=>zoom(1/1.6)}>−</button><button onClick={()=>{pointers.current.clear();gesture.current=null;change(fitView(bounds,390/480));}}>FIT</button></div>
  </div>
  <p className="tr-notice">{REGION_STATUS} No ring-road line is invented between these reference points.</p>
  <div className="tr-place-buttons">{places.map(p=><button key={p.id} aria-pressed={selected.id===p.id} onClick={()=>setSelected(p)}>{p.name}</button>)}</div>
  <section className="tr-reference"><strong>{selected.name}</strong><small>{selected.latitude.toFixed(7)}° N · {selected.longitude.toFixed(7)}° E</small><p>{selected.accuracy}. Reference only; directions are not enabled outside existing playable coverage.</p><div><a href={links.satellite} target="_blank" rel="noopener noreferrer">Satellite ↗</a><a href={links.streetView} target="_blank" rel="noopener noreferrer">Street View ↗</a><a href={links.earth} target="_blank" rel="noopener noreferrer">Earth ↗</a><a href={links.osm} target="_blank" rel="noopener noreferrer">OSM ↗</a></div></section>
  <small className="tr-attribution">Map data © OpenStreetMap contributors. Acquisition envelope is authored; no Google imagery or geometry is embedded.</small>
 </section>;
}
