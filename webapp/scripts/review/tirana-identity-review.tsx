import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {SVGRenderer} from 'three/examples/jsm/renderers/SVGRenderer.js';
import {blenderGroup} from '../../src/games/tirana-landmark-rebuild/geometry';
import PARLIAMENT from '../../src/games/tirana-landmark-rebuild/parliament-entry.mjs';
import {parliamentPalms} from '../../src/games/tirana-city-source/ParliamentPalms';
import {raisedInstitutionName} from '../../src/games/tirana-city-source/RaisedInstitutionName';
import {identityReliefFromImage} from '../../src/games/tirana-street-life/IdentityRelief';
import {UrbanMonumentLayer} from '../../src/games/tirana-landmarks/UrbanMonumentLayer';
import ARTWORK from 'tirana-review-artwork';
const brands=['intesa','otp','union','abi','tirana-bank','fibank','procredit','uba','eco-market','sophie','kfc','burger-king','tirana-international','teg','qtu','rossmann-lala','neranxi','pizzahut','marriott'];
const titles={kuvendi:'Hyrja e Kuvendit',logos:'Relievi i logos',shkolla:'Emri i institucionit',monumenti:'Ismail Qemali'};
function App(){
 const host=useRef<HTMLDivElement>(null),rotate=useRef<()=>void>(),angleValue=useRef(15);
 const [view,setView]=useState('kuvendi'),[brand,setBrand]=useState('otp'),[angle,setAngle]=useState(15),[fallback,setFallback]=useState(false),[status,setStatus]=useState('Duke hapur modelin…');
 angleValue.current=angle;
 useEffect(()=>{
  const container=host.current!;let alive=true,root:T.Group|undefined,renderer:T.WebGLRenderer|SVGRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;setFallback(false);}
  catch {renderer=new SVGRenderer();renderer.setQuality('high');setFallback(true);}
  renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label',titles[view as keyof typeof titles]);container.replaceChildren(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color(0xd7e1e6);
  scene.add(new T.HemisphereLight(0xf2f7fc,0x6d6b55,2.4));
  const sun=new T.DirectionalLight(0xffedd5,3.2);sun.position.set(-10,20,15);scene.add(sun);
  const fill=new T.DirectionalLight(0xe5f0ff,1);fill.position.set(10,6,-8);scene.add(fill);
  const camera=new T.PerspectiveCamera(37,1,.03,1000),center=new T.Vector3();let radius=10;
  function draw(){
   const width=container.clientWidth,height=container.clientHeight;if(!width||!height)return;
   renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();
   const a=angleValue.current*Math.PI/180,distance=radius/Math.min(1,camera.aspect);
   camera.position.set(center.x+Math.sin(a)*distance,center.y+distance*.16,center.z+Math.cos(a)*distance);camera.lookAt(center);renderer.render(scene,camera);
  }
  rotate.current=draw;const observer=new ResizeObserver(draw);observer.observe(container);
  async function create(){
   setStatus('Duke hapur modelin…');
   if(view==='kuvendi'){
    root=blenderGroup(PARLIAMENT);root.add(parliamentPalms());
    const c=document.createElement('canvas');c.width=2048;c.height=96;const ctx=c.getContext('2d')!;ctx.fillStyle='#b99b53';ctx.font='500 64px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('KUVENDI I REPUBLIKËS SË SHQIPËRISË',1024,48,1980);
    const plaque=new T.Mesh(new T.PlaneGeometry(22,.8),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false}));plaque.position.set(0,12.27,.4);if(renderer instanceof T.WebGLRenderer)root.add(plaque);else{plaque.geometry.dispose();plaque.material.map?.dispose();plaque.material.dispose();}
   }else if(view==='logos'){
    const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=reject;image.src=ARTWORK[brand];});
    if(!alive)return;root=identityReliefFromImage(brand,image);
    // SVG fallback has no texture support; use the dominant artwork ink for
    // the same raised cap geometry and label this projection in the UI.
    if(!(renderer instanceof T.WebGLRenderer)){
     const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;const colors=new Map<string,number>();
     for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>180&&Math.min(pixels[i],pixels[i+1],pixels[i+2])<180){const key=[pixels[i]>>4,pixels[i+1]>>4,pixels[i+2]>>4].join(',');colors.set(key,(colors.get(key)||0)+1);}
     const ink=[...colors].sort((a,b)=>b[1]-a[1])[0]?.[0].split(',').map(v=>(Number(v)*16+8)/255)||[.1,.35,.2];
     root.traverse(o=>{if(o instanceof T.Mesh&&(o.material as T.MeshStandardMaterial).map)(o.material as T.MeshStandardMaterial).color.setRGB(ink[0],ink[1],ink[2],T.SRGBColorSpace);});
    }
   }else if(view==='shkolla'){root=raisedInstitutionName('Shkolla 9-vjeçare “Fan Noli”',4.6,1.15);}
   else {const layer=new UrbanMonumentLayer();root=layer.group.children.find(c=>c.userData.id==='ismail-qemali') as T.Group;root.removeFromParent();root.position.set(0,0,0);root.rotation.y=Math.PI;}
   if(!alive)return;
   const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3());center.copy(box.getCenter(new T.Vector3()));radius=Math.max(size.x,size.y)*1.85;
   const ground=new T.Mesh(new T.PlaneGeometry(radius*8,radius*8),new T.MeshStandardMaterial({color:0xbac0b6,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(center.x,box.min.y-.015,center.z);scene.add(ground,root);draw();setStatus(titles[view as keyof typeof titles]);
  }
  void create().catch(()=>{if(alive)setStatus('Modeli nuk u hap. Zgjidh një pamje tjetër.');});
  return ()=>{alive=false;observer.disconnect();rotate.current=undefined;scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){(m as T.MeshStandardMaterial).map?.dispose();m.dispose();}}});if(renderer instanceof T.WebGLRenderer)renderer.dispose();container.replaceChildren();};
 },[view,brand]);
 useEffect(()=>rotate.current?.(),[angle]);
 return <div className="tp-review">
  <header><span>TIRANA STREETS</span><span className="tp-secondary">Model review</span></header>
  <nav aria-label="Modelet 3D">{[['kuvendi','Kuvendi'],['logos','Logot'],['shkolla','Shkolla'],['monumenti','Monumenti']].map(([id,label])=><button type="button" className="cursor-interaction" key={id} aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}</nav>
  <div className="tp-stage"><div ref={host} className="tp-canvas"/><div className="tp-caption" aria-live="polite">{status}</div></div>
  <footer>{view==='logos'&&<label>Marka<select value={brand} onChange={e=>setBrand(e.target.value)}>{brands.map(b=><option key={b} value={b}>{b.replaceAll('-',' ').toUpperCase()}</option>)}</select></label>}
   <label>Këndi <span>{angle}°</span><input aria-label="Rrotullo modelin" type="range" min="-75" max="75" step="1" value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label>
   <div className="tp-secondary">{fallback?'Projeksion pa tekstura · WebGL mungon':'Modele të projektit · pamje e pjesshme'}</div>
  </footer>
 </div>;
}
createRoot(document.getElementById('tirana-identity-review-root')!).render(<App/>);
