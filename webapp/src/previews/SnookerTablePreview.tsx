import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createUploadedSnookerMapping, fitUploadedSnookerModel, reflectUploadedSnookerCushions, uploadedPocketContains } from '../pages/Games/snookerUploadedTable';
declare const SNOOKER_TABLE_PREVIEW_MODEL: string;
declare const SNOOKER_TABLE_PREVIEW_METRICS: { playW: number; playL: number; ballR: number; clothY: number; tableY: number; floorY: number };

function Preview() {
  const stage=useRef<HTMLDivElement>(null);
  const controls=useRef({view:'overview',mapping:false,pocket:0,shot:0});
  const [view,setView]=useState('overview'),[mapping,setMapping]=useState(false),[pocket,setPocket]=useState(0);
  const [status,setStatus]=useState('Loading table');
  useEffect(()=>{
    const el=stage.current!;
    const m=SNOOKER_TABLE_PREVIEW_METRICS;
    const map=createUploadedSnookerMapping(m.playW,m.playL,m.ballR);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#101b1a');
    const camera=new THREE.PerspectiveCamera(48,1,.1,2000);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
    el.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xe5f7ff,0x43402a,2.2));
    const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-70,130,-50);scene.add(light);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(800,800),new THREE.MeshStandardMaterial({color:0x253a34,roughness:.95}));
    floor.rotation.x=-Math.PI/2;floor.position.y=m.floorY-m.tableY;scene.add(floor);
    const ball=new THREE.Mesh(new THREE.SphereGeometry(m.ballR,32,20),new THREE.MeshStandardMaterial({color:0xfff8e6,roughness:.18}));
    scene.add(ball);
    const outline=new THREE.Group();scene.add(outline);
    for(const contour of map.contours){
      const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(contour.map(p=>new THREE.Vector3(p.x,.15,p.y))),new THREE.LineBasicMaterial({color:0xffcb67,depthTest:false}));
      line.renderOrder=8;outline.add(line);
    }
    for(const p of map.pockets){
      const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(p.polygon.map(v=>new THREE.Vector3(v.x,.2,v.y))),new THREE.LineBasicMaterial({color:0x50dfe6,depthTest:false}));
      line.renderOrder=9;outline.add(line);
    }
    const cue=new THREE.Mesh(new THREE.CylinderGeometry(.2,.5,38,12),new THREE.MeshStandardMaterial({color:0xcba76b}));scene.add(cue);
    let alive=true,raf=0,last=performance.now(),accumulator=0,priorPocket=-1,priorShot=0,loaded=false;
    const sim={pos:new THREE.Vector2(),vel:new THREE.Vector2()};
    let pottedAt=0,dropStart=new THREE.Vector2();
    const aim=new THREE.Vector2();
    const reset=()=>{
      const index=controls.current.pocket;
      const target=map.pockets[index].center;
      aim.copy(index<4?new THREE.Vector2(Math.sign(target.x),Math.sign(target.y)).normalize():new THREE.Vector2(Math.sign(target.x),0));
      sim.pos.copy(target).addScaledVector(aim,-m.ballR*26);sim.vel.set(0,0);
      pottedAt=0;ball.visible=true;ball.position.set(sim.pos.x,m.ballR,sim.pos.y);
    };
    const resize=()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const loader=new GLTFLoader();
    // Decode embedded images locally, without fetch/XHR or a network asset URL.
    loader.register(parser=>({name:'InlineTableImages',loadTexture:(index:number)=>{
      const texture=parser.json.textures[index],image=parser.json.images[texture.source];
      return parser.getDependency('bufferView',image.bufferView).then((buffer:ArrayBuffer)=>new Promise<THREE.Texture>((resolve,reject)=>{
        const img=new Image();const url=URL.createObjectURL(new Blob([buffer],{type:image.mimeType}));
        img.onload=()=>{const tex=new THREE.Texture(img);tex.flipY=false;tex.needsUpdate=true;URL.revokeObjectURL(url);resolve(tex);};
        img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Image decoding failed'));};img.src=url;
      }));
    }}));
    const compressed=Uint8Array.from(atob(SNOOKER_TABLE_PREVIEW_MODEL),c=>c.charCodeAt(0));
    new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      .then(data=>loader.parseAsync(data,''))
      .then(gltf=>{if(!alive)return;scene.add(fitUploadedSnookerModel(gltf.scene,map,0,m.floorY-m.clothY));loaded=true;setStatus('Ready');})
      .catch(()=>{if(alive)setStatus('Table could not load');});
    const frame=(now:number)=>{
      if(!alive)return;raf=requestAnimationFrame(frame);
      const dt=Math.min((now-last)/1000,.08);last=now;
      const c=controls.current;
      if(c.pocket!==priorPocket){priorPocket=c.pocket;reset();}
      if(c.shot!==priorShot){priorShot=c.shot;reset();sim.vel.copy(aim).multiplyScalar(m.ballR*.9);setStatus('Shot');}
      accumulator+=dt;
      while(accumulator>=1/120){
        accumulator-=1/120;
        if(loaded&&!pottedAt){
          sim.pos.addScaledVector(sim.vel,.5);reflectUploadedSnookerCushions(sim,map,.96);sim.vel.multiplyScalar(.998);
          if(map.pockets.some((_,i)=>uploadedPocketContains(map,i,sim.pos))){pottedAt=now;dropStart.copy(sim.pos);sim.vel.set(0,0);setStatus('Potted');}
        }
      }
      if(pottedAt){const t=Math.min(1,(now-pottedAt)/450);ball.position.set(dropStart.x,m.ballR-7*m.ballR*t*t,dropStart.y);ball.visible=t<1;}
      else ball.position.set(sim.pos.x,m.ballR,sim.pos.y);
      cue.visible=!pottedAt&&sim.vel.length()<.01;
      const cueDirection=new THREE.Vector3(aim.x,0,aim.y);
      cue.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),cueDirection);
      cue.position.copy(ball.position).addScaledVector(cueDirection,-22);
      outline.visible=c.mapping;
      if(c.view==='aim'){
        camera.position.copy(ball.position).addScaledVector(cueDirection,-40);camera.position.y=13;
        camera.lookAt(map.pockets[c.pocket].center.x,0,map.pockets[c.pocket].center.y);
      }else if(c.view==='top'){
        camera.position.set(0,Math.max(m.playL*.82,m.playW/camera.aspect*1.35),-.01);camera.lookAt(0,0,0);
      }else{
        const distance=Math.max(m.playL*1.1,m.playW/camera.aspect*1.35);
        camera.position.set(-distance*.14,distance*.6,-distance*.73);camera.lookAt(0,-5,0);
      }
      renderer.render(scene,camera);
    };
    raf=requestAnimationFrame(frame);
    return()=>{alive=false;cancelAnimationFrame(raf);observer.disconnect();renderer.dispose();el.replaceChildren();scene.traverse(n=>{if(n instanceof THREE.Mesh){n.geometry.dispose();const mats=Array.isArray(n.material)?n.material:[n.material];mats.forEach(mat=>mat.dispose());}});};
  },[]);
  return <div className="snooker-table-review">
    <div className="table-review-toolbar">{['overview','aim','top'].map(v=><button key={v} aria-pressed={view===v} onClick={()=>{setView(v);controls.current.view=v;}}>{v==='overview'?'Overview':v==='aim'?'Aim':'Top'}</button>)}</div>
    <div ref={stage} className="table-review-stage" role="img" aria-label="Uploaded snooker table and mapped ball shot"/>
    <div className="table-review-toolbar">
      <select aria-label="Pocket" value={pocket} onChange={e=>{setPocket(+e.target.value);controls.current.pocket=+e.target.value;setStatus('Ready');}}>{Array.from({length:6},(_,i)=><option key={i} value={i}>Pocket {i+1}</option>)}</select>
      <button onClick={()=>controls.current.shot++}>Shoot</button>
      <label><input type="checkbox" checked={mapping} onChange={e=>{setMapping(e.target.checked);controls.current.mapping=e.target.checked;}}/> Mapping</label>
      <output aria-live="polite">{status}</output>
    </div>
  </div>;
}
createRoot(document.getElementById('snooker-table-review-root')!).render(<Preview/>);
