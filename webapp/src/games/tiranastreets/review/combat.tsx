import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {createWebGLRenderer} from '../createWebGLRenderer';
import {FirstPersonBody} from '../street-career/FirstPersonBody';
import {WEAPONS} from '../shared/weapons.mjs';
import {CityMap} from '../map/CityMap';
import type {Place} from '../map/CityMapCore';
import {WORLD} from '../shared/world.mjs';
import {MISSIONS} from '../shared/engine.mjs';
import {createCampaign} from '../street-career/campaignCore.mjs';
import {STARTER_WEAPON} from '../shared/weapons.mjs';
import {buildMapGraph,findMapRoute} from '../map/mapCore.mjs';
import {weaponAnchors} from '../street-career/weaponPose.mjs';
const campaign=createCampaign(MISSIONS,WEAPONS,STARTER_WEAPON);
function MapPreview(){
 const [destination,setDestination]=useState<Place|null>(null),[active,setActive]=useState('');
 const player={x:0,z:100,heading:0};
 const graph=useMemo(()=>buildMapGraph(WORLD,'walk'),[]);
 const route=useMemo(()=>destination?findMapRoute(graph,player,destination):{points:[],message:''},[graph,destination]);
 const chapter=campaign.chapters.find(c=>c.id===active);
 return <div className="portrait"><header><strong>Tirana Streets</strong><span>Map interaction review</span></header><CityMap large state={null} player={player} route={route.points} routeNotice={route.message} destination={destination} onDestination={setDestination}
 jobs={campaign.chapters.map(m=>({id:m.id,name:m.title,detail:m.description,available:campaign.available(campaign.fresh(),m.id),completed:false,active:active===m.id,point:m.stops[0]}))}
 onStartJob={setActive} task={chapter?{name:chapter.title,detail:chapter.description,point:chapter.stops[0]}:undefined}/></div>;
}
function Review(){
 const [page,setPage]=useState(0),[images,setImages]=useState<Record<string,{side:string;aim:string;error?:string}>>({}),[mode,setMode]=useState('map'),[error,setError]=useState('');
 useEffect(()=>{
  if(mode!=='weapons')return;
  setError('');let dead=false;
  const scene=new T.Scene();scene.background=new T.Color('#8297a7');
  let renderer:T.WebGLRenderer;try{renderer=createWebGLRenderer();}catch(e){setError(String(e));return;}renderer.setSize(400,225);renderer.setPixelRatio(1);
  renderer.outputColorSpace=T.SRGBColorSpace;scene.add(new T.HemisphereLight(0xffffff,0x747887,2));
  const light=new T.DirectionalLight(0xffffff,3);light.position.set(-2,4,-2);scene.add(light);
  const body=new FirstPersonBody(scene),camera=new T.PerspectiveCamera(45,400/225,.01,50);
  async function run(){
   for(const w of WEAPONS.slice(page*8,page*8+8)){
    await body.prepare(w.id);if(dead)break;
    const model=body.cloneWeapon(w.id);
    if(!model){setImages(v=>({...v,[w.id]:{side:'',aim:'',error:body.errors.at(-1)||'Model not loaded'}}));continue;}
    scene.add(model);const a=weaponAnchors(w.id);
    camera.position.set(-a.length*1.55,a.length*.2,a.length*.22);camera.lookAt(0,0,a.length*.22);camera.fov=45;camera.updateProjectionMatrix();
    renderer.render(scene,camera);const side=renderer.domElement.toDataURL();
    camera.position.set(0,a.sight.y,-.37);camera.lookAt(0,a.sight.y,10);camera.fov=50;camera.updateProjectionMatrix();renderer.render(scene,camera);
    const aim=renderer.domElement.toDataURL();model.removeFromParent();setImages(v=>({...v,[w.id]:{side,aim}}));
   }
  }void run();return()=>{dead=true;body.dispose();renderer.dispose();};
 },[mode,page]);
 return <>{error&&<p role="alert">{error}</p>}<nav><button onClick={()=>setMode('map')}>Portrait map</button><button onClick={()=>setMode('weapons')}>Weapon calibration</button><button onClick={()=>setMode('game')}>Portrait gameplay</button></nav>{mode==='map'?<MapPreview/>:mode==='game'?<iframe title="Portrait Tirana Streets" src="/tirana-gameplay-review.html?activity=street-career"/>:<><nav><button disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous</button><button disabled={(page+1)*8>=WEAPONS.length} onClick={()=>setPage(p=>p+1)}>Next</button><span>Page {page+1} · {Object.keys(images).length}/{WEAPONS.length} loaded</span></nav><div className="audit">{WEAPONS.slice(page*8,page*8+8).map(w=><article key={w.id}><h3>{w.label}</h3><small>{w.id} · Side / aim down sights</small>{images[w.id]?.error?<p role="alert">{images[w.id].error}</p>:<div className="views">{images[w.id]&&<><img alt={`${w.label} side, muzzle faces right`} src={images[w.id].side}/><img alt={`${w.label} aim down sights`} src={images[w.id].aim}/></>}</div>}</article>)}</div></>}</>;
}
createRoot(document.getElementById('root')!).render(<Review/>);
