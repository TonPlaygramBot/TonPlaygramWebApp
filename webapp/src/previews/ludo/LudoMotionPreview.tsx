import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { makePreviewSeat } from './generated/rig';
import { V, world } from '../../games/ludo/characterContact';
import { createDiceGesture, applyDiceFlight } from '../../games/ludo/diceMotion';
import { makeWeaponFallback, LUDO_WEAPON_SPECS } from '../../games/ludo/weaponModels';
import { parkWeapon } from '../../games/ludo/weaponParking';
import { playWeaponVolley } from '../../games/ludo/weaponVolley';
declare const LUDO_PREVIEW_MODEL:string;
const polymer=new THREE.MeshStandardMaterial({color:'#29392f',roughness:.8});
function box(parent:THREE.Object3D,size:number[],point:number[],mat=polymer){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]),mat);mesh.position.fromArray(point);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function makeDie() {
  const die = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color:'#ece7d9',roughness:.28 });
  box(die,[.036,.036,.036],[0,0,0],shell);
  const pipMat = new THREE.MeshStandardMaterial({color:'#273332',roughness:.5});
  const pipGeo = new THREE.CircleGeometry(.0029,12);
  const faces = [V(0,1,0), V(0,0,1), V(1,0,0), V(-1,0,0), V(0,0,-1), V(0,-1,0)];
  const patterns = [[[0,0]],[[-1,-1],[1,1]],[[-1,-1],[0,0],[1,1]],[[-1,-1],[1,-1],[-1,1],[1,1]],[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]];
  faces.forEach((normal,i)=>{
    const q=new THREE.Quaternion().setFromUnitVectors(V(0,0,1),normal);
    patterns[i].forEach(([x,y])=>{ const p=new THREE.Mesh(pipGeo,pipMat); p.position.copy(V(x*.009,y*.009,.0182).applyQuaternion(q)); p.quaternion.copy(q); die.add(p); });
  }); return die;
}
async function modelJson(){
  const bytes=Uint8Array.from(atob(LUDO_PREVIEW_MODEL),c=>c.charCodeAt(0));
  return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}
