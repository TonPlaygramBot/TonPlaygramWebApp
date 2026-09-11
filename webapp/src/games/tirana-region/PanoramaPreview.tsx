import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {RegionalPanorama} from './RegionalPanorama';
import {DajtiLayer} from '../tirana-expansion/BaseWorldEnhancements';
import {cablePose,project} from '../tirana-expansion/geography.mjs';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {DURRES_REFERENCE} from './panoramaCore.mjs';
/** Review the shipped distant LOD; this is not a full playable regional world. */
export default function PanoramaPreview(){
 const host=useRef<HTMLDivElement>(null),look=useRef<(coast:boolean)=>void>(()=>{});
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!host.current)return;
  const target=host.current,scene=new T.Scene(),camera=new T.PerspectiveCamera(55,1,.15,65000);
  let renderer:T.WebGLRenderer|undefined,observer:ResizeObserver|undefined;
  const panorama=new RegionalPanorama(),dajti=new DajtiLayer();
  const draw=()=>{if(!retired)renderer?.render(scene,camera);};
  let yaw=0,pitch=0,pointer:{id:number;x:number;y:number}|undefined,retired=false;
  const aim=(coast:boolean)=>{
   const dest=coast?project(WORLD.origin,DURRES_REFERENCE.latitude,DURRES_REFERENCE.longitude):{x:0,z:0};
   const dx=dest.x-camera.position.x,dz=dest.z-camera.position.z;
   yaw=Math.atan2(-dx,-dz);pitch=-Math.atan2(camera.position.y,Math.hypot(dx,dz));
   camera.rotation.set(pitch,yaw,0,'YXZ');draw();
  };look.current=aim;
  const down=(e:PointerEvent)=>{target.setPointerCapture(e.pointerId);pointer={id:e.pointerId,x:e.clientX,y:e.clientY};};
  const move=(e:PointerEvent)=>{if(pointer?.id!==e.pointerId)return;yaw-=(e.clientX-pointer.x)*.003;pitch=T.MathUtils.clamp(pitch-(e.clientY-pointer.y)*.003,-1.1,.55);pointer.x=e.clientX;pointer.y=e.clientY;camera.rotation.set(pitch,yaw,0,'YXZ');draw();};
  const end=(e:PointerEvent)=>{if(pointer?.id===e.pointerId)pointer=undefined;};
  try{
   renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;
   target.appendChild(renderer.domElement);scene.background=new T.Color(0xc4d3d7);
   scene.add(new T.HemisphereLight(0xe3edf0,0x7a8068,2),panorama.group,dajti.group);
   const sun=new T.DirectionalLight(0xffefcf,2);sun.position.set(-100,300,50);scene.add(sun);
   const p=cablePose(dajti.path,1,false,0);camera.position.set(p.x-40,p.y+5,p.z+45);aim(false);dajti.setTour(true);panorama.update(camera.position,camera);
   const resize=()=>{const r=target.getBoundingClientRect();if(!r.width||!r.height)return;renderer!.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();draw();};
   observer=new ResizeObserver(resize);observer.observe(target);resize();
   target.addEventListener('pointerdown',down);target.addEventListener('pointermove',move);target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);target.addEventListener('lostpointercapture',end);
   draw();void dajti.ready.then(draw);
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  return()=>{retired=true;observer?.disconnect();for(const [event,fn] of [['pointerdown',down],['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end]] as const)target.removeEventListener(event,fn);panorama.dispose();dajti.dispose();renderer?.dispose();renderer?.domElement.remove();look.current=()=>{};};
 },[]);
 return <section className="tr-panorama" aria-label="Dajti panorama preview">
  <div ref={host} style={{height:460,width:'100%',touchAction:'none',overflow:'hidden'}} aria-label="Pamje nga Dajti; rrëshqit për të parë përreth"/>
  {error&&<p role="alert">{error}</p>}
  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}><button onClick={()=>look.current(false)}>TIRANË</button><button onClick={()=>look.current(true)}>DURRËS · ADRIATIK</button></div>
  <p>Qendra nga harta ekzistuese. Relievi dhe horizonti bregdetar janë të përafërt.</p>
 </section>;
}
