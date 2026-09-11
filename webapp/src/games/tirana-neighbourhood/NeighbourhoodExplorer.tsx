import {useEffect,useId,useRef,useState} from 'react';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {REVIEW_SITES} from './reviewData.mjs';
import './neighbourhoodExplorer.css';

export type AssetLoader=(name:string)=>Promise<T.Group>;
const loadAsset:AssetLoader=async name=>(await new GLTFLoader().loadAsync(`/assets/tirana-streets/neighbourhood/${name}.glb`)).scene;
function release(group:T.Object3D){const geometry=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();group.traverse(o=>{if(!(o instanceof T.Mesh))return;geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());group.removeFromParent();}

/** Portrait inspection of the same exported GLBs and source-positioned fronts
 * used by gameplay. The inline adapter supplies embedded assets without APIs. */
export default function NeighbourhoodExplorer({loader=loadAsset}:{loader?:AssetLoader}){
 const [selected,setSelected]=useState('britaniku'),[status,setStatus]=useState(''),[error,setError]=useState('');
 const host=useRef<HTMLDivElement>(null),choose=useRef<(id:string)=>void>(()=>{}),selection=useRef(selected),label=useId();
 useEffect(()=>{
  const mount=host.current;if(!mount)return;
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true});}catch{setError('Pamja 3D nuk mbështetet në këtë pajisje.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label','Modelet Tirana Streets: rrotullo me prekje dhe zmadho me dy gishta.');mount.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color(0xc3ced3);
  const camera=new T.PerspectiveCamera(40,1,.1,3000),controls=new OrbitControls(camera,renderer.domElement);
  controls.maxPolarAngle=Math.PI*.49;controls.minDistance=2;controls.enablePan=true;
  scene.add(new T.HemisphereLight(0xe5eff6,0x9b927d,2));
  const sun=new T.DirectionalLight(0xffead2,3);sun.position.set(-65,100,90);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-180,right:180,top:180,bottom:-180,near:1,far:400});sun.shadow.bias=-.0002;scene.add(sun);
  const ground=new T.Mesh(new T.PlaneGeometry(1400,1400),new T.MeshStandardMaterial({color:0x9c9f8f,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;ground.receiveShadow=true;scene.add(ground);
  let current:T.Group|undefined,sequence=0,dead=false,requestedId='';
  const render=()=>{if(!dead)renderer.render(scene,camera);};
  const fit=()=>{if(!current)return;const bounds=new T.Box3().setFromObject(current),center=bounds.getCenter(new T.Vector3()),radius=bounds.getSize(new T.Vector3()).length()/2;
   const half=Math.min(T.MathUtils.degToRad(camera.fov)/2,Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov)/2)*camera.aspect));
   const distance=radius/Math.sin(half)*1.07;camera.position.copy(center).add(new T.Vector3(.7,.55,1).normalize().multiplyScalar(distance));controls.target.copy(center);controls.maxDistance=Math.max(25,distance*3);controls.update();render();
  };
  choose.current=id=>{
   if(id===requestedId)return;requestedId=id;
   const token=++sequence,site=REVIEW_SITES.find(s=>s.asset===id);if(!site)return;
   setStatus('Duke ngarkuar…');setError('');
   const names=[...new Set([id,...site.fronts.map(f=>f.model)])];
   void Promise.allSettled(names.map(loader)).then(results=>{
    const success=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
    if(dead||token!==sequence){success.forEach(release);return;}
    if(results.some(r=>r.status==='rejected')){success.forEach(release);setStatus('');setError('Modeli nuk u ngarkua.');return;}
    const templates=new Map(names.map((name,i)=>[name,success[i]])),group=new T.Group();group.add(templates.get(id)!);
    for(const front of site.fronts){const model=templates.get(front.model)!.clone(true);model.position.set(front.x-site.origin[0],.12,front.z-site.origin[1]);model.rotation.y=front.yaw;model.scale.x=front.width/4;group.add(model);
     const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#31413e';ctx.fillRect(0,0,512,64);ctx.fillStyle='#fff6df';ctx.font='500 35px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(front.name,256,32,492);
     const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
     const sign=new T.Mesh(new T.PlaneGeometry(4-.12,.36),new T.MeshStandardMaterial({map:texture,roughness:.7}));sign.position.set(0,3.21,.238);model.add(sign);
    }
    // Kit templates share geometry with their placed clones; those clones own
    // disposal. Every fetched kit has at least one frontage in this selection.
    current&&release(current);current=group;group.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(group);setStatus('');fit();
   }).catch(()=>{if(!dead&&token===sequence){setStatus('');setError('Modeli nuk u ngarkua.');}});
  };
  const resize=()=>{const width=Math.max(1,mount.clientWidth),height=Math.max(1,mount.clientHeight);renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();fit();};
  const observer=new ResizeObserver(resize);observer.observe(mount);controls.addEventListener('change',render);resize();choose.current(selection.current);
  return()=>{dead=true;sequence++;observer.disconnect();controls.removeEventListener('change',render);controls.dispose();if(current)release(current);ground.geometry.dispose();(ground.material as T.Material).dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();choose.current=()=>{};};
 },[loader]);
 useEffect(()=>{selection.current=selected;choose.current(selected);},[selected]);
 return <section className="tn-review" aria-label="Tirana Streets — lagjet">
  <label htmlFor={label}>TIRANA STREETS</label>
  <select id={label} value={selected} onChange={e=>setSelected(e.target.value)}>{REVIEW_SITES.map(s=><option key={s.asset} value={s.asset}>{s.name}</option>)}</select>
  <div className="tn-review-stage" ref={host}/>
  <div className="tn-review-caption" aria-live="polite">{error||status||'Rrotullo · Zmadho · Shiko nga çdo anë'}</div>
  <small>Gjurmë OSM · Fasada të interpretuara në Blender · Materiale Poly Haven</small>
 </section>;
}