const choices=Object.keys(LUDO_WEAPON_SPECS);
const label=(id:string)=>id.replace(/Attack$/,'').replace(/^poly/,'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/01|02|03/g,'').replace(/^./,c=>c.toUpperCase());
function App(){
  const host=useRef<HTMLDivElement>(null),controls=useRef<any>();
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('Loading…'),[selected,setSelected]=useState('ak47VolleyAttack');
  useEffect(()=>{
    let dead=false,raf=0,dispose=()=>{};
    modelJson().then(json=>{
      if(dead)return;
      const element=host.current!,renderer=new THREE.WebGLRenderer({antialias:true});
      renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.outputColorSpace=THREE.SRGBColorSpace;element.append(renderer.domElement);
      const scene=new THREE.Scene();scene.background=new THREE.Color('#14261f');
      const camera=new THREE.PerspectiveCamera(40,1,.01,15);
      camera.position.set(1.32,1.01,1.96);camera.lookAt(.05,.26,.40);
      scene.add(new THREE.HemisphereLight('#e8f4ed','#4d6855',2));
      const light=new THREE.DirectionalLight('#ffe8c3',3);light.position.set(-1,3,2);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-2;light.shadow.camera.right=2;light.shadow.camera.top=2;light.shadow.camera.bottom=-2;scene.add(light);
      const template=new THREE.ObjectLoader().parse(json),entry=makePreviewSeat(template,scene,0);
      const tableY=.10;
      const wood=new THREE.MeshStandardMaterial({color:'#5c402b',roughness:.6}),felt=new THREE.MeshStandardMaterial({color:'#386853',roughness:.93});
      const table=new THREE.Mesh(new THREE.CylinderGeometry(.702,.702,.06,8),wood);table.position.y=tableY-.035;table.receiveShadow=true;scene.add(table);
      const top=new THREE.Mesh(new THREE.CylinderGeometry(.67,.67,.008,8),felt);top.position.y=tableY-.004;top.receiveShadow=true;scene.add(top);
      box(scene,[4,.03,4],[0,-.14,0],new THREE.MeshStandardMaterial({color:'#20382d',roughness:1}));
      const chair=entry.actor.parent;
      box(chair,[.26,.035,.28],[0,-.005,0],wood);box(chair,[.28,.28,.035],[0,.13,-.145],wood);
      for(const x of [-.11,.11])for(const z of [-.10,.10])box(chair,[.024,.21,.024],[x,-.115,z],wood);
      const board=new THREE.Group();scene.add(board);
      box(board,[.74,.012,.74],[0,tableY+.006,-.06],new THREE.MeshStandardMaterial({color:'#d3cba9',roughness:.85}));
      const colors=['#c55856','#d7b852','#528bc2','#64a77c'];
      colors.forEach((color,i)=>{
        const mat=new THREE.MeshStandardMaterial({color,roughness:.72}),x=(i%2?1:-1)*.24,z=-.06+(i<2?-1:1)*.24;
        box(board,[.22,.004,.22],[x,tableY+.014,z],mat);
        for(let j=0;j<4;j++){
          const token=new THREE.Mesh(new THREE.CylinderGeometry(.012,.019,.039,16),mat);token.position.set(x+(j%2?1:-1)*.049,tableY+.033,z+(j<2?-1:1)*.049);token.castShadow=true;board.add(token);
        }
      });
      const cellMat=new THREE.MeshStandardMaterial({color:'#ebe3c9',roughness:.86});
      for(let i=-7;i<=7;i++)for(let j=-1;j<=1;j++)if(Math.abs(i)>1)for(const [x,z] of [[i*.047,j*.047],[j*.047,i*.047]])box(board,[.04,.004,.04],[x,tableY+.015,z-.06],cellMat);
      const die=makeDie();die.scale.setScalar(1.5);die.position.set(0,.13,.60);scene.add(die);
      const target=new THREE.Mesh(new THREE.CylinderGeometry(.020,.032,.075,24),new THREE.MeshStandardMaterial({color:'#d5a752',metalness:.55,roughness:.35}));
      target.position.set(-.17,tableY+.049,-.16);target.castShadow=true;scene.add(target);
      const holder=new THREE.Group();scene.add(holder);let weapon=makeWeaponFallback('ak47VolleyAttack'),id='ak47VolleyAttack';holder.add(weapon);
      const park=()=>parkWeapon(weapon,id,world(chair),V(),tableY,()=>.702);park();
      let gesture:any=null,release:any=null,releaseTime=0,action='',actionStart=0;
      const start=(kind:string)=>{
        if(action)return;action=kind;setBusy(true);setStatus(kind==='dice'?'Pick up and roll':'Pick up, aim and fire');actionStart=performance.now();
        if(kind==='dice'){
          release=null;
          gesture=createDiceGesture(entry,die,entry.applyPose,{startMs:actionStart,isCurrent:()=>!dead,onRelease:pose=>{release=pose;releaseTime=actionStart+1100;}});
          entry.propMotion=gesture;
        }else{
          void playWeaponVolley({scene,entry,weapon,id,surfaceY:tableY,applyPose:entry.applyPose,target:()=>world(target),isCurrent:()=>!dead,onShot:()=>{},onImpact:()=>{target.visible=false;}})
            .then(()=>{if(dead)return;target.visible=true;action='';entry.applyPose('idle',0);setBusy(false);setStatus('Ready');});
        }
      };
      controls.current={start,weapon(next:string){if(action)return;weapon.removeFromParent();id=next;weapon=makeWeaponFallback(id);holder.add(weapon);park();}};
      const resize=()=>{renderer.setSize(element.clientWidth,element.clientHeight);camera.aspect=element.clientWidth/element.clientHeight;camera.updateProjectionMatrix();};
      const observer=new ResizeObserver(resize);observer.observe(element);resize();setReady(true);setStatus('Ready');
      function frame(now:number){
        if(dead)return;
        if(action==='dice'){
          gesture.update(now);
          if(release){
            const t=Math.min(1,(now-releaseTime)/950);applyDiceFlight(die,release,V(0,.13,.60),Math.max(0,t),.12);
            if(t>.78)die.quaternion.slerp(new THREE.Quaternion(),THREE.MathUtils.smoothstep(t,.78,1));
            if(t===1&&gesture.finished){action='';entry.propMotion=null;setBusy(false);setStatus('Rolled 1');}
          }
        }
        renderer.render(scene,camera);raf=requestAnimationFrame(frame);
      }
      raf=requestAnimationFrame(frame);
      dispose=()=>{entry.propMotion?.cancel?.();observer.disconnect();renderer.dispose();element.replaceChildren();scene.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh)mesh.geometry.dispose();});};
    }).catch(error=>setStatus('Preview could not load: '+error.message));
    return()=>{dead=true;cancelAnimationFrame(raf);dispose();};
  },[]);
  return <div className="ludo-screen"><div className="ludo-stage" ref={host} role="img" aria-label="Original Ludo human using the live dice and weapon interaction code"/>
    <div className="ludo-controls"><select aria-label="Weapon" value={selected} disabled={!ready||busy} onChange={e=>{setSelected(e.target.value);controls.current?.weapon(e.target.value);}}>{choices.map(id=><option key={id} value={id}>{label(id)}</option>)}</select>
    <button disabled={!ready||busy} onClick={()=>controls.current?.start('fire')}>Aim &amp; fire</button><button disabled={!ready||busy} onClick={()=>controls.current?.start('dice')}>Roll dice</button></div>
    <div className="ludo-status" role="status" aria-live="polite">{status}</div></div>;
}
createRoot(document.getElementById('ludo-motion-preview')!).render(<App/>);
