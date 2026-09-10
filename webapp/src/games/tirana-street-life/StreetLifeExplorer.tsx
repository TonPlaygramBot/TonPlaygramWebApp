import {useEffect,useId,useRef,useState} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {resolveNativeLandmarks} from '../tirana-landmarks/nativeLocations.mjs';
import {NativeLandmarkLayer} from '../tirana-landmarks/NativeLandmarkLayer';
import {StreetLifeLayer} from './StreetLifeLayer';
import {MatureTreeLayer} from './MatureTreeLayer';
import {FUEL_CANOPY_IDS} from './registry.mjs';
import {STREET_VIEWS,type StreetView} from './streetViews.mjs';
import './streetLifeExplorer.css';
const EMPTY_PHOTOS:Record<string,string>={};

/** Portrait review of the actual gameplay layers, on the same map coordinates.
 * Context shells are simplified; selecting a view never moves the game player. */
export default function StreetLifeExplorer({photos=EMPTY_PHOTOS}:{photos?:Record<string,string>}){
 const [selected,setSelected]=useState('statue'),[error,setError]=useState('');
 const host=useRef<HTMLDivElement>(null),select=useRef<(id:string)=>void>(()=>{}),label=useId();
 const current=useRef(selected),view=STREET_VIEWS.find(v=>v.id===selected)!;
 useEffect(()=>{
  if(!host.current)return;const mount=host.current;let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true});}catch{setError('3D is unavailable on this device. Reference links remain available.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.domElement.setAttribute('aria-label','Tirana street models. Drag to orbit; pinch to zoom.');mount.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color(0xb9ccd4);scene.fog=new T.Fog(0xb9ccd4,130,480);
  const camera=new T.PerspectiveCamera(48,1,.12,850),controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=5;controls.maxDistance=180;
  scene.add(new T.HemisphereLight(0xdceefa,0x8c8472,2.3));const sun=new T.DirectionalLight(0xffebd2,3.4);sun.position.set(-60,130,80);scene.add(sun);
  const streets=new StreetLifeLayer(),trees=new MatureTreeLayer(),native=new NativeLandmarkLayer(resolveNativeLandmarks(WORLD).landmarks);
  scene.add(streets.group,trees.group,native.group);
  let context=new T.Group(),active:StreetView=STREET_VIEWS[0];scene.add(context);
  const clear=()=>{context.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});scene.remove(context);context=new T.Group();scene.add(context);};
  const fit=()=>{
   const distance=active.distance*Math.max(1,.8/camera.aspect),normal=new T.Vector3(Math.sin(active.yaw),0,Math.cos(active.yaw));
   controls.target.set(active.x,active.y,active.z);camera.position.copy(controls.target).addScaledVector(normal,distance);camera.position.y+=active.id==='boulevard'?3:distance*.25;controls.update();
  };
  select.current=id=>{
   active=STREET_VIEWS.find(v=>v.id===id)!;clear();buildContext(context,active,native);fit();
   // The model budget is chosen around the inspected location, not a stale camera.
   streets.update(performance.now()/1000,active,false,true);trees.update(performance.now()/1000,active,false,true);
  };
  select.current(current.current);
  const resize=()=>{const w=Math.max(1,mount.clientWidth),h=Math.max(1,mount.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();fit();};
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(mount);resize();
  let visible=true,frame=0;const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;});observer.observe(mount);
  const render=()=>{if(visible&&!document.hidden)renderer.render(scene,camera);frame=requestAnimationFrame(render);};frame=requestAnimationFrame(render);
  return()=>{cancelAnimationFrame(frame);resizeObserver.disconnect();observer.disconnect();controls.dispose();streets.dispose();trees.dispose();native.dispose();clear();renderer.dispose();renderer.domElement.remove();select.current=()=>{};};
 },[]);
 useEffect(()=>{current.current=selected;select.current(selected);},[selected]);
 return <section className="tr-street-explorer" aria-label="Tirana street details">
  <label htmlFor={label}>TIRANA · STREETS</label>
  <select id={label} value={selected} onChange={e=>setSelected(e.target.value)}>{STREET_VIEWS.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>
  <div className="tr-street-canvas" ref={host}/>
  {error&&<p role="alert">{error}</p>}
  <div className="tr-street-caption" aria-live="polite">{view.name}<span>Drag to orbit · Pinch to zoom</span></div>
  {view.photo&&<figure><img src={photos[view.photo]||`/assets/tirana-streets/references/${view.photo}`} alt={`${view.name}, photographic reference`}/><figcaption><a href={view.source} target="_blank" rel="noreferrer">{view.credit}</a></figcaption></figure>}
  {!view.photo&&<a href={view.source} target="_blank" rel="noreferrer">Location reference ↗</a>}
  <small>© OpenStreetMap contributors · Photo-informed models; sizes and frontage details are approximate. Context buildings are simplified.</small>
 </section>;
}

