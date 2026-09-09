import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { giftMotifSvg, giftArtworkUrl } from './giftArtwork.js';
export type GiftDefinition = { id: string; name: string; model: string; color: string; accent: string; [key: string]: unknown };

/** Sculptural objects for the featured families, layered beveled reliefs for the
 * remaining illustrated motifs. A single renderer is mounted only on request.
 */
export function buildGiftModel(gift: GiftDefinition): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: gift.color, metalness: .36, roughness: .25 });
  const trim = new THREE.MeshStandardMaterial({ color: gift.accent, metalness: .58, roughness: .21 });
  const dark = new THREE.MeshStandardMaterial({ color: '#303449', roughness: .32 });
  const pearl = new THREE.MeshStandardMaterial({ color: '#fff6e6', roughness: .3, metalness: .18 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material = body, x=0,y=0,z=0, sx=1,sy=1,sz=1) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz); group.add(mesh); return mesh;
  };
  const ball = (x:number,y:number,z:number,r:number,mat:THREE.Material=body,sx=1,sy=1,sz=1) => add(new THREE.SphereGeometry(r,24,16),mat,x,y,z,sx,sy,sz);
  const box = (x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material=body) => add(new RoundedBoxGeometry(w,h,d,3,.06),mat,x,y,z);
  const torus = (r:number,t:number,mat:THREE.Material=trim,x=0,y=0,z=0) => add(new THREE.TorusGeometry(r,t,12,48),mat,x,y,z);
  const model = gift.model;
  if (model === 'crown') {
    add(new THREE.CylinderGeometry(.83,.71,.32,40,1,true),trim,0,-.46);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4, x=Math.sin(a)*.74, z=Math.cos(a)*.74;
      const peak=add(new THREE.ConeGeometry(.28,.9,4),body,x,.08,z); peak.rotation.y=a+Math.PI/4;
      ball(x,.55,z,.075,trim);
      add(new THREE.OctahedronGeometry(.12),i%2?pearl:trim,x*1.03,-.41,z*1.03);
    }
    const ring=torus(.74,.055,trim,0,-.65); ring.rotation.x=Math.PI/2;
  } else if (['gem','egg','orb','planet','eightball','sun'].includes(model)) {
    if (model==='gem') { add(new THREE.OctahedronGeometry(.93),body,0,.1,0,1,1.15,1); const r=torus(.52,.07,trim,0,-.81);r.rotation.x=Math.PI/2; }
    else if(model==='egg') {ball(0,0,0,.72,body,1,1.4,1);const r=torus(.71,.035,trim,0,-.15);r.rotation.x=Math.PI/2;}
    else {
      ball(0,0,0,.78);
      if(model==='planet') {const r=torus(1.15,.095,trim); r.rotation.x=1.15; r.rotation.y=.2;}
      if(model==='orb') {const r=torus(.77,.03,trim);r.rotation.y=.5;box(0,-.88,0,.92,.16,.8,trim);}
      if(model==='eightball') {ball(0,.2,.73,.27,pearl,1,1,.14);torus(.065,.018,dark,0,.27,.78);torus(.075,.02,dark,0,.13,.79);}
      if(model==='sun')for(let i=0;i<12;i++){const a=i*Math.PI/6;const p=add(new THREE.ConeGeometry(.11,.35,5),trim,Math.sin(a)*1.01,Math.cos(a)*1.01);p.rotation.z=-a;}
    }
  } else if(model==='rocket') {
    add(new THREE.CylinderGeometry(.29,.37,1.25,32),pearl,0,.03);
    add(new THREE.ConeGeometry(.3,.66,32),body,0,.98);
    add(new THREE.CylinderGeometry(.32,.38,.15,32),trim,0,-.64);
    const windowRing=torus(.18,.047,trim,0,.2,.335); windowRing.rotation.x=.04;
    ball(0,.2,.34,.165,dark,1,1,.2);
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;const fin=add(new THREE.ConeGeometry(.23,.75,3),body,Math.sin(a)*.4,-.41,Math.cos(a)*.4);fin.rotation.y=a;}
    add(new THREE.ConeGeometry(.23,.59,20),trim,0,-1.01).rotation.z=Math.PI;
  } else if(model==='ufo') {
    ball(0,0,0,.9,body,1,.24,1);ball(0,.25,0,.46,pearl,1,.75,1);
    const rim=torus(.77,.07,trim);rim.rotation.x=Math.PI/2;
    for(let i=0;i<10;i++){const a=i*Math.PI/5;ball(Math.sin(a)*.76,-.03,Math.cos(a)*.76,.065,trim);}
    add(new THREE.ConeGeometry(.51,.66,32,1,true),new THREE.MeshStandardMaterial({color:gift.accent,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}),0,-.46);
  } else if(['gift','dice','chest','musicbox'].includes(model)) {
    box(0,0,0,1.3,1.2,1.15);
    if(model==='dice') {
      for(const [x,y] of [[-.32,.32],[.32,.32],[0,0],[-.32,-.32],[.32,-.32]])ball(x,y,.575,.09,trim,1,1,.3);
      for(const [y,z]of [[-.25,-.25],[.25,.25]])ball(.65,y,z,.085,trim,.3,1,1);
    } else {
      box(0,.62,0,1.42,.16,1.26,trim);
      box(0,0,.588,.19,1.18,.025,trim);box(.658,0,0,.025,1.18,.19,trim);
      if(model==='gift')for(const sign of [-1,1]){const loop=torus(.23,.048,body,sign*.2,.89,0);loop.scale.set(1,.7,1);loop.rotation.y=sign*.35;}
      else box(0,.17,.61,.24,.28,.09,trim);
    }
  } else if(['bear','bunny','cat','fox','panda','chick','frog','owl','penguin'].includes(model)) {
    ball(0,-.42,0,.55,body,1,1.08,.85);ball(0,.31,.025,.61);
    ball(-.28,-.87,.18,.24);ball(.28,-.87,.18,.24);
    ball(-.52,-.38,0,.2,trim,1,1.5,1);ball(.52,-.38,0,.2,trim,1,1.5,1);
    if(['bunny','bear','panda','frog'].includes(model))for(const sign of[-1,1]) {
      const tall=model==='bunny';ball(sign*.37,.82,0,tall?.19:.22,model==='panda'?dark:body,1,tall?2.55:1,1);
      if(tall)ball(sign*.37,.9,.15,.1,trim,1,3,.22);
    }
    if(['cat','fox','owl'].includes(model))for(const sign of[-1,1]) {const ear=add(new THREE.ConeGeometry(.25,.44,3),trim,sign*.4,.83,0);ear.rotation.z=sign*-.2;}
    if(model==='penguin'||model==='panda')ball(0,-.43,.42,.36,pearl,1,1.1,.15);
    for(const sign of[-1,1]) {ball(sign*.205,.36,.555,.061,dark,1,1.15,.6);ball(sign*.215,.38,.585,.016,pearl);}
    ball(0,.2,.619,.085,trim,1,.65,.7);
    if(model==='chick')add(new THREE.ConeGeometry(.08,.2,4),trim,0,.2,.65).rotation.x=Math.PI/2;
  } else if(['coffee','jar','perfume','potion','soda','trophy','icecream'].includes(model)) {
    if(model==='coffee') {
      add(new THREE.CylinderGeometry(.55,.41,.95,32),body,0,-.1);
      add(new THREE.CylinderGeometry(.49,.49,.025,32),dark,0,.38);
      const handle=torus(.28,.075,trim,.54,-.04);handle.scale.set(.8,1,1);
      add(new THREE.CylinderGeometry(.76,.72,.07,40),trim,0,-.62);
    } else if(model==='trophy') {
      add(new THREE.CylinderGeometry(.6,.18,.8,32),body,0,.28);add(new THREE.CylinderGeometry(.095,.11,.55,20),trim,0,-.38);box(0,-.74,0,.9,.18,.65,trim);
      for(const sign of[-1,1])torus(.32,.065,trim,sign*.56,.27);
    } else if(model==='icecream') {
      add(new THREE.ConeGeometry(.44,1.23,40),trim,0,-.43).rotation.z=Math.PI;ball(0,.36,0,.51);ball(.03,.7,0,.33);
    } else {
      add(new THREE.CylinderGeometry(model==='soda'?.4:.42,.43,1.03,32),body,0,-.12);
      add(new THREE.CylinderGeometry(.27,.3,.28,24),trim,0,.56);
      box(0,-.1,.435,.52,.42,.018,pearl);
      if(model==='soda')add(new THREE.CylinderGeometry(.038,.038,.76,12),trim,.16,.83).rotation.z=-.15;
    }
  } else {
    // Original layered vector art becomes a beveled, solid collectible relief.
    // Keep SVG y increasing downward so its appearance matches the phone artwork.
    const paths = new SVGLoader().parse(giftMotifSvg(gift)).paths;
    paths.forEach((path,index) => {
      const style=path.userData?.style || {};
      const z=index*.035;
      if(style.fill && style.fill!=='none') {
        const material=new THREE.MeshStandardMaterial({color:style.fill,metalness:.32,roughness:.3,side:THREE.DoubleSide});
        for(const shape of SVGLoader.createShapes(path)) {
          const mesh=add(new THREE.ExtrudeGeometry(shape,{depth:8,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:1.4,bevelThickness:1,curveSegments:10}),material);
          mesh.scale.set(.011,-.011,.011);mesh.position.set(-1.32,1.32,z);
        }
      }
      if(style.stroke && style.stroke!=='none')for(const subpath of path.subPaths) {
        const geometry=SVGLoader.pointsToStroke(subpath.getPoints(),style);
        if(geometry){const mesh=add(geometry,new THREE.MeshStandardMaterial({color:style.stroke,side:THREE.DoubleSide,roughness:.28,metalness:.4}));mesh.scale.set(.011,-.011,.011);mesh.position.set(-1.32,1.32,z+.13);}
      }
    });
  }
  // Release helper materials unused by the selected family.
  const used=new Set<THREE.Material>();group.traverse(node=>{if(node instanceof THREE.Mesh)(Array.isArray(node.material)?node.material:[node.material]).forEach(m=>used.add(m));});
  [body,trim,dark,pearl].forEach(m=>{if(!used.has(m))m.dispose();});
  const bounds=new THREE.Box3().setFromObject(group), center=bounds.getCenter(new THREE.Vector3()), size=bounds.getSize(new THREE.Vector3());
  group.position.sub(center);const max=Math.max(size.x,size.y,size.z,1);group.scale.multiplyScalar(2.3/max);group.position.multiplyScalar(2.3/max);
  return group;
}

