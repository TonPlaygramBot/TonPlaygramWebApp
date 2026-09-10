import {useEffect,useId,useRef,useState} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {ReferenceFacades} from './ReferenceFacades';
import {InstitutionLayer} from './InstitutionLayer';
import {CITY_PLACES} from './registry.mjs';
import {RiniaFountain} from './RiniaFountain';
import {LANDMARK_CATALOG} from './landmarkCatalog.mjs';
import {LANDMARK_DATA} from './allLandmarks.mjs';
import './landmarkExplorer.css';

const EMPTY_PHOTOS:Record<string,string>={};

/** Uses the same meshes as gameplay. Never teleports players outside WORLD.
 * Camera fitting uses the current portrait aspect ratio and the whole campus. */
export default function LandmarkExplorer({photos=EMPTY_PHOTOS}:{photos?:Record<string,string>}) {
 const [selected,setSelected]=useState('namazgja'),[error,setError]=useState('');
 const host=useRef<HTMLDivElement>(null),select=useRef<(id:string)=>void>(()=>{});
 const selection=useRef(selected),labelId=useId();
 const site=LANDMARK_CATALOG[selected];
 const buildings=LANDMARK_DATA.buildings.filter(b=>b.site===selected);
 const inCity=buildings.every(b=>b.p.every(([x,z])=>x>=-805&&x<=660&&z>=-380&&z<=1150));
 useEffect(()=>{
  if(!host.current)return;
  const mount=host.current;
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true});}catch{setError('3D is unavailable on this device. Building references are available below.');return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.domElement.setAttribute('aria-label','Tirana building model. Drag to orbit; pinch to zoom.');
  mount.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color(0xbecbd1);
  const camera=new T.PerspectiveCamera(42,1,.2,5000);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;
  controls.maxPolarAngle=Math.PI*.49;controls.minDistance=10;controls.maxDistance=2400;
  scene.add(new T.HemisphereLight(0xe4f0fc,0x8a8576,2.6));
  const sun=new T.DirectionalLight(0xffeacf,3);sun.position.set(-150,250,150);scene.add(sun);
  let layer:ReferenceFacades|undefined, identities:InstitutionLayer|undefined;
  const fountain=new RiniaFountain();scene.add(fountain.group);
  const ground=new T.Mesh(new T.PlaneGeometry(1800,1800),new T.MeshStandardMaterial({color:0x9ea595,roughness:1}));
  ground.rotation.x=-Math.PI/2;scene.add(ground);
  let selectedId=selection.current;
  const fit=()=>{
   const bounds=new T.Box3();
   const wanted=new Set(LANDMARK_DATA.buildings.filter(b=>b.site===selectedId).map(b=>b.id));
   layer?.group.children.forEach(g=>{if(wanted.has(g.userData.osmWay))bounds.expandByObject(g);});
   fountain.group.visible=selectedId==='taivani';if(fountain.group.visible)bounds.expandByObject(fountain.group);
   if(bounds.isEmpty())return;
   const centre=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
   const radius=size.length()/2;
   const halfFov=Math.min(T.MathUtils.degToRad(camera.fov)/2,Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov)/2)*camera.aspect));
   const distance=radius/Math.sin(halfFov)*1.12;
   camera.position.copy(centre).add(new T.Vector3(-.75,.67,1).normalize().multiplyScalar(distance));
   controls.target.copy(centre);controls.maxDistance=Math.max(500,distance*2.5);controls.update();
   ground.position.set(centre.x,-.035,centre.z);
  };
  select.current=id=>{
   if(selectedId===id&&layer)return;
   selectedId=id;layer?.dispose();identities?.dispose();
   layer=new ReferenceFacades(undefined,new Set(LANDMARK_DATA.buildings.filter(b=>b.site===id).map(b=>b.id)));
   scene.add(layer.group);
   const ids=new Set(LANDMARK_DATA.buildings.filter(b=>b.site===id).map(b=>b.id));
   identities=new InstitutionLayer(CITY_PLACES.sites.filter(s=>ids.has(s.buildingId)),[],country=>photos['flag-'+country]||`/assets/tirana-streets/flags/${country.toLowerCase()}.svg`);
   scene.add(identities.group);identities.group.children.forEach(g=>g.visible=true);fit();
  };
  select.current(selectedId);
  const resize=()=>{const w=Math.max(1,mount.clientWidth),h=Math.max(1,mount.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();fit();};
  const observer=new ResizeObserver(resize);observer.observe(mount);resize();
  let visible=true,frame=0;const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;});visibility.observe(mount);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const render=(ms:number)=>{if(visible&&!document.hidden){identities?.update(reduced.matches?0:ms/1000);if(selectedId==='taivani')fountain.update(reduced.matches?0:ms/1000);renderer.render(scene,camera);}frame=requestAnimationFrame(render);};
  frame=requestAnimationFrame(render);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();controls.dispose();layer?.dispose();identities?.dispose();fountain.dispose();ground.geometry.dispose();(ground.material as T.Material).dispose();renderer.dispose();renderer.domElement.remove();select.current=()=>{};};
 },[]);
 useEffect(()=>{selection.current=selected;select.current(selected);},[selected]);
 return <section className="tr-landmark-explorer" aria-label="Tirana landmarks">
  <label htmlFor={labelId}>TIRANA · BUILDINGS</label>
  <select id={labelId} value={selected} onChange={e=>setSelected(e.target.value)}>{Object.entries(LANDMARK_CATALOG).map(([id,s])=><option key={id} value={id}>{s.name}</option>)}</select>
  <div className="tr-landmark-canvas" ref={host}/>
  {error&&<p role="alert">{error}</p>}
  <div className="tr-landmark-caption" aria-live="polite">{inCity?'City district':'Outside the current driving district'} · {buildings.length} {buildings.length===1?'building':'buildings'}<span>Drag to orbit · Pinch to zoom</span></div>
  <p>{site.features}</p>
  {site.photo&&<figure><img src={photos[site.photo]||`/assets/tirana-streets/references/${site.photo}`} alt={`${site.name} reference, ${site.date}`}/><figcaption><a href={site.photoSource||site.source} target="_blank" rel="noreferrer">{site.credit} · {site.date}</a></figcaption></figure>}
  <a className="tr-landmark-source" href={site.source} target="_blank" rel="noreferrer">Building reference ↗</a>
  <small>Map geometry © OpenStreetMap contributors · Photo-informed models; unsurveyed details are approximate.</small>
 </section>;
}
