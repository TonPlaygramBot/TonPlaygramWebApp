import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createCharacterRig,runCharacterAction,updateCharacterCardContacts,CARD_H,CARD_W} from '#murlan-preview-rig';
import {heldCardPose,cardScaleForHand,CARD_PICKUP_REACH_MS,CARD_CARRY_MS,CARD_RELEASE_MS,CARD_ACTION_MS} from '../games/murlan/cardContact.ts';
declare const MURLAN_PREVIEW_MODEL: string;

function MurlanCardPreview() {
  const mount=useRef<HTMLDivElement>(null);
  const controls=useRef({play:()=>{},reset:()=>{}});
  const [status,setStatus]=useState('Loading character…');
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    const host=mount.current!;
    let renderer:THREE.WebGLRenderer;
    try {renderer=new THREE.WebGLRenderer({antialias:true});}
    catch {setStatus('3D preview needs WebGL support.');return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#08130f');
    scene.add(new THREE.HemisphereLight(0xeaf4ff,0x303329,2.5));
    const light=new THREE.DirectionalLight(0xfff1de,2.5);light.position.set(2,5,3);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-2;light.shadow.camera.right=2;light.shadow.camera.top=2;light.shadow.camera.bottom=-2;light.shadow.normalBias=.008;scene.add(light);
    const camera=new THREE.PerspectiveCamera(38,1,.01,30);camera.position.set(-.9,1.5,1.8);camera.lookAt(0,1.08,.30);
    const resize=()=>{camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const tabletop=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,.06,64),new THREE.MeshStandardMaterial({color:'#116044',roughness:.95}));
    tabletop.position.set(0,.89,1.38);tabletop.receiveShadow=true;scene.add(tabletop);
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.14,.21,.87,20),new THREE.MeshStandardMaterial({color:'#3d2820'}));leg.position.set(0,.435,1.38);scene.add(leg);
    const cushion=new THREE.Mesh(new THREE.BoxGeometry(.7,.1,.72),new THREE.MeshStandardMaterial({color:'#322932'}));cushion.position.set(0,.5,-.12);scene.add(cushion);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshStandardMaterial({color:'#14241d'}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
    let disposed=false,frame=0,started:number|null=null,rig:any=null;
    const cards:THREE.Mesh[]=[];
    const store:any={scene,cardMap:new Map(),characterRigs:new Map(),characterActionAnimations:[]};
    const makeCard=(rank:string,suit:string,index:number)=>{
      const canvas=document.createElement('canvas');canvas.width=192;canvas.height=272;
      const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fffdf5';ctx.fillRect(0,0,192,272);
      ctx.fillStyle=suit==='♥'||suit==='♦'?'#b52030':'#132622';ctx.font='bold 38px Georgia';ctx.fillText(rank,12,43);ctx.font='32px Georgia';ctx.fillText(suit,12,78);ctx.font='78px Georgia';ctx.textAlign='center';ctx.fillText(suit,96,172);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const face=new THREE.MeshStandardMaterial({map:texture,roughness:1});const back=new THREE.MeshStandardMaterial({color:'#15364b',roughness:1});
      const edge=new THREE.MeshStandardMaterial({color:'#eadfcb'});
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(CARD_W,CARD_H,.003),[edge,edge,edge,edge,face,back]);
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.scale.setScalar(cardScaleForHand(rig.cardContact,CARD_H,.67));mesh.userData.cardId=`card-${index}`;scene.add(mesh);cards.push(mesh);store.cardMap.set(mesh.userData.cardId,{mesh});
    };
    const reset=()=>{
      if(!rig)return;started=null;rig.cardPlay=null;setBusy(false);setStatus('Holding');
      rig.handMeshes=cards;
      if(rig.bones.head&&rig.seatedPose.head)rig.bones.head.rotation.copy(rig.seatedPose.head);
      cards.forEach((card,i)=>{card.userData.animation=null;const pose=heldCardPose(rig.cardContact,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI),i,cards.length,CARD_H,card.scale.x);if(pose){card.position.copy(pose.position);card.quaternion.copy(pose.quaternion);}});
      updateCharacterCardContacts(store,performance.now());
    };
    const play=()=>{
      if(!rig||started!==null)return;reset();const mesh=cards[2];
      const now=performance.now();started=now;
      const target=new THREE.Vector3(.03,.924,.85);const targetQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,Math.PI+.05));
      mesh.userData.animation={precisionContact:true,from:mesh.position.clone(),to:target,fromQuaternion:mesh.quaternion.clone(),toQuaternion:targetQuaternion,start:now+CARD_PICKUP_REACH_MS,duration:CARD_CARRY_MS};
      rig.handMeshes=cards.filter(c=>c!==mesh);
      runCharacterAction(store,rig,{type:'PLAY',playerIndex:0,cards:[{id:mesh.userData.cardId}]});setBusy(true);
    };
    controls.current={play,reset};
    (async()=>{
      const bytes=Uint8Array.from(atob(MURLAN_PREVIEW_MODEL),c=>c.charCodeAt(0));
      const decoded=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      const model=(await new GLTFLoader().parseAsync(decoded,'')).scene;if(disposed)return;
      model.traverse((node:any)=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
      const root=new THREE.Group();root.position.y=-.22;root.add(model);scene.add(root);
      rig=createCharacterRig(model,root,{seatIndex:0}, {},{isHuman:true},0,null);
      store.characterRigs.set(0,rig);
      [['7','♣'],['8','♥'],['9','♠'],['10','♦'],['J','♣']].forEach(([r,s],i)=>makeCard(r,s,i));reset();setReady(true);
    })().catch(()=>setStatus('Character could not load.'));
    let previousPhase='';
    const animate=(time:number)=>{
      if(started!==null){
        const elapsed=time-started;
        const phase=elapsed<CARD_PICKUP_REACH_MS*.68?'Reaching':elapsed<CARD_PICKUP_REACH_MS?'Gripping':elapsed<CARD_PICKUP_REACH_MS+CARD_CARRY_MS?'Placing':elapsed<CARD_PICKUP_REACH_MS+CARD_CARRY_MS+CARD_RELEASE_MS?'Releasing':'Returning';
        if(phase!==previousPhase){setStatus(phase);previousPhase=phase;}
        if(elapsed>=CARD_ACTION_MS){started=null;setStatus('Placed');setBusy(false);}
      }
      if(rig)updateCharacterCardContacts(store,time);
      renderer.render(scene,camera);frame=requestAnimationFrame(animate);
    };frame=requestAnimationFrame(animate);
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();renderer.dispose();renderer.domElement.remove();scene.traverse((node:any)=>{node.geometry?.dispose();for(const mat of Array.isArray(node.material)?node.material:[node.material]){mat?.map?.dispose();mat?.dispose();}});};
  },[]);
  return <div className="mcp-surface"><div className="mcp-top"><span>Card-handling review</span><span role="status">{status}</span></div><div ref={mount} className="mcp-view" aria-label="Original Murlan human character holding and playing a card"/><div className="mcp-actions"><button disabled={!ready||busy} onClick={()=>controls.current.play()}>Play card</button><button disabled={!ready} onClick={()=>controls.current.reset()}>Reset</button></div></div>;
}
createRoot(document.getElementById('murlan-card-review')!).render(<MurlanCardPreview/>);
