import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {SVGRenderer} from 'three/examples/jsm/renderers/SVGRenderer.js';
import {constructionGeometry} from './constructionGeometry';
import {DEVELOPMENT_BUILDINGS} from './developmentBuildings.mjs';
import {DEVELOPMENT_SITES} from './developmentSites.mjs';
function Review(){
 const [selected,setSelected]=useState(0),[angle,setAngle]=useState(0),[street,setStreet]=useState(false);
 const host=useRef<HTMLDivElement>(null),b=DEVELOPMENT_BUILDINGS[selected],site=DEVELOPMENT_SITES.find(s=>s.id===b.development)!;
 useEffect(()=>{
  if(!host.current)return;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(52,1,.1,1000),renderer=new SVGRenderer();renderer.setQuality('high');renderer.setClearColor(new T.Color('#cbdde4'),1);
  const material=new T.MeshLambertMaterial({vertexColors:true}),geometries=[constructionGeometry(b),constructionGeometry(b,true)].filter(Boolean) as T.BufferGeometry[];
  for(const g of geometries)scene.add(new T.Mesh(g,material));
  const centre=new T.Vector3(b.p.reduce((s,p)=>s+p[0]/b.p.length,0),0,b.p.reduce((s,p)=>s+p[1]/b.p.length,0));
  const ground=new T.Mesh(new T.PlaneGeometry(130,130).rotateX(-Math.PI/2),new T.MeshLambertMaterial({color:0xb6b1a1}));ground.position.copy(centre);ground.position.y=-.05;scene.add(ground);
  scene.add(new T.AmbientLight(0xffffff,1.5));const light=new T.DirectionalLight(0xffffff,2.5);light.position.set(centre.x-40,80,centre.z+50);scene.add(light);
  const draw=()=>{const w=host.current!.clientWidth,h=Math.min(700,Math.max(430,innerHeight-220));renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();const a=angle*Math.PI/180,distance=street?58:Math.max(82,b.h*2.2);camera.position.set(centre.x+Math.sin(a+.7)*distance,street?2:Math.max(32,b.h*.8),centre.z+Math.cos(a+.7)*distance);camera.lookAt(centre.x,street?b.h*.23:b.h*.48,centre.z);renderer.render(scene,camera);};
  host.current.replaceChildren(renderer.domElement);draw();const observer=new ResizeObserver(draw);observer.observe(host.current);
  return()=>{observer.disconnect();geometries.forEach(g=>g.dispose());material.dispose();ground.geometry.dispose();(ground.material as T.Material).dispose();renderer.domElement.remove();};
 },[selected,angle,street]);
 return <main style={{fontFamily:'system-ui',background:'#14272e',color:'#f4eddf',minHeight:'100vh',maxWidth:420,margin:'auto'}}>
 <header style={{padding:16}}><strong>TIRANA · CONSTRUCTION REVIEW</strong><p style={{fontSize:13,margin:'6px 0'}}>Actual game geometry · software rendering · lighting, textures and live FPS require WebGL.</p>
 <label>Site <select aria-label="Construction site" value={selected} onChange={e=>setSelected(Number(e.target.value))}>{DEVELOPMENT_BUILDINGS.map((b,i)=><option key={b.id} value={i}>{b.name}</option>)}</select></label>{' '}
 <button onClick={()=>setAngle(a=>a+45)}>Rotate view</button>{' '}<button onClick={()=>setStreet(s=>!s)}>{street?'Elevated view':'Street view'}</button>
 </header><div ref={host} role="img" aria-label={`${b.name} construction model`}/>
 <footer style={{padding:16,fontSize:13}}><strong>{b.name}</strong> · {b.constructionStage}<p>Location follows the mapped construction site. The structure, stage and equipment are illustrative, not a survey of current progress.</p><a style={{color:'#aadceb'}} href={site.reference}>Architect reference</a>{' · '}<a style={{color:'#aadceb'}} href={site.source}>Mapped site · © OpenStreetMap contributors</a></footer>
 </main>;
}
createRoot(document.getElementById('root')!).render(<Review/>);