function buildContext(group:T.Group,view:StreetView,native:NativeLandmarkLayer){
 const radius=view.context,buckets=new Map<number,T.BufferGeometry[]>();
 const add=(color:number,g:T.BufferGeometry)=>{if(!buckets.has(color))buckets.set(color,[]);buckets.get(color)!.push(g);};
 const nativeIds=new Set(native.lods.map(l=>l.userData.buildingId));
 const near=(p:readonly number[])=>Math.hypot(p[0]-view.x,p[1]-view.z)<radius;
 add(0xb4b5a8,new T.PlaneGeometry(radius*2.4,radius*2.4).rotateX(-Math.PI/2).translate(view.x,-.06,view.z));
 // Paths, planted areas, water and buildings come from the existing game map.
 for(const area of WORLD.parks){
  if(!area.some(near))continue;const shape=new T.Shape(area.map(p=>new T.Vector2(p[0],-p[1])));
  add(0x6e8154,new T.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,-.03,0));
 }
 for(const road of WORLD.roads){
  if(!near(road.a)&&!near(road.b))continue;
  const dx=road.b[0]-road.a[0],dz=road.b[1]-road.a[1],length=Math.hypot(dx,dz),x=(road.a[0]+road.b[0])/2,z=(road.a[1]+road.b[1])/2;
  const strip=(w:number,h:number,y:number,color:number)=>add(color,new T.BoxGeometry(w,h,length).rotateY(Math.atan2(dx,dz)).translate(x,y,z));
  if(!road.walk)strip(road.w+3.2,.12,.005,0xbfc0b4);strip(road.w,.055,.08,road.walk?0xc6c4b7:0x777d79);
 }
 for(const b of WORLD.buildings){
  if(!b.p.some(near)||FUEL_CANOPY_IDS.has(b.id)||nativeIds.has(b.id))continue;
  const shape=new T.Shape(b.p.map(p=>new T.Vector2(p[0],-p[1])));
  const geo=new T.ExtrudeGeometry(shape,{depth:b.h,bevelEnabled:false,steps:1});geo.rotateX(-Math.PI/2);
  add([0xcebd9f,0xc5b5a0,0xd4c8b3,0xbdc2b5][Number(b.id)%4],geo);
  for(let i=0;i<b.p.length;i++){
   const a=b.p[i],c=b.p[(i+1)%b.p.length],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz);if(len<3)continue;
   for(let y=4.4;y<b.h-1;y+=3.4)for(let d=1.6;d<len-1;d+=3.2)add(0x647477,new T.BoxGeometry(1.15,1.55,.11).rotateY(-Math.atan2(dz,dx)).translate(a[0]+dx*d/len,y,a[1]+dz*d/len));
  }
 }
 native.lods.forEach(l=>l.visible=Math.hypot(l.position.x-view.x,l.position.z-view.z)<radius);
 for(const [color,geos] of buckets){const expanded=geos.map(g=>g.index?g.toNonIndexed():g),geometry=mergeGeometries(expanded)!;new Set([...expanded,...geos]).forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.9}));mesh.receiveShadow=true;group.add(mesh);}
}
