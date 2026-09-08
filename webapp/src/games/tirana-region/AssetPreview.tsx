import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
function dispose(root:T.Object3D){const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>(),ts=new Set<T.Texture>();root.traverse(o=>{if(o instanceof T.Mesh){gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){ms.add(m);for(const v of Object.values(m))if(v instanceof T.Texture)ts.add(v);}}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());root.clear();}
/** Standalone authoring preview; not a screenshot of either live game. */
export function AssetPreview({assets}:{assets:{name:string;gltf:unknown}[]}){
 const host=useRef<HTMLDivElement>(null),[index,setIndex]=useState(0),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 useEffect(()=>{
  if(!host.current||!assets[index])return;const target=host.current;let retired=false,raf=0,renderer:T.WebGLRenderer|undefined,observer:ResizeObserver|undefined,controls:OrbitControls|undefined;const scene=new T.Scene();setLoaded(false);setError('');
  try{
   renderer=new T.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;scene.background=new T.Color(0x293c42);target.appendChild(renderer.domElement);
   const camera=new T.PerspectiveCamera(48,1,.05,80);camera.position.set(5.8,5.2,9);controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,3.9,.1);controls.enableDamping=true;controls.minDistance=3;controls.maxDistance=22;controls.maxPolarAngle=Math.PI*.6;
   scene.add(new T.HemisphereLight(0xdbeaf0,0x594936,2.5));const sun=new T.DirectionalLight(0xffecd2,3);sun.position.set(5,9,7);scene.add(sun);
   const wall=new T.Mesh(new T.BoxGeometry(6.4,6.3,.18),new T.MeshStandardMaterial({color:0xaaa493,roughness:.95}));wall.position.set(0,3.15,-.12);scene.add(wall);
   const floor=new T.Mesh(new T.PlaneGeometry(60,60),new T.MeshStandardMaterial({color:0x5a696a,roughness:.92}));floor.rotation.x=-Math.PI/2;floor.position.y=-.03;scene.add(floor);
   new GLTFLoader().parse(JSON.stringify(assets[index].gltf),'',g=>{if(retired){dispose(g.scene);return;}scene.add(g.scene);setLoaded(true);},e=>{if(!retired)setError(String(e));});
   const resize=()=>{const r=target.getBoundingClientRect();if(!r.width||!r.height)return;renderer!.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};observer=new ResizeObserver(resize);observer.observe(target);resize();
   const tick=()=>{if(retired)return;controls!.update();renderer!.render(scene,camera);raf=requestAnimationFrame(tick);};tick();
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  return()=>{retired=true;cancelAnimationFrame(raf);observer?.disconnect();controls?.dispose();dispose(scene);renderer?.dispose();renderer?.domElement.remove();};
 },[assets,index]);
 return <main style={{fontFamily:'system-ui',background:'#172c32',color:'#eee5d2',padding:12,maxWidth:620,margin:'auto'}}>
  <small style={{letterSpacing:2}}>TIRANA · ORIGINAL ASSET PREVIEW</small><h2 style={{margin:'8px 0',fontSize:24}}>Detaje që i japin jetë rrugës.</h2>
  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>{assets.map((a,i)=><button key={a.name} aria-pressed={i===index} onClick={()=>setIndex(i)} style={{minHeight:44,padding:'8px 13px',border:'1px solid #8a9b94',borderRadius:8,background:i===index?'#d9bb89':'#28464b',color:i===index?'#172c32':'#eee5d2'}}>{a.name}</button>)}</div>
  <div ref={host} style={{width:'100%',height:'min(60vh,560px)',minHeight:320,touchAction:'none',borderRadius:12,overflow:'hidden'}}/>
  <p role="status" style={{fontSize:12,lineHeight:1.5}}>{error?`Preview error: ${error}`:loaded?'Drag to orbit · Pinch to zoom. glTF 2.0 with embedded 2048 × 512 PNG sign texture.':'Loading original glTF…'}</p>
  <p style={{fontSize:12,lineHeight:1.5,color:'#b6cbc5'}}>Authored showroom wall, not a real Tirana building or live-game screenshot. Shop names and illustrated adverts are fictional. Exported textures and meshes are original.</p>
 </main>;
}