export default function GiftViewer({ gift }: { gift: GiftDefinition }) {
  const host=useRef<HTMLDivElement>(null), reset=useRef<()=>void>(()=>{});
  const [unavailable,setUnavailable]=useState(false);
  useEffect(()=>{
    const element=host.current;if(!element)return;
    let renderer:THREE.WebGLRenderer|undefined, controls:OrbitControls|undefined, observer:ResizeObserver|undefined, intersection:IntersectionObserver|undefined;
    let scene:THREE.Scene|undefined, pmrem:THREE.PMREMGenerator|undefined, env:THREE.WebGLRenderTarget|undefined;
    let cleaned=false, visible=true;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const cleanup=()=>{
      if(cleaned)return;cleaned=true;observer?.disconnect();intersection?.disconnect();document.removeEventListener('visibilitychange',resume);media.removeEventListener('change',resume);
      renderer?.setAnimationLoop(null);controls?.dispose();
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
      scene?.traverse(node=>{if(node instanceof THREE.Mesh){geometries.add(node.geometry);(Array.isArray(node.material)?node.material:[node.material]).forEach(m=>materials.add(m));}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());env?.dispose();pmrem?.dispose();
      renderer?.domElement.removeEventListener('webglcontextlost',lost);renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();reset.current=()=>{};
    };
    const draw=()=>{if(!cleaned&&renderer&&scene&&camera)renderer.render(scene,camera);};
    const resume=()=>{
      if(!renderer||cleaned)return;
      if(controls){controls.autoRotate=!media.matches;controls.enableDamping=!media.matches;}
      renderer.setAnimationLoop(!visible||document.hidden||media.matches?null:()=>{controls?.update();draw();});draw();
    };
    const lost=(event:Event)=>{event.preventDefault();cleanup();setUnavailable(true);};
    let camera:THREE.PerspectiveCamera;
    setUnavailable(false);
    try {
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
      element.appendChild(renderer.domElement);renderer.domElement.addEventListener('webglcontextlost',lost);
      scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(36,1,.1,30);camera.position.set(2.7,1.45,5.7);
      pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();env=pmrem.fromScene(room,.04);room.dispose();scene.environment=env.texture;
      scene.add(new THREE.HemisphereLight('#ffffff','#a2a0bf',2));const light=new THREE.DirectionalLight('#fff5db',3);light.position.set(3,5,4);scene.add(light);
      scene.add(buildGiftModel(gift));
      controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.minDistance=3;controls.maxDistance=9;controls.minPolarAngle=.25;controls.maxPolarAngle=Math.PI-.25;controls.autoRotateSpeed=.75;controls.enableDamping=!media.matches;controls.addEventListener('change',draw);
      reset.current=()=>{camera.position.set(2.7,1.45,5.7);controls?.target.set(0,0,0);controls?.update();draw();};
      observer=new ResizeObserver(()=>{if(!renderer)return;const width=Math.max(1,element.clientWidth),height=Math.max(1,element.clientHeight);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);draw();});observer.observe(element);
      if('IntersectionObserver'in window){intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;resume();});intersection.observe(element);}
      document.addEventListener('visibilitychange',resume);media.addEventListener('change',resume);resume();
    } catch {cleanup();setUnavailable(true);}
    return cleanup;
  },[gift.id]);
  return <div className="gift-viewer-wrap">
    <div className="gift-viewer" ref={host} role="img" aria-label={`Interactive 3D model of ${gift.name}`} style={{display:unavailable?'none':undefined}} />
    {unavailable?<><img className="gift-viewer-fallback" src={giftArtworkUrl(gift)} alt={gift.name}/><p className="gift-muted">3D is unavailable on this device. Original artwork is shown.</p></>:<div className="gift-viewer-help"><span>Drag to rotate · Pinch to zoom</span><button type="button" onClick={()=>reset.current()}>Reset view</button></div>}
  </div>;
}
