import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { itemInfo, type StoreItem } from './storeModel';
import { itemPalette, thumbnailDataUrl } from './storeArtwork';
/** One on-demand canvas in the item dialog; no animation loop or WebGL context per store card. */
export default function MaterialPreview3D({item}:{item:StoreItem}) {
  const mount=useRef<HTMLDivElement>(null), reset=useRef<()=>void>(()=>{});
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    const node=mount.current;if(!node)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{setFailed(true);return;}
    setFailed(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    node.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
    const camera=new THREE.PerspectiveCamera(38,1,.1,60);camera.position.set(4,3.5,5.4);camera.lookAt(0,.3,0);
    const {colors}=itemPalette(item),[p,s=p,a='#e2e8f0']=colors;
    const mat=(color:string,metalness=.18)=>{const alpha=color.length===9?parseInt(color.slice(7),16)/255:1;return new THREE.MeshStandardMaterial({color:color.length===9?color.slice(0,7):color,roughness:.45,metalness,transparent:alpha<1,opacity:alpha});};
    const primary=mat(p),secondary=mat(s),accent=mat(a,.45),dark=mat('#1d292c'),felt=mat('#235b4f',0),shaft=mat('#e5d4ae',0);
    const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);root.add(m);return m;};
    const box=(w:number,h:number,d:number,material:THREE.Material,x=0,y=0,z=0)=>mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z);
    const cyl=(top:number,bottom:number,h:number,material:THREE.Material,x=0,y=0,z=0)=>mesh(new THREE.CylinderGeometry(top,bottom,h,40),material,x,y,z);
    const kind=itemInfo(item).kind;
    if(kind==='cue'){
      const butt=cyl(.055,.075,1.65,primary,-1.25,.4);butt.rotation.z=-Math.PI/2;
      const tip=cyl(.025,.055,2.4,shaft,.775,.4);tip.rotation.z=-Math.PI/2;
      for(const x of [-1.96,-1.85,-.48,-.42]){const ring=cyl(.078,.078,.035,accent,x,.4);ring.rotation.z=Math.PI/2;}
      const cap=cyl(.026,.026,.055,mat('#67a6c7'),2.0,.4);cap.rotation.z=Math.PI/2;
    }else if(['table','cloth','base'].includes(kind)){
      const rail=kind==='table'?primary:dark,cloth=kind==='cloth'?primary:felt,legs=kind==='base'?primary:dark;
      box(3.5,.22,2.0,rail,0,.65);box(3.15,.04,1.65,cloth,0,.79);
      if(String(item.optionId)==='openPortal'){
        for(const x of [-1.15,1.15]){box(.14,1.0,.14,legs,x,.05,-.65);box(.14,1.0,.14,legs,x,.05,.65);box(.17,.14,1.45,legs,x,-.4);}
      }else {for(const x of [-1.25,0,1.25])for(const z of [-.63,.63])cyl(.12,.1,1,legs,x,.05,z);}
      if(['poolroyale','bilardoshqip','snookerroyale'].includes(item.slug))for(const x of [-1.49,0,1.49])for(const z of [-.75,.75])cyl(.095,.095,.016,dark,x,.82,z);
    }else if(kind==='chair'){
      box(1.3,.18,1.25,primary,0,.05);box(1.3,1.35,.19,primary,0,.77,-.55);
      for(const x of [-.5,.5])for(const z of [-.45,.45])box(.095,.9,.095,secondary,x,-.46,z);
    }else if(kind==='puck'||kind==='token'){
      cyl(.95,.95,.24,primary,0,.1);const ring=mesh(new THREE.TorusGeometry(.77,.015,8,60),accent,0,.228);ring.rotation.x=Math.PI/2;
    }else if(kind==='mallet'){
      cyl(1,1,.22,primary,0,0);cyl(.27,.4,.65,primary,0,.43);mesh(new THREE.SphereGeometry(.28,24,12),primary,0,.75);
    }else if(kind==='chess'){
      cyl(.65,.69,.15,primary,0,-.4);cyl(.32,.57,.8,primary,0,.1);cyl(.42,.3,.15,accent,0,.57);mesh(new THREE.SphereGeometry(.34,32,24),primary,0,.96);
    }else if(kind==='pocket'){
      const jaw=mesh(new THREE.TorusGeometry(.75,.19,16,48,Math.PI*1.5),primary);jaw.rotation.x=-Math.PI/2;root.rotation.y=-.6;
    }else if(kind==='marker'){
      for(const x of [-.8,.8]){const d=box(.62,.16,.62,primary,x,.2);d.rotation.y=Math.PI/4;}
    }else {box(3,.22,.55,primary,0,.1);box(2.85,.04,.05,accent,0,.23,-.17);}
    const hemisphere=new THREE.HemisphereLight('#e4f5ff','#1f3932',2.4);scene.add(hemisphere);
    const key=new THREE.DirectionalLight('#ffffff',3.2);key.position.set(3,5,4);scene.add(key);
    const fill=new THREE.DirectionalLight('#bbdbc9',1.8);fill.position.set(-4,2,-1);scene.add(fill);
    const initialRotation=.1;root.rotation.y=initialRotation;
    let disposed=false;const render=()=>{if(!disposed)renderer.render(scene,camera);};
    const resize=()=>{const w=Math.max(node.clientWidth,1),h=Math.max(node.clientHeight,1);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);render();};
    reset.current=()=>{root.rotation.set(0,initialRotation,0);render();};
    let active=-1,startX=0,startRot=0;
    const down=(e:PointerEvent)=>{active=e.pointerId;startX=e.clientX;startRot=root.rotation.y;node.setPointerCapture?.(e.pointerId);};
    const move=(e:PointerEvent)=>{if(e.pointerId!==active)return;root.rotation.y=startRot+(e.clientX-startX)*.009;render();};
    const up=()=>{active=-1;};
    const contextLost=(e:Event)=>{e.preventDefault();setFailed(true);};
    node.addEventListener('pointerdown',down);node.addEventListener('pointermove',move);node.addEventListener('pointerup',up);node.addEventListener('pointercancel',up);
    renderer.domElement.addEventListener('webglcontextlost',contextLost);
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(node);window.addEventListener('resize',resize);resize();
    return()=>{
      disposed=true;observer?.disconnect();window.removeEventListener('resize',resize);reset.current=()=>{};
      node.removeEventListener('pointerdown',down);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',up);node.removeEventListener('pointercancel',up);renderer.domElement.removeEventListener('webglcontextlost',contextLost);
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>([primary,secondary,accent,dark,felt,shaft]);
      scene.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    };
  },[item.key]);
  return <div className="sf-3d"><div ref={mount}/>{failed?<><img alt={`${item.displayLabel} illustration`} src={thumbnailDataUrl(item)} style={{width:'100%',height:'100%',objectFit:'contain',position:'relative'}}/><span>3D unavailable. Showing item illustration.</span></>:<><span>Drag sideways to rotate · illustrative material preview</span><button onClick={()=>reset.current()}>Reset view</button></>}</div>;
}
