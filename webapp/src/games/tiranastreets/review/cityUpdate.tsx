import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {createWebGLRenderer} from '../createWebGLRenderer';
import {BIKE_TYPES} from '../shared/bikeCatalog.mjs';
import {disposeWeaponResources} from '../weaponModelResources';
const assets=[{id:'golf-gti',name:'Volkswagen Golf GTI 2025'},{id:'namazgjah',name:'Great Mosque of Tirana'},...BIKE_TYPES,...['conad','mulliri','spar','bkt','credins','raiffeisen','plaza','rogner','vodafone','one','big-market','university-tirana'].map(id=>({id:`signs/${id}`,name:`Raised sign · ${id}`}))];
function Model({id}:{id:string}){
 const host=useRef<HTMLDivElement>(null),[status,setStatus]=useState('Loading model…'),[error,setError]=useState('');
 useEffect(()=>{
  const element=host.current!;let renderer:T.WebGLRenderer;
  try{renderer=createWebGLRenderer();}catch(e){setError(String(e));return;}
  setStatus('Loading model…');setError('');
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;element.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#e1e5df');scene.add(new T.HemisphereLight(0xffffff,0x718574,2.2));
  const sun=new T.DirectionalLight(0xfff4dc,3.5);sun.position.set(4,7,5);scene.add(sun);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room);scene.environment=environment.texture;room.dispose();
  const camera=new T.PerspectiveCamera(38,1,.01,2000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
  const resize=()=>{camera.aspect=element.clientWidth/element.clientHeight;camera.updateProjectionMatrix();renderer.setSize(element.clientWidth,element.clientHeight);};const observer=new ResizeObserver(resize);observer.observe(element);resize();
  const decoder=new DRACOLoader().setDecoderPath('/assets/tirana-streets/imported/draco/').setWorkerLimit(1);
  let dead=false,model:T.Group|undefined,frame=0;
  void new GLTFLoader().setDRACOLoader(decoder).loadAsync(`/assets/tirana-streets/city-mobility/${id}.glb`).then(({scene:root})=>{
   if(dead){disposeWeaponResources([root]);return;}model=root;
   const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3()),centre=box.getCenter(new T.Vector3());root.position.sub(centre);scene.add(root);
   const span=Math.max(size.x,size.y,size.z),distance=span*2.15;
   camera.position.set(distance*.68,distance*.36,distance*.85);camera.near=Math.max(.01,span/1000);camera.far=span*30;camera.updateProjectionMatrix();controls.target.set(0,0,0);controls.update();
   let triangles=0;root.traverse(o=>{if(o instanceof T.Mesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
   setStatus(`${Math.round(triangles).toLocaleString()} triangles · ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m · Drag to rotate`);
  }).catch(e=>{if(!dead)setError(String(e));});
  const draw=()=>{if(dead)return;controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(draw);};draw();
  return()=>{dead=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();decoder.dispose();if(model)disposeWeaponResources([model]);environment.dispose();pmrem.dispose();renderer.dispose();renderer.domElement.remove();};
 },[id]);
 return <div className="stage" ref={host}>{error&&<img style={{width:'100%',height:'100%',objectFit:'contain'}} src={`/assets/tirana-streets/city-mobility/previews/${id.replace('/','-')}.jpg`} alt={`Blender render of ${assets.find(a=>a.id===id)?.name}`} onError={e=>{e.currentTarget.style.display='none';}}/>}<p role={error?'alert':'status'}>{error?'WebGL is unavailable here. Showing the actual model rendered in Blender.':status}</p></div>;
}
function Review(){
 const [id,setId]=useState('golf-gti');
 return <main><header><small>TIRANA STREETS</small><h1>City update</h1><p>Explore the uploaded landmarks, five new bikes, and Blender signs.</p><label htmlFor="asset">Model</label><select id="asset" value={id} onChange={e=>setId(e.target.value)}>{assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></header><Model id={id}/><footer><p>Portrait asset review. The game includes connected pedestrian routes, persistent police patrols and station dispatch.</p><a href="/tirana-mobile-review.html">Open portrait gameplay review</a><p><a href="/assets/tirana-streets/city-mobility/ATTRIBUTION.md">Asset credits and licences</a></p></footer></main>;
}
createRoot(document.getElementById('root')!).render(<Review/>);
