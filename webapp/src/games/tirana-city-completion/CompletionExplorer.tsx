import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CityCompletionLayer} from './CityCompletionLayer';
import {FacadeCompletionLayer} from './FacadeCompletionLayer';
import {MappedBuildingCells} from '../tirana-neighbourhood/MappedBuildingCells';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {COMPLETED_BUILDINGS} from './buildingRegistry.mjs';
import {CITY_COMPLETION} from './data.mjs';
import {STREET_LIFE} from '../tirana-street-life/registry.mjs';
import {MatureTreeLayer} from '../tirana-street-life/MatureTreeLayer';
import './completionExplorer.css';
export type ReviewView={id:string;name:string;x:number;z:number;y:number;distance:number;yaw:number;buildingId?:string};
export default function CompletionExplorer({views,loadBuilding}:{views:ReviewView[];loadBuilding?:(id:string)=>Promise<T.Group>}){
 const [selected,setSelected]=useState(views[0].id),[error,setError]=useState('');
 const mount=useRef<HTMLDivElement>(null),jump=useRef<(id:string)=>void>(()=>{}),toggle=useRef<(on:boolean)=>void>(()=>{});
 const [enhanced,setEnhanced]=useState(true);
 useEffect(()=>{
  if(!mount.current)return;const host=mount.current;let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true});}catch{setError('3D is unavailable on this device.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.domElement.setAttribute('aria-label','Tirana city scene. Drag to look around; pinch to move closer.');host.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#bed1d8');scene.fog=new T.Fog('#bed1d8',220,640);
  const camera=new T.PerspectiveCamera(48,1,.1,1000),controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.minDistance=6;controls.maxDistance=150;controls.maxPolarAngle=Math.PI*.49;
  scene.add(new T.HemisphereLight(0xe0f0f6,0x7a7666,2.4));const sun=new T.DirectionalLight(0xffead0,3);sun.position.set(-60,100,40);scene.add(sun);
  const layer=new CityCompletionLayer(),facades=new FacadeCompletionLayer(WORLD.buildings),trees=new MatureTreeLayer(STREET_LIFE.trees);
  scene.add(layer.group,facades.group,trees.group);
  const wall=new T.MeshStandardMaterial({vertexColors:true,roughness:.9}),glass=new T.MeshStandardMaterial({color:0x365761,roughness:.3,metalness:.3});
  const shellBuilder=new MappedBuildingCells([],wall,glass,false),models=new Map<string,T.Group>(),pending=new Set<string>();
  let context=new T.Group();scene.add(context);let active=views[0],enabled=true,dead=false;
  const disposeContext=()=>{context.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();if(o.material!==wall&&o.material!==glass)(o.material as T.Material).dispose();}});context.removeFromParent();context=new T.Group();scene.add(context);};
  const refresh=()=>{
   disposeContext();const near=(p:number[])=>Math.hypot(p[0]-active.x,p[1]-active.z)<210;
   const visibleModels=new Set<string>();for(const [id,m] of models){const b=COMPLETED_BUILDINGS.find(b=>b.id===id)!;m.visible=enabled&&Math.hypot(b.origin[0]-active.x,b.origin[1]-active.z)<220;if(m.visible)visibleModels.add(id);}
   context.add(shellBuilder.build(WORLD.buildings.filter(b=>b.p.some(near)&&!visibleModels.has(b.id))));
   const buckets=new Map<number,T.BufferGeometry[]>();const add=(color:number,g:T.BufferGeometry)=>{if(!buckets.has(color))buckets.set(color,[]);buckets.get(color)!.push(g);};
   add(0xb8b7a9,new T.PlaneGeometry(650,650).rotateX(-Math.PI/2).translate(active.x,-.04,active.z));
   for(const a of WORLD.parks.filter(p=>p.some(near)))add(0x778964,new T.ShapeGeometry(new T.Shape(a.map(p=>new T.Vector2(p[0],-p[1])))).rotateX(-Math.PI/2).translate(0,.04,0));
   for(const p of CITY_COMPLETION.parking.filter(p=>p.p.some(near)))add(0x777c78,new T.ShapeGeometry(new T.Shape(p.p.map((q:number[])=>new T.Vector2(q[0],-q[1])))).rotateX(-Math.PI/2).translate(0,.075,0));
   for(const r of WORLD.roads){if(!near(r.a)&&!near(r.b))continue;const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],l=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),x=(r.a[0]+r.b[0])/2,z=(r.a[1]+r.b[1])/2;
    if(!r.walk)add(0xc3bdae,new T.PlaneGeometry(r.w+3.8,l).rotateX(-Math.PI/2).rotateY(yaw).translate(x,.06,z));
    add(r.walk?0xc3bdae:0x747b79,new T.PlaneGeometry(r.w,l+.04).rotateX(-Math.PI/2).rotateY(yaw).translate(x,.09,z));
   }
   for(const [color,geos] of buckets){const g=mergeGeometries(geos)!;geos.forEach(g=>g.dispose());context.add(new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:.94})));}
  };
  const request=async(id:string)=>{if(pending.has(id))return;pending.add(id);try{
   const model=loadBuilding?await loadBuilding(id):(await new GLTFLoader().loadAsync('/assets/tirana-streets/neighbourhood/completion-'+id+'.glb')).scene;
   if(dead){releaseModel(model);return;}const b=COMPLETED_BUILDINGS.find(b=>b.id===id)!;model.position.set(b.origin[0],0,b.origin[1]);models.set(id,model);scene.add(model);refresh();
  }catch(e){if(!dead)setError('The detailed building could not load; its mapped shell remains visible.');}};
  const fit=()=>{const d=active.distance*Math.max(1,.78/camera.aspect);controls.target.set(active.x,active.y,active.z);camera.position.set(active.x+Math.sin(active.yaw)*d,active.y+d*.23,active.z+Math.cos(active.yaw)*d);controls.update();};
  jump.current=id=>{active=views.find(v=>v.id===id)!;refresh();fit();if(active.buildingId)void request(active.buildingId);};
  toggle.current=on=>{enabled=on;layer.group.visible=on;facades.group.visible=on;refresh();};jump.current(views[0].id);
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();fit();};const ro=new ResizeObserver(resize);ro.observe(host);resize();
  let frame=0,visible=true;const io=new IntersectionObserver(([v])=>visible=v.isIntersecting);io.observe(host);
  const draw=()=>{if(visible&&!document.hidden){const t=performance.now()/1000;layer.update(t,active);facades.update(t,active);trees.update(t,active);renderer.render(scene,camera);host.dataset.drawCalls=String(renderer.info.render.calls);host.dataset.triangles=String(renderer.info.render.triangles);host.dataset.models=String(models.size);}frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);
  return()=>{dead=true;cancelAnimationFrame(frame);ro.disconnect();io.disconnect();controls.dispose();layer.dispose();facades.dispose();trees.dispose();disposeContext();models.forEach(releaseModel);wall.dispose();glass.dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <section className="tc-review" aria-label="Tirana city update preview">
  <div className="tc-heading"><span>TIRANA STREETS</span><span>City update</span></div>
  <select aria-label="Tirana location" value={selected} onChange={e=>{setSelected(e.target.value);jump.current(e.target.value);}}>{views.map(v=><option value={v.id} key={v.id}>{v.name}</option>)}</select>
  <div className="tc-canvas" ref={mount}/>
  <div className="tc-footer"><button type="button" aria-pressed={enhanced} onClick={()=>{setEnhanced(!enhanced);toggle.current(!enhanced);}}>{enhanced?'Show previous detail':'Show city update'}</button><span>Drag · Pinch to zoom</span></div>
  {error&&<p role="alert">{error}</p>}
  <small>Mapped Tirana locations · Estimated façade and fixture details<br/>© OpenStreetMap contributors</small>
 </section>;
}
function releaseModel(root:T.Object3D){root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});root.removeFromParent();}
