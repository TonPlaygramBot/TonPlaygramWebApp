import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {WeaponSwitcher} from '../WeaponSwitcher';
import {WEAPONS} from '../shared/weapons.mjs';
import {AlbanianForcesVisuals} from '../AlbanianForcesVisuals';
import {LivingVisuals} from '../livingVisuals';
import {createWebGLRenderer} from '../createWebGLRenderer';
const outfits=['patrol_officer','traffic_officer','shqiponja_officer','fnsh_officer','renea_officer','army_soldier'];
function Uniform({outfit}:{outfit:string}){
 const host=useRef<HTMLDivElement>(null),[error,setError]=useState('');
 useEffect(()=>{
  setError('');let renderer:T.WebGLRenderer;try{renderer=createWebGLRenderer();}catch(e){setError(String(e));return;}
  renderer.setSize(354,510);renderer.setPixelRatio(1);host.current?.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#6b7e8b');scene.add(new T.HemisphereLight(0xffffff,0x666e7d,2));
  const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(-2,4,4);scene.add(sun);
  const forces=new AlbanianForcesVisuals(),guns=new LivingVisuals(false);scene.add(forces.group,guns.group);
  const camera=new T.PerspectiveCamera(40,354/510,.05,100);camera.position.set(2.2,1.5,-3.1);camera.lookAt(0,1,0);
  const n={id:'review',kind:'police',forceCharacter:outfit,x:0,z:0,heading:0,speed:0,health:100,motion:'walk',weapon:'ak47VolleyAttack',anim:'aim',nextShot:0,downUntil:0};
  let frame=0,previous=performance.now();
  const draw=(now:number)=>{const dt=Math.min(.05,(now-previous)/1000);previous=now;forces.update({cars:[],traffic:[],units:[],npcs:[n]},n,now/1000,dt);const root=forces.getRoot('npc-review');if(root)guns.pose('npc-review',root,n,now/1000);renderer.render(scene,camera);frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);forces.dispose();guns.dispose();renderer.dispose();renderer.domElement.remove();};
 },[outfit]);
 return <div ref={host}>{error&&<p role="alert">3D preview unavailable in this browser: {error}</p>}</div>;
}
function Review(){
 const [mode,setMode]=useState('equipment'),[weapon,setWeapon]=useState('ak47VolleyAttack'),[outfit,setOutfit]=useState(outfits[0]);
 const selected=WEAPONS.find(w=>w.id===weapon),icons:Record<string,string>={punch:'✊',egg:'🥚',tomato:'🍅'};
 return <main className="patrol-review"><header><h1>TIRANA STREETS</h1><small>Portrait review</small></header><nav><button onClick={()=>setMode('equipment')}>Equipment</button><button onClick={()=>setMode('uniforms')}>Uniforms</button></nav>
 {mode==='equipment'?<><h2>Ready for the streets</h2><p>Open WEAPONS to choose a firearm, throw eggs or tomatoes, raise your fists, or leave your hands free.</p><div className="selected" role="status">{icons[weapon]||(!weapon?'✋':'')} {selected?.label||'No weapon'}</div><p>Equipment interaction preview · 390 × 844</p><WeaponSwitcher selected={weapon} onOpen={()=>{}} onSelect={id=>{setWeapon(id);return true;}} weapons={[{id:'',label:'No weapon',icon:'✋'},...WEAPONS.filter(w=>w.id!=='fpsGunAttack').map(w=>({id:w.id,label:w.label,icon:icons[w.id],thumbnail:icons[w.id]?undefined:`/assets/tirana-streets/weapon-thumbnails/${w.id}.webp`,ammo:w.category==='melee'?undefined:w.magazine,reserve:w.category==='melee'?undefined:w.magazine*3}))]}/></>:<><h2>Original Albanian uniforms</h2><select aria-label="Uniform" value={outfit} onChange={e=>setOutfit(e.target.value)}>{outfits.map(id=><option key={id}>{id}</option>)}</select><Uniform outfit={outfit}/></>}
 </main>;
}
createRoot(document.getElementById('root')!).render(location.search.includes('portrait=1')?<Review/>:<iframe className="review-frame" title="Portrait equipment and uniforms" src="/tirana-patrol-review.html?portrait=1"/>);
